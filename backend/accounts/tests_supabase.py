from datetime import datetime, timedelta, timezone as dt_timezone
from types import SimpleNamespace
from unittest.mock import patch

import jwt
from cryptography.hazmat.primitives.asymmetric import ec
from django.test import TestCase, override_settings
from rest_framework import exceptions
from rest_framework.test import APIRequestFactory

from .authentication import SupabaseJWTAuthentication
from .models import AppUser, UserAuthIdentity, UserPreference


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
