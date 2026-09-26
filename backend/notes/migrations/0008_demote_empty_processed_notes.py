# Repair for notes stuck reading PROCESSED with nothing actionable behind
# them: no confirmed items (and no pending drafts) means nothing was ever
# organized, so the note returns to REVIEW_REQUIRED where retry paths apply.
# Notes with confirmed items are untouched. Idempotent and data-preserving:
# no rows are created or deleted.
from django.db import migrations


def demote_empty_processed_notes(apps, schema_editor):
    Note = apps.get_model('notes', 'Note')
    # PROCESSED with zero confirmed items (with or without pending drafts)
    # means nothing was ever organized: return to REVIEW_REQUIRED where the
    # retry paths apply. Item rows are never touched.
    Note.objects.filter(processing_status='PROCESSED').exclude(
        items__is_confirmed=True,
    ).update(processing_status='REVIEW_REQUIRED')


def noop_reverse(apps, schema_editor):
    # Demotion is informational only; re-promotion would need new analysis.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('notes', '0007_note_note_owner_created_idx'),
    ]

    operations = [
        migrations.RunPython(demote_empty_processed_notes, noop_reverse),
    ]
