from datetime import datetime, timedelta, timezone as dt_timezone
from types import SimpleNamespace
from unittest.mock import patch

import jwt
from cryptography.hazmat.primitives.asymmetric import ec
from django.test import TestCase, override_settings
from rest_framework import exceptions
from rest_framework.test import APIRequestFactory
from rest_framework.test import APITestCase

from .authentication import SupabaseJWTAuthentication
from .models import AppUser, UserAuthIdentity, UserPreference


class RememberedSessionTests(APITestCase):
    def setUp(self):
        self.user = AppUser.objects.create(email='remembered@example.com')
        patcher = patch.object(SupabaseJWTAuthentication, 'authenticate', return_value=(self.user, {}))
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_login_restores_for_72_hours_then_expires(self):
        self.assertEqual(self.client.get('/api/v1/auth/me/').status_code, 401)
        response = self.client.post('/api/v1/auth/session/start/', {}, format='json')
        self.assertEqual(response.status_code, 200)
        cookie = response.cookies['sessionid']
        self.assertTrue(cookie['httponly'])
        self.assertEqual(int(cookie['max-age']), 72 * 60 * 60)
        self.assertEqual(self.client.get('/api/v1/auth/me/').status_code, 200)

        session = self.client.session
        from django.utils import timezone
        session['login_at'] = timezone.now().timestamp() - 71 * 60 * 60
        session.save()
        self.assertEqual(self.client.get('/api/v1/auth/me/').status_code, 200)
        session = self.client.session
        session['login_at'] = timezone.now().timestamp() - 73 * 60 * 60
        session.save()
        self.assertEqual(self.client.get('/api/v1/auth/me/').status_code, 401)

    def test_logout_invalidates_cookie_and_blocks_other_users(self):
        self.client.post('/api/v1/auth/session/start/', {}, format='json')
        self.assertEqual(self.client.get('/api/v1/auth/me/').status_code, 200)
        self.client.post('/api/v1/auth/session/end/', {}, format='json')
        self.assertEqual(self.client.get('/api/v1/auth/me/').status_code, 401)

        self.client.post('/api/v1/auth/session/start/', {}, format='json')
        session = self.client.session
        session['app_user_id'] = 'different-user'
        session.save()
        self.assertEqual(self.client.get('/api/v1/auth/me/').status_code, 401)

    def test_cross_site_cookie_blocked_uses_revocable_72_hour_session_header(self):
        from django.utils import timezone

        response = self.client.post('/api/v1/auth/session/start/', {}, format='json')
        key = response.data['remembered_session']
        self.assertTrue(key)
        self.client.cookies.clear()  # Browser blocks the cross-site cookie.
        self.assertEqual(self.client.get('/api/v1/auth/me/').status_code, 401)
        self.client.credentials(HTTP_X_REMEMBERED_SESSION=key)
        self.assertEqual(self.client.get('/api/v1/auth/me/').status_code, 200)
        # The header is not a standalone credential: it is tied to the JWT user.
        other = AppUser.objects.create(email='other-remembered@example.com')
        with patch.object(SupabaseJWTAuthentication, 'authenticate', return_value=(other, {})):
            self.assertEqual(self.client.get('/api/v1/auth/me/').status_code, 401)
        store = self.client.session.__class__(session_key=key)
        store['login_at'] = timezone.now().timestamp() - 71 * 60 * 60
        store.save()
        self.assertEqual(self.client.get('/api/v1/auth/me/').status_code, 200)
        store = self.client.session.__class__(session_key=key)
        store['login_at'] = timezone.now().timestamp() - 73 * 60 * 60
        store.save()
        self.assertEqual(self.client.get('/api/v1/auth/me/').status_code, 401)

        response = self.client.post('/api/v1/auth/session/start/', {}, format='json')
        new_key = response.data['remembered_session']
        self.client.cookies.clear()
        self.client.credentials(HTTP_X_REMEMBERED_SESSION=new_key)
        self.assertEqual(self.client.get('/api/v1/auth/me/').status_code, 200)
        self.assertEqual(self.client.post('/api/v1/auth/session/end/', {}, format='json').status_code, 204)
        self.assertEqual(self.client.get('/api/v1/auth/me/').status_code, 401)

class SupabaseProvisioningTests(TestCase):
    def claims(self, subject='supabase-user-1', email='user@example.com'):
        return {
            'iss': 'https://project.supabase.co/auth/v1',
            'sub': subject,
            'aud': 'authenticated',
            'email': email,
            'email_confirmed': True,
        }

    def test_first_authenticated_identity_provisions_one_application_user(self):
        from .services.provisioning import provision_from_claims

        user = provision_from_claims(self.claims())
        self.assertEqual(AppUser.objects.count(), 1)
        self.assertEqual(UserAuthIdentity.objects.count(), 1)
        self.assertEqual(UserPreference.objects.count(), 1)
        self.assertEqual(user.email, 'user@example.com')
        self.assertEqual(provision_from_claims(self.claims()).pk, user.pk)
        self.assertEqual(AppUser.objects.count(), 1)

    def test_existing_email_is_not_implicitly_merged(self):
        from .services.provisioning import provision_from_claims

        AppUser.objects.create(email='user@example.com')
        with self.assertRaisesMessage(ValueError, 'explicit linking'):
            provision_from_claims(self.claims())

    def test_suspended_identity_is_rejected(self):
        from .services.provisioning import provision_from_claims

        user = provision_from_claims(self.claims())
        user.status = AppUser.Status.SUSPENDED
        user.save(update_fields=('status', 'updated_at'))
        with self.assertRaises(PermissionError):
            provision_from_claims(self.claims())

    def test_repeat_authentication_issues_no_writes_within_bucket(self):
        from django.utils import timezone

        from .services.provisioning import provision_from_claims

        user = provision_from_claims(self.claims())
        identity = UserAuthIdentity.objects.get(user=user)
        user.refresh_from_db()
        touched_at = user.updated_at
        with self.assertNumQueries(1):
            # Single joined identity+user lookup; no writes within the bucket.
            same = provision_from_claims(self.claims())
        self.assertEqual(same.pk, user.pk)
        user.refresh_from_db()
        self.assertEqual(user.updated_at, touched_at)
        identity.refresh_from_db()
        self.assertEqual(identity.last_seen_at.tzinfo is not None, True)

    def test_activity_touch_resumes_after_bucket_rollover(self):
        from datetime import timedelta

        from django.utils import timezone

        from .services import provisioning
        from .services.provisioning import provision_from_claims

        user = provision_from_claims(self.claims())
        stale = timezone.now() - timedelta(seconds=provisioning.LAST_SEEN_BUCKET_SECONDS + 5)
        UserAuthIdentity.objects.filter(user=user).update(last_seen_at=stale)
        AppUser.objects.filter(pk=user.pk).update(last_seen_at=stale, updated_at=stale)
        provision_from_claims(self.claims())
        user.refresh_from_db()
        identity = UserAuthIdentity.objects.get(user=user)
        self.assertGreater(identity.last_seen_at, stale)
        self.assertGreater(user.updated_at, stale)


@override_settings(
    SUPABASE_URL='https://project.supabase.co',
    SUPABASE_JWKS_URL='https://project.supabase.co/auth/v1/.well-known/jwks.json',
    SUPABASE_JWT_AUDIENCE='authenticated',
)
class SupabaseJWTAuthenticationTests(TestCase):
    def test_valid_es256_token_is_verified_and_provisioned(self):
        private_key = ec.generate_private_key(ec.SECP256R1())
        claims = {
            'iss': 'https://project.supabase.co/auth/v1',
            'sub': 'supabase-user-2',
            'aud': 'authenticated',
            'email': 'jwt@example.com',
            'iat': datetime.now(dt_timezone.utc),
            'exp': datetime.now(dt_timezone.utc) + timedelta(minutes=5),
        }
        token = jwt.encode(claims, private_key, algorithm='ES256', headers={'kid': 'test-key'})
        request = APIRequestFactory().get('/', HTTP_AUTHORIZATION=f'Bearer {token}')
        fake_key = SimpleNamespace(key=private_key.public_key())
        fake_client = SimpleNamespace(get_signing_key_from_jwt=lambda value: fake_key)

        with patch.object(SupabaseJWTAuthentication, '_client', return_value=fake_client):
            result = SupabaseJWTAuthentication().authenticate(request)

        self.assertEqual(result[0].email, 'jwt@example.com')
        self.assertEqual(result[1]['sub'], 'supabase-user-2')

    def test_wrong_issuer_is_rejected(self):
        private_key = ec.generate_private_key(ec.SECP256R1())
        claims = {
            'iss': 'https://attacker.example/auth/v1', 'sub': 'bad', 'aud': 'authenticated',
            'email': 'bad@example.com', 'iat': datetime.now(dt_timezone.utc),
            'exp': datetime.now(dt_timezone.utc) + timedelta(minutes=5),
        }
        token = jwt.encode(claims, private_key, algorithm='ES256')
        request = APIRequestFactory().get('/', HTTP_AUTHORIZATION=f'Bearer {token}')
        fake_key = SimpleNamespace(key=private_key.public_key())
        fake_client = SimpleNamespace(get_signing_key_from_jwt=lambda value: fake_key)
        with patch.object(SupabaseJWTAuthentication, '_client', return_value=fake_client):
            with self.assertRaises(Exception):
                SupabaseJWTAuthentication().authenticate(request)

    def test_expired_token_is_rejected(self):
        private_key = ec.generate_private_key(ec.SECP256R1())
        claims = {
            'iss': 'https://project.supabase.co/auth/v1', 'sub': 'expired-user', 'aud': 'authenticated',
            'email': 'expired@example.com', 'iat': datetime.now(dt_timezone.utc) - timedelta(minutes=10),
            'exp': datetime.now(dt_timezone.utc) - timedelta(minutes=5),
        }
        token = jwt.encode(claims, private_key, algorithm='ES256', headers={'kid': 'test-key'})
        request = APIRequestFactory().get('/', HTTP_AUTHORIZATION=f'Bearer {token}')
        fake_key = SimpleNamespace(key=private_key.public_key())
        fake_client = SimpleNamespace(get_signing_key_from_jwt=lambda value: fake_key)
        with patch.object(SupabaseJWTAuthentication, '_client', return_value=fake_client):
            with self.assertRaises(exceptions.AuthenticationFailed):
                SupabaseJWTAuthentication().authenticate(request)
        self.assertFalse(AppUser.objects.filter(email='expired@example.com').exists())

    def test_malformed_authorization_header_is_rejected(self):
        for header in ('Token abc123', 'Bearer', 'Bearer a b'):
            with self.subTest(header=header):
                request = APIRequestFactory().get('/', HTTP_AUTHORIZATION=header)
                with self.assertRaises(exceptions.AuthenticationFailed):
                    SupabaseJWTAuthentication().authenticate(request)

    @override_settings(SUPABASE_JWKS_URL='')
    def test_missing_jwks_configuration_is_rejected(self):
        request = APIRequestFactory().get('/', HTTP_AUTHORIZATION='Bearer anything')
        with self.assertRaises(exceptions.AuthenticationFailed):
            SupabaseJWTAuthentication().authenticate(request)
