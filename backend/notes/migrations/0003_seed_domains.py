from django.db import migrations


def seed_domains(apps, schema_editor):
    Domain = apps.get_model('notes', 'Domain')
    for name in ('Education', 'Shopping', 'Finance', 'Work', 'Personal', 'Health', 'Entertainment', 'Travel', 'Other'):
        Domain.objects.using(schema_editor.connection.alias).get_or_create(slug=name.lower(), defaults={'name': name})


class Migration(migrations.Migration):
    dependencies = [('notes', '0002_part3_intelligence')]
    operations = [migrations.RunPython(seed_domains, migrations.RunPython.noop)]
