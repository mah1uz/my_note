from rest_framework import status
from rest_framework.test import APITestCase

from .models import AppUser, UserPreference


class PreferenceApiTests(APITestCase):
    def setUp(self):
        self.user = AppUser.objects.create(email='prefs@example.com')
        self.other = AppUser.objects.create(email='other@example.com')
        self.client.force_authenticate(self.user)

    def test_unauthenticated_requests_are_rejected(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/v1/auth/preferences/').status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(
            self.client.patch('/api/v1/auth/preferences/', {'daily_briefing_enabled': False}, format='json').status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
        self.assertEqual(self.client.get('/api/v1/auth/me/').status_code, status.HTTP_401_UNAUTHORIZED)

    def test_get_returns_defaults_and_profile_shape(self):
        response = self.client.get('/api/v1/auth/preferences/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {
            'notification_enabled': False,
            'time_reminders_enabled': False,
            'location_reminders_enabled': False,
            'daily_briefing_enabled': True,
            'week_starts_on': 0,
        })
        me = self.client.get('/api/v1/auth/me/')
        self.assertEqual(me.data['email'], 'prefs@example.com')
        self.assertEqual(me.data['default_currency'], 'BDT')
        self.assertEqual(me.data['timezone'], 'Asia/Dhaka')

    def test_patch_updates_only_owned_preferences(self):
        response = self.client.patch(
            '/api/v1/auth/preferences/',
            {'daily_briefing_enabled': False, 'week_starts_on': 6},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['daily_briefing_enabled'])
        self.assertEqual(response.data['week_starts_on'], 6)
        preference = UserPreference.objects.get(user=self.user)
        self.assertFalse(preference.daily_briefing_enabled)
        self.assertFalse(UserPreference.objects.filter(user=self.other).exists())

    def test_patch_rejects_out_of_range_week_start(self):
        for value in (-1, 7):
            with self.subTest(value=value):
                response = self.client.patch(
                    '/api/v1/auth/preferences/', {'week_starts_on': value}, format='json',
                )
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patch_profile_updates_allowed_fields(self):
        response = self.client.patch('/api/v1/auth/me/', {
            'display_name': '  Prefs User  ',
            'timezone': 'UTC',
            'locale': 'en-US',
            'default_currency': 'USD',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'Prefs User')
        self.assertEqual(response.data['timezone'], 'UTC')
        self.assertEqual(response.data['default_currency'], 'USD')
        self.user.refresh_from_db()
        self.assertEqual(self.user.display_name, 'Prefs User')

    def test_settings_returns_profile_and_preferences_together(self):
        self.client.patch('/api/v1/auth/me/', {'display_name': 'Combo'}, format='json')
        response = self.client.get('/api/v1/auth/settings/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user']['name'], 'Combo')
        self.assertTrue(response.data['preferences']['daily_briefing_enabled'])
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/v1/auth/settings/').status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.post('/api/v1/auth/preferences/reset/', {}, format='json').status_code, status.HTTP_401_UNAUTHORIZED)

    def test_reset_restores_defaults_for_requesting_user_only(self):
        self.client.patch('/api/v1/auth/preferences/', {'daily_briefing_enabled': False, 'week_starts_on': 5}, format='json')
        self.client.patch('/api/v1/auth/me/', {'display_name': 'Custom', 'timezone': 'UTC', 'default_currency': 'USD'}, format='json')
        other_pref = UserPreference.objects.create(user=self.other, daily_briefing_enabled=False)
        response = self.client.post('/api/v1/auth/preferences/reset/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['preferences']['daily_briefing_enabled'])
        self.assertEqual(response.data['preferences']['week_starts_on'], 0)
        self.assertEqual(response.data['user']['timezone'], 'Asia/Dhaka')
        self.assertEqual(response.data['user']['default_currency'], 'BDT')
        self.assertEqual(response.data['user']['name'], 'prefs@example.com')
        other_pref.refresh_from_db()
        self.assertFalse(other_pref.daily_briefing_enabled)

    def test_patch_profile_rejects_invalid_values(self):
        for payload in (
            {'default_currency': 'usd'},
            {'default_currency': 'USDD'},
            {'timezone': 'Mars/Olympus'},
            {'timezone': ''},
        ):
            with self.subTest(payload=payload):
                response = self.client.patch('/api/v1/auth/me/', payload, format='json')
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertEqual(self.user.default_currency, 'BDT')
