"""SQLite-friendly revision checks and atomic writes, never a transaction over HTTP."""
import json
from datetime import timedelta

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


class Conflict(APIException):
    status_code = 409
    default_detail = 'This note changed. Reload the review before trying again.'


def analysis_is_running(note):
    return bool(note.processing_status == 'PROCESSING' and note.analysis_started_at and
                note.analysis_started_at > timezone.now() - timedelta(seconds=settings.AI_ANALYSIS_LEASE_SECONDS))


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
    try:
        if user_api_key:
            provider_response = groq_service.analyze_note(note.raw_text, timezone.localtime(), api_key=user_api_key)
        else:
            provider_response = groq_service.analyze_note(note.raw_text, timezone.localtime())
        raw = groq_service.redact(provider_response, extra_key=user_api_key)
        payload = parse_analysis(raw)
        validated = []
        for predicted in payload['items']:
            data = {key: value for key, value in predicted.items() if key not in ('type', 'confidence')}
            data['item_type'] = predicted['type']
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
