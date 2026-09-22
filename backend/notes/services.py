"""SQLite-friendly revision checks and atomic writes, never a transaction over HTTP."""
import json
from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.exceptions import APIException, ValidationError

from ai.schema import InvalidAnalysis, parse_analysis
from ai.services import groq_service
from accounts.services.ai_config import get_server_ai_enabled
from accounts.services.entitlement import TrialUnavailable, consume_trial
from .item_serializers import ItemInputSerializer, NoteItemSerializer
from .models import AIProcessingLog, Note, NoteItem
from .preparser import parse_note_evidence


class Conflict(APIException):
    status_code = 409
    default_detail = 'This note changed. Reload the review before trying again.'


def analysis_is_running(note):
    return bool(note.processing_status == 'PROCESSING' and note.analysis_started_at and
                note.analysis_started_at > timezone.now() - timedelta(seconds=settings.AI_ANALYSIS_LEASE_SECONDS))


def tense_conflict_flag(predicted, evidence):
    """Flag provider items whose type contradicts explicit tense markers.

    Review-only signal: the item is still saved as a draft for the user to
    correct. Never invents, removes, or rewrites provider output.
    """
    if not evidence.get('money'):
        # No money involved: an obligation with an explicit date belongs on an
        # EVENT, but a dated shopping TASK (buy milk tomorrow) is legitimate.
        if (predicted.get('type') == 'TASK' and evidence.get('obligation_hint')
                and 'shopping' not in (predicted.get('domains') or [])):
            return {'tense_conflict': (
                'This has an explicit date. Consider changing it to an event '
                'with that date instead of a task.'
            )}
        return {}
    item_type = predicted.get('type')
    domains = predicted.get('domains') or []
    if item_type == 'EXPENSE' and evidence.get('intent') == 'future':
        return {'tense_conflict': (
            'This looks like a future purchase, not money already spent. '
            'Confirm as an expense only if you already paid.'
        )}
    if item_type == 'TASK' and 'shopping' in domains and evidence.get('intent') == 'past':
        return {'tense_conflict': (
            'This looks like money already spent. Consider changing it to an expense.'
        )}
    return {}


def split_item_ids(items, evidence):
    """Ids of items sharing a single money mention across several items.

    One amount in the note but several provider items carrying it means the
    model split one intent. Per product policy nothing is merged: every item
    is kept as a draft and flagged so the user keeps all but the fit ones.
    """
    money = evidence.get('money') or []
    if len(money) != 1 or money[0].get('amount') is None:
        return set()
    try:
        target = Decimal(str(money[0]['amount']))
    except (InvalidOperation, TypeError, ValueError):
        return set()
    target_currency = money[0].get('currency')
    sharing = set()
    for predicted in items:
        if predicted.get('amount') is None:
            continue
        try:
            same_amount = Decimal(str(predicted['amount'])) == target
        except (InvalidOperation, TypeError, ValueError):
            continue
        if same_amount and (predicted.get('currency') or None) == target_currency:
            sharing.add(id(predicted))
    return sharing if len(sharing) >= 2 else set()


def claim_revision(note, revision, **changes):
    """Conditional UPDATE acquires SQLite's write lock and prevents stale writes."""
    changed = Note.objects.filter(pk=note.pk, app_user_id=note.app_user_id, revision=revision).update(
        revision=F('revision') + 1, updated_at=timezone.now(), **changes,
    )
    if not changed:
        raise Conflict()
    note.refresh_from_db()


def save_item(note, values, *, item=None, confirmed=False, analysis_log=None, confidence=None):
    values = dict(values)
    domains = values.pop('domains', None)
    item = item or NoteItem(note=note, analysis_log=analysis_log, confidence=confidence)
    for field, value in values.items():
        setattr(item, field, value)
    item.is_confirmed = confirmed
    item.save()
    if domains is not None:
        item.domains.set(domains)
    return item


def snapshot(items):
    # Serializer emits decimal strings and ISO dates, safe for JSONField.
    return json.loads(json.dumps(NoteItemSerializer(items, many=True).data))


def record_confirmation(note, source_log=None, operation='CONFIRM'):
    AIProcessingLog.objects.create(
        note=note, note_revision=note.revision, input_text=note.raw_text,
        operation=operation, source_log=source_log, status='SUCCESS',
        confirmed_response=snapshot(note.items.filter(is_confirmed=True).select_related('note').prefetch_related('domains')),
        completed_at=timezone.now(),
    )


def analyze(note, revision, user_api_key=None, trial=False):
    if len(note.raw_text) > settings.AI_MAX_NOTE_CHARACTERS:
        raise ValidationError({'detail': 'This note is too long for AI analysis. Split it or organize manually.'})
    if not user_api_key and not trial:
        raise ValidationError({
            'detail': 'Start the free trial or enter a personal API key to use AI organization.',
            'code': 'credential_required',
        })
    if trial and not user_api_key and (not get_server_ai_enabled() or not settings.GROQ_API_KEY):
        raise groq_service.ProviderFailure(
            'trial_unavailable',
            'Free trial is not available right now. Enter a personal API key instead.',
            503,
        )
    if trial and not user_api_key:
        # Quota is checked before claiming a revision so a rejected trial
        # burns neither revision nor note state. Consumed quota is not
        # refunded on later provider failure (documented charge policy).
        try:
            consume_trial(note.app_user)
        except TrialUnavailable as error:
            raise groq_service.ProviderFailure('trial_exhausted', str(error), 429) from error
    if analysis_is_running(note):
        raise Conflict('Analysis is already running. Wait, then reload the review.')
    with transaction.atomic():
        claim_revision(note, revision, processing_status='PROCESSING', analysis_started_at=timezone.now())
        # A crashed worker can leave a STARTED attempt. A new lease supersedes it.
        note.ai_logs.filter(status='STARTED').update(status='SUPERSEDED', completed_at=timezone.now())
        log = AIProcessingLog.objects.create(
            note=note, note_revision=note.revision, input_text=note.raw_text,
            model_name=settings.GROQ_MODEL, prompt_version=groq_service.PROMPT_VERSION, status='STARTED',
        )
    attempt_revision = note.revision
    raw = ''
    payload = None
    failure = None
    deterministic_evidence = parse_note_evidence(note.raw_text)
    try:
        if user_api_key:
            provider_response = groq_service.analyze_note(note.raw_text, timezone.localtime(), api_key=user_api_key)
        else:
            provider_response = groq_service.analyze_note(note.raw_text, timezone.localtime())
        raw = groq_service.redact(provider_response, extra_key=user_api_key)
        payload = parse_analysis(raw)
        split_ids = split_item_ids(payload['items'], deterministic_evidence)
        validated = []
        for predicted in payload['items']:
            data = {key: value for key, value in predicted.items() if key not in ('type', 'confidence')}
            data['item_type'] = predicted['type']
            # Keep explicit parser evidence visible for review; never replace provider values.
            data['metadata'] = {
                'deterministic_evidence': deterministic_evidence,
                **tense_conflict_flag(predicted, deterministic_evidence),
            }
            if id(predicted) in split_ids:
                data['metadata']['possible_split'] = (
                    'One amount in your note produced several items here. '
                    'Keep the one that fits and remove the rest.'
                )
            serializer = ItemInputSerializer(data=data)
            serializer.is_valid(raise_exception=True)
            validated.append((serializer.validated_data, predicted['confidence']))
    except groq_service.ProviderFailure as error:
        failure = error
    except (InvalidAnalysis, ValidationError):
        failure = groq_service.ProviderFailure('invalid_output', 'The AI response failed validation.')
    except Exception:
        # Fail closed; never send an SDK traceback, request headers, or credentials to the client/log.
        failure = groq_service.ProviderFailure('unexpected', 'AI processing could not be completed.')

    with transaction.atomic():
        # An edit/deletion/new attempt while HTTP was in flight must win.
        changed = Note.objects.filter(pk=note.pk, revision=attempt_revision, processing_status='PROCESSING').update(
            processing_status='FAILED' if failure else 'REVIEW_REQUIRED',
            analysis_started_at=None, updated_at=timezone.now(),
        )
        if not changed:
            AIProcessingLog.objects.filter(pk=log.pk).update(status='SUPERSEDED', completed_at=timezone.now())
        else:
            AIProcessingLog.objects.filter(pk=log.pk).update(
                raw_response=raw[:40000], parsed_response=payload,
                status='FAILED' if failure else ('SUCCESS' if payload['items'] else 'EMPTY'),
                error_code=failure.code if failure else '', error_message=str(failure) if failure else '',
                completed_at=timezone.now(),
            )
            if not failure:
                # Preserve old drafts on failure, replace them only after full validation.
                note.items.filter(is_confirmed=False).delete()
                for data, confidence in validated:
                    save_item(note, data, analysis_log=log, confidence=confidence)
    if not changed:
        raise Conflict('The note changed during analysis. The outdated result was discarded.')
    if failure:
        raise failure
    note.refresh_from_db()


def confirm(note, revision, items):
    if analysis_is_running(note):
        raise Conflict('Wait for analysis to finish before confirming.')
    with transaction.atomic():
        claim_revision(note, revision, analysis_started_at=None)
        drafts = {item.pk: item for item in note.items.filter(is_confirmed=False)}
        ids = [data['id'] for data in items if 'id' in data]
        if len(ids) != len(set(ids)) or any(pk not in drafts for pk in ids):
            raise ValidationError({'detail': 'Item IDs must be distinct drafts of this note. Reload the review.'})
        source_log = note.ai_logs.filter(operation='ANALYZE', status__in=['SUCCESS', 'EMPTY'], input_text=note.raw_text).first()
        for values in items:
            values = dict(values)
            item = drafts.get(values.pop('id', None))
            # Deterministic evidence is a server-attached review signal;
            # client confirmations must not wipe it with serializer defaults.
            values.pop('metadata', None)
            save_item(note, values, item=item, confirmed=True)
        # Confirmed items are never implicitly overwritten or deleted by a new review.
        note.items.filter(is_confirmed=False).delete()
        note.processing_status = 'PROCESSED' if items else 'REVIEW_REQUIRED'
        note.save(update_fields=['processing_status', 'updated_at'])
        record_confirmation(note, source_log)


def edit_confirmed(item, revision, changes):
    note = item.note
    if analysis_is_running(note):
        raise Conflict('Wait for analysis to finish before editing structured items.')
    with transaction.atomic():
        claim_revision(note, revision)
        changes = dict(changes)
        # Preserve server-attached evidence on edits as well.
        changes.pop('metadata', None)
        save_item(note, changes, item=item, confirmed=True)
        record_confirmation(note, item.analysis_log, operation='EDIT')
    return item


def create_standalone_item(user, values):
    """Manual category entry without AI: own Note + confirmed NoteItem, atomically."""
    values = dict(values)
    title = (values.get('title') or '').strip()
    if not title:
        raise ValidationError({'title': 'A title is required.'})
    raw_text = values.get('summary') or values.get('normalized_text') or title
    raw_text = str(raw_text).strip() or title
    with transaction.atomic():
        note = Note.objects.create(
            app_user=user, raw_text=raw_text[:12000],
            processing_status=Note.ProcessingStatus.PROCESSED,
        )
        item = save_item(note, values, confirmed=True, confidence=None)
        record_confirmation(note, operation='CONFIRM')
    item.refresh_from_db()
    return item


BACKLOG_STATUSES = (
    Note.ProcessingStatus.UNPROCESSED,
    Note.ProcessingStatus.FAILED,
)
BULK_LIMIT = 25


def confirm_all_drafts(note):
    """Verify mode: confirm every current draft unedited.

    Drafts carrying review flags (tense_conflict, possible_split) are left
    unconfirmed so a human resolves them; the caller reports them back.
    Raw text is never touched; only draft flags change. Used by bulk
    processing after a successful analysis of the same revision.
    Returns (confirmed_count, skipped_for_review_count).
    """
    if analysis_is_running(note):
        raise Conflict('Wait for analysis to finish before confirming.')
    with transaction.atomic():
        claim_revision(note, note.revision, analysis_started_at=None)
        drafts = list(note.items.filter(is_confirmed=False))
        source_log = note.ai_logs.filter(
            operation='ANALYZE', status__in=['SUCCESS', 'EMPTY'], input_text=note.raw_text,
        ).first()
        confirmed, skipped = 0, 0
        for item in drafts:
            flags = item.metadata or {}
            if flags.get('tense_conflict') or flags.get('possible_split'):
                skipped += 1
                continue
            item.is_confirmed = True
            item.save(update_fields=['is_confirmed', 'updated_at'])
            confirmed += 1
        has_confirmed = note.items.filter(is_confirmed=True).exists()
        note.processing_status = 'PROCESSED' if (confirmed or has_confirmed) else 'REVIEW_REQUIRED'
        note.save(update_fields=['processing_status', 'updated_at'])
        record_confirmation(note, source_log)
        return confirmed, skipped


def process_backlog(user, mode, user_api_key=None, trial=False, limit=BULK_LIMIT):
    """Sequentially analyze every backlog note (UNPROCESSED + FAILED).

    Verify mode additionally confirms each note's drafts unedited.
    Trial quota is consumed per analyzed note; exhaustion stops the run
    and remaining notes are reported as skipped, never half-processed.
    """
    if mode not in ('analyze', 'verify'):
        raise ValidationError({'mode': 'Use analyze or verify.'})
    if not user_api_key and not trial:
        raise ValidationError({
            'detail': 'Start the free trial or enter a personal API key to use AI organization.',
            'code': 'credential_required',
        })
    if trial and not user_api_key and (not get_server_ai_enabled() or not settings.GROQ_API_KEY):
        raise groq_service.ProviderFailure(
            'trial_unavailable',
            'Free trial is not available right now. Enter a personal API key instead.',
            503,
        )
    candidates = list(Note.objects.filter(
        app_user=user, is_archived=False, processing_status__in=BACKLOG_STATUSES,
    ).order_by('created_at', 'id')[:limit])
    results = []
    stopped = None
    for note in candidates:
        if analysis_is_running(note):
            results.append({'id': note.pk, 'status': 'skipped', 'code': 'running'})
            continue
        try:
            analyze(note, note.revision, user_api_key=user_api_key, trial=trial)
        except groq_service.ProviderFailure as error:
            results.append({'id': note.pk, 'status': 'failed', 'code': error.code})
            if error.code == 'trial_exhausted' or getattr(error, 'status_code', 0) == 429:
                stopped = 'trial_exhausted'
                break
            continue
        except Conflict:
            results.append({'id': note.pk, 'status': 'skipped', 'code': 'changed'})
            continue
        except ValidationError:
            results.append({'id': note.pk, 'status': 'failed', 'code': 'invalid'})
            continue
        if mode == 'verify':
            try:
                confirmed, skipped = confirm_all_drafts(note)
            except (Conflict, ValidationError):
                results.append({'id': note.pk, 'status': 'failed', 'code': 'verify_failed'})
                continue
            results.append({
                'id': note.pk, 'status': 'verified',
                'code': 'review_remaining' if skipped else 'ok',
            })
        else:
            results.append({'id': note.pk, 'status': 'analyzed', 'code': 'ok'})
    return {'mode': mode, 'results': results, 'stopped': stopped}
