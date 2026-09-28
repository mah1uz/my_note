from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('notes', '0008_demote_empty_processed_notes'),
    ]

    operations = [
        migrations.AddField(
            model_name='note',
            name='ai_title',
            field=models.CharField(blank=True, default='', max_length=120),
        ),
    ]
