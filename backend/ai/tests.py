"""Groq/Gemini provider abstraction: routing, validation, Gemini transport."""
import io
import json
import socket
import urllib.error
from unittest.mock import patch

from cryptography.fernet import Fernet
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from ai.services import providers
from ai.services.providers import ProviderFailure


def gemini_envelope(text='{"summary":"", "items":[]}', finish='STOP'):
    return {'candidates': [{'content': {'parts': [{'text': text}]}, 'finishReason': finish}]}


class FakeHttpResponse:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def read(self):
        return json.dumps(self.payload).encode('utf-8')


def http_error(code, body=''):
    return urllib.error.HTTPError(
        'https://generativelanguage.googleapis.com', code, 'error', {}, io.BytesIO(body.encode('utf-8')))


class NormalizeProviderTests(SimpleTestCase):
    def test_defaults_and_case(self):
        self.assertEqual(providers.normalize_provider(None), 'groq')
        self.assertEqual(providers.normalize_provider(''), 'groq')
        self.assertEqual(providers.normalize_provider('GROQ'), 'groq')
        self.assertEqual(providers.normalize_provider('gemini'), 'gemini')

    def test_unknown_provider_rejected(self):
        with self.assertRaises(ValueError):
            providers.normalize_provider('openai')


class KeyFormatTests(SimpleTestCase):
    def test_accepts_groq_and_gemini_shapes(self):
        self.assertTrue(providers.validate_key_format('gsk_synthetic_personal_key_1234567890', 'groq'))
        self.assertTrue(providers.validate_key_format('AIzaSyD-synthetic-gemini-key-123456', 'gemini'))
        self.assertTrue(providers.validate_key_format('some-future-llm-key-1234567890'))

    def test_rejects_short_long_and_blank(self):
        self.assertFalse(providers.validate_key_format('not-a-key'))
        self.assertFalse(providers.validate_key_format(''))
        self.assertFalse(providers.validate_key_format('x' * 201))


class RedactTests(SimpleTestCase):
    @override_settings(GROQ_API_KEY='gsk_server_secret_1234567890', GEMINI_API_KEY='AIzaServerSecret1234567890123456789')
    def test_redacts_both_providers(self):
        text = providers.redact(
            'keys gsk_server_secret_1234567890 and AIzaServerSecret1234567890123456789 '
            'and gsk_other_key_123 plus AIzaOtherKey1234567890123456789012345',
            extra_key='extra-secret-key-1234567890',
        )
        self.assertNotIn('gsk_server_secret_1234567890', text)
        self.assertNotIn('AIzaServerSecret', text)
        self.assertNotIn('extra-secret-key', text)
        self.assertIn('[REDACTED]', text)


@override_settings(GEMINI_MODEL='gemini-2.0-flash', GEMINI_TIMEOUT_SECONDS=20)
class GeminiServiceTests(SimpleTestCase):
    def test_success_returns_joined_text(self):
        from ai.services import gemini_service

        envelope = {'candidates': [{'content': {'parts': [{'text': '{"summary":"", '}, {'text': '"items":[]}'}]}, 'finishReason': 'STOP'}]}
        with patch.object(gemini_service.urllib.request, 'urlopen', return_value=FakeHttpResponse(envelope)):
            text = gemini_service.analyze_note('Buy eggs', timezone.now(), api_key='AIza-test-key-12345678901234567890')
        self.assertEqual(json.loads(text), {'summary': '', 'items': []})

    def test_missing_key_is_not_configured(self):
        from ai.services import gemini_service

        with self.assertRaises(ProviderFailure) as raised:
            gemini_service.analyze_note('Buy eggs', timezone.now())
        self.assertEqual(raised.exception.code, 'not_configured')

    def test_rejected_key_maps_to_invalid_key(self):
        from ai.services import gemini_service

        for code, body in (
            (401, 'Unauthorized'),
            (403, 'Forbidden'),
            (400, '{"error": {"message": "API key not valid. Pass a valid API key."}}'),
        ):
            with self.subTest(code=code), patch.object(
                gemini_service.urllib.request, 'urlopen', side_effect=http_error(code, body),
            ):
                with self.assertRaises(ProviderFailure) as raised:
                    gemini_service.analyze_note('Buy eggs', timezone.now(), api_key='AIza-bad-key-1234567890123456')
                self.assertEqual(raised.exception.code, 'invalid_key')
                self.assertEqual(raised.exception.status_code, 502)

    def test_restricted_or_blocked_key_maps_to_invalid_key_with_hint(self):
        from ai.services import gemini_service

        body = '{"error": {"message": "This API key is unrestricted. Restrict the key to the Gemini API."}}'
        with patch.object(gemini_service.urllib.request, 'urlopen', side_effect=http_error(400, body)):
            with self.assertRaises(ProviderFailure) as raised:
                gemini_service.analyze_note('Buy eggs', timezone.now(), api_key='AIza-test-key-12345678901234567890')
        self.assertEqual(raised.exception.code, 'invalid_key')
        self.assertIn('restrict', str(raised.exception).lower())

    def test_rate_limit_timeout_network_mapped(self):
        from ai.services import gemini_service

        cases = [
            (http_error(429, 'quota'), 'rate_limit', 503),
            (socket.timeout('timed out'), 'timeout', 504),
            (urllib.error.URLError('down'), 'network', 503),
        ]
        for error, code, status in cases:
            with self.subTest(code=code), patch.object(
                gemini_service.urllib.request, 'urlopen', side_effect=error,
            ):
                with self.assertRaises(ProviderFailure) as raised:
                    gemini_service.analyze_note('Buy eggs', timezone.now(), api_key='AIza-test-key-12345678901234567890')
                self.assertEqual(raised.exception.code, code)
                self.assertEqual(raised.exception.status_code, status)

    def test_empty_or_refused_response_is_incomplete(self):
        from ai.services import gemini_service

        for envelope in (gemini_envelope(text=''), gemini_envelope(finish='MAX_TOKENS'), {'candidates': []}):
            with self.subTest(envelope=str(envelope)[:40]), patch.object(
                gemini_service.urllib.request, 'urlopen', return_value=FakeHttpResponse(envelope),
            ):
                with self.assertRaises(ProviderFailure) as raised:
                    gemini_service.analyze_note('Buy eggs', timezone.now(), api_key='AIza-test-key-12345678901234567890')
                self.assertEqual(raised.exception.code, 'incomplete')


USER_SECRET = Fernet.generate_key().decode()


def make_user(email='maya@example.com'):
    from accounts.models import AppUser, UserAuthIdentity

    user = AppUser.objects.create(email=email, display_name='Maya')
    UserAuthIdentity.objects.create(
        user=user, auth_system='SUPABASE', issuer='https://example.invalid/auth/v1',
        subject=f'sub-{email}',
    )
    return user


@override_settings(SERVER_KEY_SECRET=USER_SECRET, GROQ_API_KEY='', GEMINI_API_KEY='')
class GeminiTrialPoolTests(TestCase):
    def test_pools_are_isolated_per_provider(self):
        from accounts.services import trial_keys

        trial_keys.add_key('Groq pool', 'gsk_synthetic_key_value_1234567890', provider='groq')
        trial_keys.add_key('Gemini pool', 'AIzaSyD-synthetic-gemini-key-12', provider='gemini')
        self.assertEqual([key.label for key in trial_keys.active_keys('groq')], ['Groq pool'])
        self.assertEqual([key.label for key in trial_keys.active_keys('gemini')], ['Gemini pool'])
        self.assertTrue(trial_keys.has_usable_server_key('groq'))
        self.assertTrue(trial_keys.has_usable_server_key('gemini'))

    def test_gemini_env_fallback_counts_as_usable(self):
        from accounts.services import trial_keys

        self.assertFalse(trial_keys.has_usable_server_key('gemini'))
        with override_settings(GEMINI_API_KEY='AIza-synthetic-env-key-123456789'):
            self.assertTrue(trial_keys.has_usable_server_key('gemini'))
            self.assertFalse(trial_keys.has_usable_server_key('groq'))


@override_settings(SERVER_KEY_SECRET=USER_SECRET, GROQ_API_KEY='', GEMINI_API_KEY='')
class GeminiAnalyzeFlowTests(TestCase):
    def test_dispatcher_routes_personal_gemini_key(self):
        from ai.services import gemini_service

        with patch.object(gemini_service, '_call_provider', return_value='{"summary":"", "items":[]}') as call:
            text = providers.analyze_note('Buy eggs', timezone.now(), api_key='AIza-key-12345678901234567890123', provider='gemini')
        self.assertEqual(text, '{"summary":"", "items":[]}')
        self.assertEqual(call.call_args.kwargs.get('tz_name'), None)

    def test_note_analyze_uses_gemini_model_and_prompt_version(self):
        from accounts.models import UserAiEntitlement
        from notes import services as note_services
        from notes.models import Note

        user = make_user('gemini-flow@example.com')
        UserAiEntitlement.objects.create(user=user, trial_limit=100)
        note = Note.objects.create(app_user=user, raw_text='I need eggs from Agora.')
        with patch('ai.services.providers.analyze_note', return_value='{"summary":"", "items":[]}') as dispatched:
            with patch('ai.services.gemini_service._call_provider') as gemini_call:
                # Personal-key path goes straight through the dispatcher.
                note_services.analyze(note, note.revision, user_api_key='AIza-key-12345678901234567890123', provider='gemini')
                self.assertEqual(dispatched.call_args.kwargs['provider'], 'gemini')
                gemini_call.assert_not_called()
        log = note.ai_logs.get()
        from django.conf import settings

        self.assertEqual(log.model_name, settings.GEMINI_MODEL)


@override_settings(SERVER_KEY_SECRET=USER_SECRET, GROQ_API_KEY='', GEMINI_API_KEY='')
class GeminiAnalyzeViewTests(APITestCase):
    def setUp(self):
        self.user = make_user('gemini-view@example.com')
        from accounts.models import UserAiEntitlement

        UserAiEntitlement.objects.create(user=self.user, trial_limit=100)
        from notes.models import Note

        self.note = Note.objects.create(app_user=self.user, raw_text='I need eggs from Agora.')
        self.client.force_authenticate(self.user)

    def test_unknown_provider_header_is_rejected(self):
        response = self.client.post(
            f'/api/v1/notes/{self.note.pk}/analyze/', {'revision': self.note.revision},
            format='json', HTTP_X_AI_PROVIDER='openai',
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['code'], 'invalid_provider')

    def test_gemini_headers_reach_gemini_provider(self):
        with patch('ai.services.providers.analyze_note', return_value='{"summary":"", "items":[]}') as dispatched:
            response = self.client.post(
                f'/api/v1/notes/{self.note.pk}/analyze/', {'revision': self.note.revision},
                format='json', HTTP_X_AI_PROVIDER='gemini',
                HTTP_X_AI_API_KEY='AIza-key-12345678901234567890123',
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(dispatched.call_args.kwargs['provider'], 'gemini')
        self.assertEqual(dispatched.call_args.kwargs['api_key'], 'AIza-key-12345678901234567890123')

    def test_legacy_groq_headers_still_route_to_groq(self):
        with patch('ai.services.providers.analyze_note', return_value='{"summary":"", "items":[]}') as dispatched:
            response = self.client.post(
                f'/api/v1/notes/{self.note.pk}/analyze/', {'revision': self.note.revision},
                format='json', HTTP_X_GROQ_API_KEY='gsk_legacy_personal_key_1234567890',
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(dispatched.call_args.kwargs['provider'], 'groq')

    def test_gemini_bulk_verify_uses_gemini_trial_pool(self):
        from accounts.services import trial_keys
        from notes.test_fixtures import example_output

        trial_keys.add_key('Gemini pool', 'AIzaSyD-synthetic-gemini-key-12', provider='gemini')
        with patch('ai.services.gemini_service._call_provider',
                   return_value=json.dumps(example_output('I need eggs from Agora.'))):
            response = self.client.post(
                '/api/v1/notes/process-all/', {'mode': 'verify'}, format='json',
                HTTP_X_AI_PROVIDER='gemini', HTTP_X_AI_TRIAL='true',
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['results'], [{'id': self.note.pk, 'status': 'analyzed', 'code': 'ok'}])
        self.assertEqual(trial_keys.GroqServerKey.objects.get().use_count, 1)


@override_settings(SERVER_KEY_SECRET=USER_SECRET, GROQ_API_KEY='', GEMINI_API_KEY='')
class GeminiPoolRotationTests(TestCase):
    def test_rate_limited_gemini_key_rotates_to_next_candidate(self):
        from ai.services import gemini_service
        from accounts.services import trial_keys

        first = trial_keys.add_key('Gemini one', 'AIzaSyD-synthetic-gemini-key-11', provider='gemini')
        second = trial_keys.add_key('Gemini two', 'AIzaSyD-synthetic-gemini-key-22', provider='gemini')
        failures = ProviderFailure('rate_limit', 'limited', 503)
        with patch.object(gemini_service, '_call_provider', side_effect=[failures, '{"summary":"", "items":[]}']) as call:
            text = providers.analyze_note('Buy eggs', timezone.now(), provider='gemini')
        self.assertEqual(text, '{"summary":"", "items":[]}')
        used_keys = [call.args[2] for call in call.call_args_list]
        self.assertEqual(used_keys, ['AIzaSyD-synthetic-gemini-key-11', 'AIzaSyD-synthetic-gemini-key-22'])
        first.refresh_from_db()
        second.refresh_from_db()
        self.assertEqual(first.consecutive_failures, 1)
        self.assertTrue(first.is_active)
        self.assertEqual(second.use_count, 1)
