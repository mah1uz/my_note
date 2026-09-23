from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from .models import AdminAuditEvent, AdminProfile, AppUser, ProAccessRequest

User = get_user_model()


def make_admin(role='ADMIN'):
    user = User.objects.create_user(username=f'pro-{role.lower()}', password='AdminPass!2026')
    AdminProfile.objects.create(django_user=user, role=role)
    return Token.objects.create(user=user)


class ProRequestUserTests(APITestCase):
    def setUp(self):
        self.user = AppUser.objects.create(email='pro@example.com', display_name='Pro User')
        self.client.force_authenticate(self.user)

    def test_create_returns_server_generated_code_and_links_user(self):
        response = self.client.post('/api/v1/auth/pro/request/', {'reason': 'Need more trial runs'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertRegex(response.data['code'], r'^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$')
        self.assertEqual(response.data['status'], 'PENDING')
        self.assertNotIn('id', response.data)
        stored = ProAccessRequest.objects.get(code=response.data['code'])
        self.assertEqual(stored.user, self.user)
        # Email comes from the verified account, never the payload.
        self.assertEqual(stored.user.email, 'pro@example.com')

    def test_duplicate_pending_returns_existing_without_new_token(self):
        first = self.client.post('/api/v1/auth/pro/request/', {'reason': 'First'}, format='json')
        second = self.client.post('/api/v1/auth/pro/request/', {'reason': 'Second'}, format='json')
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(first.data['code'], second.data['code'])
        self.assertEqual(ProAccessRequest.objects.filter(user=self.user).count(), 1)

    def test_get_current_and_empty_state(self):
        empty = self.client.get('/api/v1/auth/pro/request/')
        self.assertEqual(empty.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(empty.data['code'], 'pro_request_none')
        created = self.client.post('/api/v1/auth/pro/request/', {}, format='json')
        current = self.client.get('/api/v1/auth/pro/request/')
        self.assertEqual(current.data['code'], created.data['code'])

    def test_reason_validated_and_unauthenticated_rejected(self):
        too_long = self.client.post('/api/v1/auth/pro/request/', {'reason': 'x' * 501}, format='json')
        self.assertEqual(too_long.status_code, status.HTTP_400_BAD_REQUEST)
        self.client.force_authenticate(None)
        self.assertEqual(
            self.client.post('/api/v1/auth/pro/request/', {}, format='json').status_code,
            status.HTTP_401_UNAUTHORIZED,
        )


class ProRequestAdminTests(APITestCase):
    def setUp(self):
        self.token = make_admin()
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')
        self.user = AppUser.objects.create(email='managed@example.com', display_name='Managed')
        self.pro_request = ProAccessRequest.objects.create(user=self.user, code='ABCD2345', reason='Need')

    def test_list_detail_and_status_update_with_audit(self):
        listing = self.client.get('/api/v1/admin/pro-requests/')
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        entry = listing.data['results'][0]
        self.assertEqual(entry['user_email'], 'managed@example.com')
        self.assertEqual(entry['display_name'], 'Managed')
        detail = self.client.get(f"/api/v1/admin/pro-requests/{self.pro_request.code}/")
        self.assertEqual(detail.data['reason'], 'Need')
        patched = self.client.patch(
            f'/api/v1/admin/pro-requests/{self.pro_request.code}/',
            {'status': 'CONTACTED'}, format='json',
        )
        self.assertEqual(patched.data['status'], 'CONTACTED')
        self.assertIsNotNone(patched.data['decided_at'])
        self.pro_request.refresh_from_db()
        self.assertIsNotNone(self.pro_request.decided_at)
        event = AdminAuditEvent.objects.get(action='pro_request.updated')
        self.assertEqual(event.metadata['status'], 'CONTACTED')
        self.assertEqual(event.target_user, self.user)

    def test_status_filter_and_invalid_status_rejected(self):
        self.assertEqual(len(self.client.get('/api/v1/admin/pro-requests/?status=PENDING').data['results']), 1)
        self.assertEqual(self.client.get('/api/v1/admin/pro-requests/?status=BOGUS').status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            self.client.patch(
                f'/api/v1/admin/pro-requests/{self.pro_request.code}/',
                {'status': 'BOGUS'}, format='json',
            ).status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_codes_are_unique_and_normal_user_cannot_inspect_queue(self):
        other = AppUser.objects.create(email='other@example.com')
        ProAccessRequest.objects.create(user=other, code='WXYZ6789')
        codes = list(ProAccessRequest.objects.values_list('code', flat=True))
        self.assertEqual(len(codes), len(set(codes)))
        self.client.credentials()
        user = AppUser.objects.create(email='plain@example.com')
        self.client.force_authenticate(user)
        self.assertEqual(self.client.get('/api/v1/admin/pro-requests/').status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            self.client.get(f'/api/v1/admin/pro-requests/{self.pro_request.code}/').status_code,
            status.HTTP_403_FORBIDDEN,
        )
