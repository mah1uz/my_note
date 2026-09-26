import os
import json
from pathlib import Path
from unittest.mock import patch

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
database_path = Path(__file__).resolve().parent / '.e2e.sqlite3'
database_path.unlink(missing_ok=True)
os.environ['DJANGO_DB_PATH'] = str(database_path)

import django

django.setup()

from django.core.management import call_command
from ai.services.groq_service import ProviderFailure
from notes.test_fixtures import EXAMPLES, example_output


def mock_analysis(raw_text, now, api_key=None, **kwargs):
    # Only this explicitly launched disposable E2E process uses a mock provider.
    # No application setting, request parameter, or production route enables it.
    if raw_text == 'E2E simulate AI timeout':
        raise ProviderFailure('timeout', 'Synthetic provider timeout.', 504)
    if raw_text == 'E2E zero items':
        return json.dumps({'summary': 'No items', 'items': []})
    if raw_text in EXAMPLES:
        return json.dumps(example_output(raw_text))
    raise ProviderFailure('test_fixture_missing', 'No provider fixture for this browser test.')

call_command('migrate', interactive=False, verbosity=0)
with patch('ai.services.groq_service.analyze_note', side_effect=mock_analysis):
    call_command('runserver', '127.0.0.1:8000', use_reloader=False)
