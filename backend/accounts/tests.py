from urllib.parse import urlparse

from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class AuthenticationApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='user@example.com', email='user@example.com', password='SafePass!2026', first_name='Test User')

    def test_registration_sets_refresh_cookie_and_returns_limited_user(self):
        response = self.client.post('/api/v1/auth/register/', {'name': 'New User', 'email': 'NEW@example.com', 'password': 'StrongPass!2026', 'password_confirm': 'StrongPass!2026'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('access', response.data)
        self.assertNotIn('password', response.data['user'])
        self.assertTrue(response.cookies['rememberly_refresh']['httponly'])
        self.assertEqual(response.cookies['rememberly_refresh']['samesite'], 'Lax')
        self.assertEqual(response.cookies['rememberly_refresh']['path'], '/api/v1/auth/')
        self.assertEqual(User.objects.get(email='new@example.com').username, 'new@example.com')

    def test_registration_rejects_duplicate_email_and_password_mismatch(self):
        duplicate = self.client.post('/api/v1/auth/register/', {'name': 'Copy', 'email': 'USER@example.com', 'password': 'StrongPass!2026', 'password_confirm': 'StrongPass!2026'}, format='json')
        mismatch = self.client.post('/api/v1/auth/register/', {'name': 'New', 'email': 'new@example.com', 'password': 'StrongPass!2026', 'password_confirm': 'Different!2026'}, format='json')
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(mismatch.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_me_refresh_rotation_and_logout(self):
        login = self.client.post('/api/v1/auth/login/', {'identity': 'user@example.com', 'password': 'SafePass!2026'}, format='json')
        self.assertEqual(login.status_code, status.HTTP_200_OK)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        me = self.client.get('/api/v1/auth/me/')
        self.assertEqual(me.data['email'], 'user@example.com')
        self.client.credentials()
        first_cookie = login.cookies['rememberly_refresh'].value
        refresh = self.client.post('/api/v1/auth/refresh/', {}, format='json')
        self.assertEqual(refresh.status_code, status.HTTP_200_OK)
        self.assertNotEqual(first_cookie, refresh.cookies['rememberly_refresh'].value)
        logout = self.client.post('/api/v1/auth/logout/', {}, format='json')
        self.assertEqual(logout.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(logout.cookies['rememberly_refresh'].value, '')

    def test_invalid_login_and_missing_refresh_are_rejected(self):
        invalid = self.client.post('/api/v1/auth/login/', {'identity': 'user@example.com', 'password': 'wrong'}, format='json')
        self.client.cookies.clear()
        refresh = self.client.post('/api/v1/auth/refresh/', {}, format='json')
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(refresh.status_code, status.HTTP_401_UNAUTHORIZED)

    @override_settings(DEBUG=True, FRONTEND_URL='http://localhost:5173')
    def test_password_reset_is_generic_and_changes_password_with_valid_token(self):
        login = self.client.post('/api/v1/auth/login/', {'identity': self.user.email, 'password': 'SafePass!2026'}, format='json')
        old_access = login.data['access']
        missing = self.client.post('/api/v1/auth/password-reset/', {'email': 'missing@example.com'}, format='json')
        request = self.client.post('/api/v1/auth/password-reset/', {'email': self.user.email}, format='json')
        self.assertEqual(missing.data['detail'], request.data['detail'])
        self.assertNotIn('reset_url', missing.data)
        reset_path = urlparse(request.data['reset_url']).path.split('/')
        response = self.client.post('/api/v1/auth/password-reset/confirm/', {'uid': reset_path[-2], 'token': reset_path[-1], 'password': 'ChangedPass!2026', 'password_confirm': 'ChangedPass!2026'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('ChangedPass!2026'))
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {old_access}')
        self.assertEqual(self.client.get('/api/v1/auth/me/').status_code, status.HTTP_401_UNAUTHORIZED)
        self.client.credentials()
        self.assertEqual(self.client.post('/api/v1/auth/refresh/', {}, format='json').status_code, status.HTTP_401_UNAUTHORIZED)

    def test_auth_endpoints_reject_form_posts(self):
        response = self.client.post('/api/v1/auth/login/', {'identity': self.user.email, 'password': 'SafePass!2026'})
        self.assertEqual(response.status_code, status.HTTP_415_UNSUPPORTED_MEDIA_TYPE)

    def test_invalid_password_reset_token_is_rejected(self):
        response = self.client.post('/api/v1/auth/password-reset/confirm/', {'uid': 'invalid', 'token': 'invalid', 'password': 'ChangedPass!2026', 'password_confirm': 'ChangedPass!2026'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
