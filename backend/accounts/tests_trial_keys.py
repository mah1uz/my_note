"""Admin-managed trial key pool: encryption, CRUD permissions, round-robin failover."""
import json

import httpx
from cryptography.fernet import Fernet
from django.test import TestCase, override_settings
from django.utils import timezone
from groq import RateLimitError
from rest_framework.test import APITestCase
from unittest.mock import patch
from types import SimpleNamespace

from ai.services import groq_service
from notes.models import Note
from notes.test_fixtures import example_output

from .models import AppUser, GroqServerKey
from .services import trial_keys

POOL_SECRET = Fernet.generate_key().decode()


def _success():
    return SimpleNamespace(choices=[SimpleNamespace(
        finish_reason='stop', message=SimpleNamespace(content='{"summary":"", "items":[]}'))])


def _rate_limit():
    request = httpx.Request('POST', 'https://example.invalid')
    return RateLimitError('synthetic', response=httpx.Response(429, request=request), body=None)


@override_settings(SERVER_KEY_SECRET=POOL_SECRET, GROQ_API_KEY='')
class TrialKeyServiceTests(TestCase):
    def _add(self, label='Key one'):
        return trial_keys.add_key(label, 'gsk_synthetic_key_value_1234567890')

    def test_roundtrip_and_masking(self):
        key = self._add()
        self.assertEqual(trial_keys.decrypt_key(key), 'gsk_synthetic_key_value_1234567890')
        self.assertEqual(trial_keys.masked(key), '••••7890')
        self.assertNotIn('gsk_synthetic', key.key_encrypted)

    def test_rejects_bad_format_without_storing(self):
        with self.assertRaises(ValueError):
            trial_keys.add_key('bad', 'not-a-key')
        self.assertEqual(GroqServerKey.objects.count(), 0)

    def test_missing_secret_disables_pool(self):
        with override_settings(SERVER_KEY_SECRET=''):
            with self.assertRaises(trial_keys.KeyMisconfigured):
                trial_keys.add_key('x', 'gsk_synthetic_key_value_1234567890')
            self.assertEqual(trial_keys.active_keys(), [])

    def test_round_robin_follows_least_recent_use(self):
        first = self._add('first')
        second = trial_keys.add_key('second', 'gsk_synthetic_second_key_0987654321')
        self.assertEqual([key.pk for key in trial_keys.active_keys()], [first.pk, second.pk])
        trial_keys.record_use(first)
        self.assertEqual([key.pk for key in trial_keys.active_keys()], [second.pk, first.pk])

    def test_env_fallback_counts_as_usable(self):
        self.assertFalse(trial_keys.has_usable_server_key())
        with override_settings(GROQ_API_KEY='synthetic-test-key'):
            self.assertTrue(trial_keys.has_usable_server_key())
        self._add()
        self.assertTrue(trial_keys.has_usable_server_key())

    @patch('ai.services.groq_service.Groq')
    def test_failover_to_next_key_then_env(self, sdk):
        client = sdk.return_value.__enter__.return_value
        first = self._add('first')
        second = trial_keys.add_key('second', 'gsk_synthetic_second_key_0987654321')
        client.chat.completions.create.side_effect = [_rate_limit(), _rate_limit(), _success()]
        with override_settings(GROQ_API_KEY='synthetic-env-fallback'):
            raw = groq_service.analyze_note('Buy eggs', timezone.now())
        self.assertEqual(raw, '{"summary":"", "items":[]}')
        used = [call.kwargs['api_key'] for call in sdk.call_args_list]
        self.assertEqual(used, [
            'gsk_synthetic_key_value_1234567890',
            'gsk_synthetic_second_key_0987654321',
            'synthetic-env-fallback',
        ])
        first.refresh_from_db()
        second.refresh_from_db()
        self.assertEqual(first.consecutive_failures, 1)
        self.assertEqual(second.consecutive_failures, 1)

    @patch('ai.services.groq_service.Groq')
    def test_three_strikes_auto_disables(self, sdk):
        client = sdk.return_value.__enter__.return_value
        key = self._add()
        client.chat.completions.create.side_effect = _rate_limit()
        for _ in range(3):
            with self.assertRaises(groq_service.ProviderFailure) as raised:
                groq_service.analyze_note('Buy eggs', timezone.now())
            self.assertEqual(raised.exception.code, 'rate_limit')
        key.refresh_from_db()
        self.assertFalse(key.is_active)
        self.assertEqual(key.disabled_reason, 'rate_limit')
        self.assertEqual(key.consecutive_failures, 3)

    @patch('ai.services.groq_service.Groq')
    def test_success_resets_failures(self, sdk):
        client = sdk.return_value.__enter__.return_value
        key = self._add()
        trial_keys.record_failure(key, 'rate_limit')
        client.chat.completions.create.return_value = _success()
        groq_service.analyze_note('Buy eggs', timezone.now())
        key.refresh_from_db()
        self.assertEqual(key.consecutive_failures, 0)
        self.assertEqual(key.use_count, 1)
        self.assertIsNotNone(key.last_used_at)


def _make_admin(username, super_admin=True):
    from django.contrib.auth import get_user_model
    from .models import AdminProfile
    user = get_user_model().objects.create_user(username=username, password='x' * 12)
    profile = AdminProfile.objects.create(
        django_user=user,
        role=AdminProfile.Role.SUPER_ADMIN if super_admin else AdminProfile.Role.ADMIN,
    )
    from rest_framework.authtoken.models import Token
    token = Token.objects.create(user=user)
    return profile, token.key


@override_settings(SERVER_KEY_SECRET=POOL_SECRET, GROQ_API_KEY='')
class TrialKeyAdminApiTests(APITestCase):
    def setUp(self):
        _, self.super_token = _make_admin('super1')
        _, self.admin_token = _make_admin('admin1', super_admin=False)

    def _auth(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token}')

    def test_list_requires_super_admin_and_masks_values(self):
        trial_keys.add_key('Pool A', 'gsk_synthetic_key_value_1234567890')
        self._auth(self.admin_token)
        self.assertEqual(self.client.get('/api/v1/admin/trial-keys/').status_code, 403)
        self.client.credentials()
        self.assertEqual(self.client.get('/api/v1/admin/trial-keys/').status_code, 401)
        self._auth(self.super_token)
        response = self.client.get('/api/v1/admin/trial-keys/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data[0]['masked'], '••••7890')
        self.assertNotIn('key_encrypted', response.data[0])
        self.assertNotIn('gsk_synthetic', json.dumps(response.data))

    def test_add_validates_and_never_echoes_key(self):
        self._auth(self.super_token)
        bad = self.client.post('/api/v1/admin/trial-keys/', {'label': 'x', 'key': 'nope'}, format='json')
        self.assertEqual(bad.status_code, 400)
        good = self.client.post(
            '/api/v1/admin/trial-keys/',
            {'label': 'Pool A', 'key': 'gsk_synthetic_key_value_1234567890'}, format='json',
        )
        self.assertEqual(good.status_code, 201)
        self.assertNotIn('gsk_synthetic', json.dumps(good.data))
        stored = GroqServerKey.objects.get()
        self.assertNotIn('gsk_synthetic', stored.key_encrypted)
        self.assertEqual(trial_keys.decrypt_key(stored), 'gsk_synthetic_key_value_1234567890')

    def test_toggle_and_delete(self):
        key = trial_keys.add_key('Pool A', 'gsk_synthetic_key_value_1234567890')
        self._auth(self.super_token)
        off = self.client.patch(f'/api/v1/admin/trial-keys/{key.pk}/', {'is_active': False}, format='json')
        self.assertEqual(off.status_code, 200)
        self.assertFalse(off.data['is_active'])
        removed = self.client.delete(f'/api/v1/admin/trial-keys/{key.pk}/')
        self.assertEqual(removed.status_code, 204)
        self.assertEqual(GroqServerKey.objects.count(), 0)

    def test_trial_gate_opens_with_pool_key_and_empty_env(self):
        user = AppUser.objects.create(email='pool@example.com')
        note = Note.objects.create(app_user=user, raw_text='I need eggs from Agora.')
        trial_keys.add_key('Pool A', 'gsk_synthetic_key_value_1234567890')
        self.client.force_authenticate(user)
        with patch(
            'ai.services.groq_service.analyze_note',
            return_value=json.dumps(example_output('I need eggs from Agora.')),
        ):
            response = self.client.post(
                f'/api/v1/notes/{note.pk}/analyze/',
                {'revision': note.revision}, format='json', HTTP_X_GROQ_TRIAL='true',
            )
        self.assertEqual(response.status_code, 200)
