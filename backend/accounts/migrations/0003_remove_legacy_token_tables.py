from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0002_adminprofile_adminauditevent_and_more'),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                'DROP TABLE IF EXISTS token_blacklist_blacklistedtoken CASCADE; '
                'DROP TABLE IF EXISTS token_blacklist_outstandingtoken CASCADE;'
            ),
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
