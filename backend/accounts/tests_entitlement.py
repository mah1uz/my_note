import json
from datetime import timedelta
from unittest.mock import patch

from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from notes.models import Note
from notes.test_fixtures import example_output

from .models import AppUser, UserAiEntitlement, UserPreference


@override_settings(GROQ_API_KEY='synthetic-test-key')
class AiEntitlementApiTests(APITestCase):
    def setUp(self):
        self.user = AppUser.objects.create(email='entitled@example.com')
        self.client.force_authenticate(self.user)
        self.note = Note.objects.create(app_user=self.user, raw_text='I need eggs from Agora.')
        self.provider = patch(
            'ai.services.groq_service.analyze_note',
            return_value=json.dumps(example_output('I need eggs from Agora.')),
        ).start()
        self.addCleanup(patch.stopall)

    def entitlement(self):
        entitlement, _ = UserAiEntitlement.objects.get_or_create(user=self.user)
        return entitlement

    def analyze_trial(self):
        self.note.refresh_from_db()
        return self.client.post(
            f'/api/v1/notes/{self.note.pk}/analyze/',
            {'revision': self.note.revision}, format='json', HTTP_X_GROQ_TRIAL='true',
        )

    def test_entitlement_endpoint_requires_auth_and_reports_defaults(self):
        response = self.client.get('/api/v1/auth/ai/entitlement/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['trial_limit'], 5)
        self.assertEqual(response.data['trial_used'], 0)
        self.assertEqual(response.data['remaining'], 5)
        self.client.force_authenticate(None)
        self.assertEqual(
            self.client.get('/api/v1/auth/ai/entitlement/').status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_provisioning_creates_entitlement_row(self):
        from .services.provisioning import provision_from_claims

        user = provision_from_claims({
            'iss': 'https://project.supabase.co/auth/v1', 'sub': 'trial-user-1',
            'email': 'trial1@example.com', 'email_confirmed': True,
        })
        entitlement = UserAiEntitlement.objects.get(user=user)
        self.assertEqual((entitlement.trial_limit, entitlement.trial_used), (5, 0))

    def test_trial_analyze_consumes_quota(self):
        self.assertEqual(self.analyze_trial().status_code, 200)
        self.assertEqual(self.analyze_trial().status_code, 200)
        response = self.client.get('/api/v1/auth/ai/entitlement/')
        self.assertEqual((response.data['trial_used'], response.data['remaining']), (2, 3))

    def test_exhausted_trial_is_rejected_without_touching_note(self):
        entitlement = self.entitlement()
        entitlement.trial_used = entitlement.trial_limit
        entitlement.save(update_fields=('trial_used', 'updated_at'))
        revision = self.note.revision
        response = self.analyze_trial()
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.data['code'], 'trial_exhausted')
        self.provider.assert_not_called()
        self.note.refresh_from_db()
        self.assertEqual(self.note.raw_text, 'I need eggs from Agora.')
        self.assertEqual(self.note.revision, revision)
        self.assertEqual(self.note.processing_status, 'UNPROCESSED')

    def test_expired_trial_is_rejected(self):
        entitlement = self.entitlement()
        entitlement.trial_expires_at = timezone.now() - timedelta(seconds=1)
        entitlement.save(update_fields=('trial_expires_at', 'updated_at'))
        response = self.analyze_trial()
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.data['code'], 'trial_exhausted')

    def test_personal_key_bypasses_quota(self):
        response = self.client.post(
            f'/api/v1/notes/{self.note.pk}/analyze/',
            {'revision': self.note.revision}, format='json',
            HTTP_X_GROQ_API_KEY='personal-session-key',
        )
        self.assertEqual(response.status_code, 200)
        entitlement = self.entitlement()
        self.assertEqual(entitlement.trial_used, 0)


class OnboardingApiTests(APITestCase):
    def setUp(self):
        self.user = AppUser.objects.create(email='onboarding@example.com')
        self.client.force_authenticate(self.user)

    def test_completion_persists_supported_choices_and_timestamp(self):
        response = self.client.post('/api/v1/auth/onboarding/complete/', {
            'profession': 'EMPLOYED', 'priority_profile': 'STUDY_FIRST', 'onboarding_tour_version': 1,
        }, format='json')
        self.assertEqual(response.status_code, 200)
        preference = UserPreference.objects.get(user=self.user)
        self.assertEqual(preference.profession, 'EMPLOYED')
        self.assertEqual(preference.priority_profile, 'STUDY_FIRST')
        self.assertIsNotNone(preference.onboarding_completed_at)

    def test_completion_rejects_unknown_priority(self):
        response = self.client.post('/api/v1/auth/onboarding/complete/', {
            'priority_profile': 'GUESS',
        }, format='json')
        self.assertEqual(response.status_code, 400)
