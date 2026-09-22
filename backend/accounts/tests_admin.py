from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from notes.models import Note

from .models import AdminAuditEvent, AdminProfile, AppUser
from .services.ai_config import get_server_ai_enabled

User = get_user_model()


def make_admin(username='admin', role='ADMIN', active=True):
    user = User.objects.create_user(username=username, email=f'{username}@example.com', password='AdminPass!2026')
    profile = AdminProfile.objects.create(django_user=user, role=role, is_active=active)
    token = Token.objects.create(user=user)
    return user, profile, token


class AdminAuthTests(APITestCase):
    def test_login_logout_me_cycle(self):
        _, profile, _ = make_admin()
        login = self.client.post('/api/v1/admin/login/', {'username': 'admin', 'password': 'AdminPass!2026'}, format='json')
        self.assertEqual(login.status_code, status.HTTP_200_OK)
        self.assertEqual(login.data['admin']['role'], 'ADMIN')
        self.assertFalse(login.data['can_manage_admins'])
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {login.data['token']}")
        me = self.client.get('/api/v1/admin/me/')
        self.assertEqual(me.data['admin']['id'], str(profile.pk))
        logout = self.client.post('/api/v1/admin/logout/', {}, format='json')
        self.assertEqual(logout.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(self.client.get('/api/v1/admin/me/').status_code, status.HTTP_401_UNAUTHORIZED)

    def test_wrong_password_plain_user_and_inactive_admin_rejected(self):
        User.objects.create_user(username='plain', password='PlainPass!2026')
        make_admin(username='off', active=False)
        for payload in (
            {'username': 'admin', 'password': 'wrong'},
            {'username': 'plain', 'password': 'PlainPass!2026'},
            {'username': 'off', 'password': 'AdminPass!2026'},
        ):
            with self.subTest(payload=payload['username']):
                response = self.client.post('/api/v1/admin/login/', payload, format='json')
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class AdminUserManagementTests(APITestCase):
    def setUp(self):
        _, _, token = make_admin()
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
        self.user = AppUser.objects.create(email='managed@example.com', display_name='Managed')
        Note.objects.create(app_user=self.user, raw_text='Private content stays hidden')

    def test_list_search_filter_and_safe_shape(self):
        AppUser.objects.create(email='other@example.com')
        response = self.client.get('/api/v1/admin/users/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 2)
        entry = next(item for item in response.data['results'] if item['email'] == 'managed@example.com')
        self.assertEqual(entry['notes_count'], 1)
        self.assertNotIn('raw_text', str(entry))
        self.assertEqual(self.client.get('/api/v1/admin/users/?search=other').data['count'], 1)
        self.assertEqual(self.client.get('/api/v1/admin/users/?status=SUSPENDED').data['count'], 0)

    def test_update_status_and_profile_fields_with_audit(self):
        response = self.client.patch(f'/api/v1/admin/users/{self.user.pk}/', {
            'status': 'SUSPENDED', 'display_name': 'Renamed', 'default_currency': 'USD',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'SUSPENDED')
        self.user.refresh_from_db()
        self.assertEqual(self.user.status, 'SUSPENDED')
        event = AdminAuditEvent.objects.filter(action='user.updated', target_user=self.user).first()
        self.assertIsNotNone(event)
        self.assertIn('status', event.metadata['changed'])

    def test_invalid_status_currency_and_unknown_user_rejected(self):
        bad = self.client.patch(f'/api/v1/admin/users/{self.user.pk}/', {'status': 'DELETED'}, format='json')
        self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)
        bad = self.client.patch(f'/api/v1/admin/users/{self.user.pk}/', {'default_currency': 'usd'}, format='json')
        self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)
        missing = self.client.patch('/api/v1/admin/users/00000000-0000-4000-8000-000000000000/', {'status': 'SUSPENDED'}, format='json')
        self.assertEqual(missing.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_requires_confirm_and_removes_content(self):
        refused = self.client.delete(f'/api/v1/admin/users/{self.user.pk}/')
        self.assertEqual(refused.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(AppUser.objects.filter(pk=self.user.pk).exists())
        deleted = self.client.delete(f'/api/v1/admin/users/{self.user.pk}/?confirm=true')
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(AppUser.objects.filter(pk=self.user.pk).exists())
        self.assertFalse(Note.objects.exists())
        self.assertTrue(AdminAuditEvent.objects.filter(action='user.deleted').exists())

    def test_non_admin_token_and_anonymous_rejected(self):
        self.client.credentials()
        self.assertEqual(self.client.get('/api/v1/admin/users/').status_code, status.HTTP_401_UNAUTHORIZED)
        user = User.objects.create_user(username='plain', password='x')
        token = Token.objects.create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
        self.assertEqual(self.client.get('/api/v1/admin/users/').status_code, status.HTTP_403_FORBIDDEN)


class AdminManagementTests(APITestCase):
    def setUp(self):
        _, self.super_profile, super_token = make_admin(username='super', role='SUPER_ADMIN')
        _, _, admin_token = make_admin(username='regular')
        self.super_auth = f'Token {super_token.key}'
        self.admin_auth = f'Token {admin_token.key}'

    def test_only_super_admin_manages_admins(self):
        self.client.credentials(HTTP_AUTHORIZATION=self.admin_auth)
        self.assertEqual(self.client.get('/api/v1/admin/admins/').status_code, status.HTTP_403_FORBIDDEN)
        self.client.credentials(HTTP_AUTHORIZATION=self.super_auth)
        response = self.client.get('/api/v1/admin/admins/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_add_deactivate_and_change_role(self):
        self.client.credentials(HTTP_AUTHORIZATION=self.super_auth)
        created = self.client.post('/api/v1/admin/admins/', {
            'username': 'newbie', 'email': 'newbie@example.com',
            'password': 'StrongPass!2026', 'role': 'ADMIN',
        }, format='json')
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        profile = AdminProfile.objects.get(pk=created.data['id'])
        self.assertTrue(profile.django_user.check_password('StrongPass!2026'))
        self.assertTrue(profile.django_user.is_staff)
        self.assertFalse(profile.django_user.is_superuser)
        duplicate = self.client.post('/api/v1/admin/admins/', {
            'username': 'newbie', 'password': 'StrongPass!2026',
        }, format='json')
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)
        updated = self.client.patch(f"/api/v1/admin/admins/{profile.pk}/", {'is_active': False}, format='json')
        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        self.assertFalse(updated.data['is_active'])
        promoted = self.client.patch(f"/api/v1/admin/admins/{profile.pk}/", {'role': 'SUPER_ADMIN', 'is_active': True}, format='json')
        self.assertEqual(promoted.data['role'], 'SUPER_ADMIN')
        profile.django_user.refresh_from_db()
        self.assertTrue(profile.django_user.is_superuser)

    def test_cannot_change_own_record(self):
        self.client.credentials(HTTP_AUTHORIZATION=self.super_auth)
        response = self.client.patch(
            f'/api/v1/admin/admins/{self.super_profile.pk}/', {'is_active': False}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class AISettingsTests(APITestCase):
    def setUp(self):
        _, _, token = make_admin()
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    def test_switch_defaults_on_and_toggles_with_audit(self):
        self.assertTrue(get_server_ai_enabled())
        self.assertTrue(self.client.get('/api/v1/admin/ai-settings/').data['server_ai_enabled'])
        off = self.client.patch('/api/v1/admin/ai-settings/', {'server_ai_enabled': False}, format='json')
        self.assertEqual(off.status_code, status.HTTP_200_OK)
        self.assertFalse(off.data['server_ai_enabled'])
        self.assertFalse(get_server_ai_enabled())
        self.assertTrue(AdminAuditEvent.objects.filter(action='ai_settings.updated').exists())
        on = self.client.patch('/api/v1/admin/ai-settings/', {'server_ai_enabled': True}, format='json')
        self.assertTrue(on.data['server_ai_enabled'])

    def test_non_boolean_rejected(self):
        response = self.client.patch('/api/v1/admin/ai-settings/', {'server_ai_enabled': 'maybe'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
