import os
from pathlib import Path

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
database_path = Path(__file__).resolve().parent / '.e2e.sqlite3'
database_path.unlink(missing_ok=True)
os.environ['DJANGO_DB_PATH'] = str(database_path)

import django

django.setup()

from django.core.management import call_command

call_command('migrate', interactive=False, verbosity=0)
call_command('runserver', '127.0.0.1:8000', use_reloader=False)
