"""Per-user encrypted Groq keys: storage, masking, precedence."""
import json
from types import SimpleNamespace
from unittest.mock import patch

from cryptography.fernet import Fernet
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import AppUser, UserAuthIdentity, UserGroqKey
from accounts.services import trial_keys, user_keys
from notes.models import Note

USER_SECRET = Fernet.generate_key().decode()


def make_user(email='maya@example.com'):
    user = AppUser.objects.create(email=email, display_name='Maya')
    UserAuthIdentity.objects.create(
        user=user, auth_system='SUPABASE', issuer='https://example.invalid/auth/v1',
        subject=f'sub-{email}',
    )
    return user


def auth_client(testcase, user):
    testcase.client.force_authenticate(user=user)
    return testcase.client


@override_settings(SERVER_KEY_SECRET=USER_SECRET)
class UserKeyServiceTests(TestCase):
    def test_roundtrip_masking_and_delete(self):
        user = make_user()
        row = user_keys.save_user_key(user, 'gsk_synthetic_personal_key_1234567890')
        self.assertEqual(row.key_hint, '7890')
        self.assertNotIn('gsk_synthetic', row.key_encrypted)
        self.assertEqual(user_keys.get_user_key_plaintext(user), 'gsk_synthetic_personal_key_1234567890')
        status = user_keys.user_key_status(user)
        self.assertEqual(status, {'has_key': True, 'masked': '••••7890', 'updated_at': status['updated_at']})
        self.assertTrue(status['updated_at'])
        user_keys.delete_user_key(user)
        self.assertEqual(user_keys.user_key_status(user), {'has_key': False, 'masked': '', 'updated_at': None})

    def test_rejects_bad_format(self):
        user = make_user('other@example.com')
        with self.assertRaises(ValueError):
            user_keys.save_user_key(user, 'not-a-key')
        self.assertEqual(UserGroqKey.objects.count(), 0)


@override_settings(SERVER_KEY_SECRET=USER_SECRET, GROQ_API_KEY='')
class UserKeyApiTests(APITestCase):
    def setUp(self):
        self.user = make_user()

    def test_key_crud_returns_masked_only(self):
        auth_client(self, self.user)
        self.assertEqual(self.client.get('/api/v1/auth/ai/key/').data, {'has_key': False, 'masked': '', 'updated_at': None})
        bad = self.client.post('/api/v1/auth/ai/key/', {'key': 'nope'}, format='json')
        self.assertEqual(bad.status_code, 400)
        created = self.client.post('/api/v1/auth/ai/key/', {'key': 'gsk_synthetic_personal_key_1234567890'}, format='json')
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data['masked'], '••••7890')
        self.assertNotIn('gsk_synthetic', json.dumps(created.data))
        fetched = self.client.get('/api/v1/auth/ai/key/').data
        self.assertTrue(fetched['has_key'])
        deleted = self.client.delete('/api/v1/auth/ai/key/')
        self.assertEqual(deleted.data['has_key'], False)
        self.assertEqual(self.client.get('/api/v1/auth/ai/key/').data['has_key'], False)


@override_settings(SERVER_KEY_SECRET=USER_SECRET, GROQ_API_KEY='')
class StoredKeyAnalyzeTests(TestCase):
    def test_stored_key_satisfies_credential_without_header_or_trial(self):
        from notes import services as note_services
        user = make_user('stored@example.com')
        user_keys.save_user_key(user, 'gsk_synthetic_personal_key_1234567890')
        note = Note.objects.create(app_user=user, raw_text='I have work today')
        undated_task = json.dumps({'summary': '', 'items': [{
            'type': 'TASK', 'title': 'Work', 'summary': '', 'normalized_text': '',
            'domains': [], 'start_date': None, 'due_date': None,
            'start_datetime': None, 'due_datetime': None, 'amount': None,
            'currency': None, 'quantity': None, 'unit': None, 'place_hint': None,
            'importance': 'NORMAL', 'confidence': 0.9,
        }]})
        with patch('ai.services.groq_service.Groq') as sdk:
            client = sdk.return_value.__enter__.return_value
            client.chat.completions.create.return_value = SimpleNamespace(choices=[SimpleNamespace(
                finish_reason='stop', message=SimpleNamespace(content=undated_task))])
            note_services.analyze(note, note.revision)
            self.assertEqual(sdk.call_args.kwargs['api_key'], 'gsk_synthetic_personal_key_1234567890')
        note.refresh_from_db()
        draft = note.items.filter(is_confirmed=False).get()
        self.assertEqual(str(draft.due_date), timezone.localtime(timezone.now()).date().isoformat())
