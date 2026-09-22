from django.db import migrations, models


def require_app_user_ownership(apps, schema_editor):
    Note = apps.get_model('notes', 'Note')
    if Note.objects.filter(app_user__isnull=True).exists():
        raise RuntimeError(
            'Cannot remove legacy Note.user ownership while unowned notes exist. '
            'Assign every note to an AppUser before rerunning this migration.'
        )


class Migration(migrations.Migration):
    dependencies = [
        ('notes', '0005_alter_note_user'),
    ]

    operations = [
        migrations.RunPython(require_app_user_ownership, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='note',
            name='app_user',
            field=models.ForeignKey(
                on_delete=models.deletion.CASCADE,
                related_name='notes',
                to='accounts.appuser',
            ),
        ),
        migrations.RemoveField(
            model_name='note',
            name='user',
        ),
    ]
