from django.db import migrations


LEGACY_TABLES = (
    'token_blacklist_blacklistedtoken',
    'token_blacklist_outstandingtoken',
)


def drop_legacy_tables(apps, schema_editor):
    """Remove retired simplejwt tables. `CASCADE` is PostgreSQL-only syntax."""
    vendor = schema_editor.connection.vendor
    with schema_editor.connection.cursor() as cursor:
        existing = set(schema_editor.connection.introspection.table_names(cursor))
    for table in LEGACY_TABLES:
        if table in existing:
            suffix = ' CASCADE' if vendor == 'postgresql' else ''
            schema_editor.execute(f'DROP TABLE IF EXISTS {table}{suffix}')


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0002_adminprofile_adminauditevent_and_more'),
    ]

    operations = [
        migrations.RunPython(drop_legacy_tables, migrations.RunPython.noop),
    ]
