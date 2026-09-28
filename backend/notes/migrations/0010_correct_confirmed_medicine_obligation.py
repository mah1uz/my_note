"""Correct previously confirmed single-item medicine obligations, not arbitrary tasks.

Confirmed items are normally user-owned snapshots. This one-time correction is
limited to the reported phrasing, and leaves mixed notes and shopping alone.
"""
import re
from datetime import timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.db import migrations
from django.db.models import F
from django.utils import timezone


MEDICINE_TOMORROW = re.compile(
    r'\b(?:i\s+)?have to take (?:my )?med(?:s|icine|ication)? tomorrow\b', re.I,
)


def correct_medicine_obligation(apps, schema_editor):
    Note = apps.get_model('notes', 'Note')
    NoteItem = apps.get_model('notes', 'NoteItem')
    now = timezone.now()
    for note in Note.objects.using(schema_editor.connection.alias).filter(
            raw_text__icontains='tomorrow', processing_status='PROCESSED').select_related('app_user').iterator():
        if not MEDICINE_TOMORROW.search(note.raw_text):
            continue
        candidates = list(NoteItem.objects.using(schema_editor.connection.alias).filter(note_id=note.pk)
                          .prefetch_related('domains'))
        if len(candidates) != 1:
            continue
        item = candidates[0]
        if (not item.is_confirmed or item.item_type != 'TASK' or item.amount is not None
                or any(domain.slug == 'shopping' for domain in item.domains.all())
                or not re.search(r'\b(med|meds|medicine|medication)\b',
                                 ' '.join((item.title, item.summary, item.normalized_text)), re.I)):
            continue
        # Keep an existing date if the analyzer got it right, otherwise resolve
        # "tomorrow" relative to capture time in the account's timezone.
        if not item.start_date and not item.start_datetime:
            item.start_date = item.due_date
            item.start_datetime = item.due_datetime
            if not item.start_date and not item.start_datetime:
                try:
                    zone = ZoneInfo(note.app_user.timezone)
                except (ZoneInfoNotFoundError, ValueError, TypeError):
                    zone = ZoneInfo('UTC')
                item.start_date = note.created_at.astimezone(zone).date() + timedelta(days=1)
        item.due_date = None
        item.due_datetime = None
        item.item_type = 'EVENT'
        item.metadata = {**(item.metadata or {}), 'corrected_category': 'dated_medicine_obligation'}
        item.metadata.pop('tense_conflict', None)
        item.updated_at = now
        item.save(using=schema_editor.connection.alias, update_fields=[
            'item_type', 'start_date', 'start_datetime', 'due_date', 'due_datetime', 'metadata', 'updated_at',
        ])
        Note.objects.using(schema_editor.connection.alias).filter(pk=note.pk).update(
            revision=F('revision') + 1, updated_at=now)


class Migration(migrations.Migration):
    dependencies = [('notes', '0009_note_ai_title')]

    operations = [migrations.RunPython(correct_medicine_obligation, migrations.RunPython.noop)]
