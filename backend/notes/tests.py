from django.contrib import admin
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import AppUser
from .models import Note


class NoteModelTests(TestCase):
    def test_defaults_ordering_and_app_user_cascade(self):
        user = AppUser.objects.create(email='owner@example.com')
        older = Note.objects.create(app_user=user, raw_text='Older')
        newer = Note.objects.create(app_user=user, raw_text='Newer')
        self.assertEqual(Note.objects.first(), newer)
        self.assertEqual(older.processing_status, Note.ProcessingStatus.UNPROCESSED)
        user.delete()
        self.assertFalse(Note.objects.exists())

    def test_private_note_is_not_registered_in_admin(self):
        self.assertNotIn(Note, admin.site._registry)


class NoteApiTests(APITestCase):
    def setUp(self):
        self.user_a = AppUser.objects.create(email='a@example.com')
        self.user_b = AppUser.objects.create(email='b@example.com')
        self.note_a = Note.objects.create(app_user=self.user_a, raw_text='User A private note')
        self.note_b = Note.objects.create(app_user=self.user_b, raw_text='User B private note')

    def authenticate(self, user):
        self.client.force_authenticate(user)

    def test_unauthenticated_requests_are_rejected(self):
        self.assertEqual(self.client.get('/api/v1/notes/').status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_is_user_scoped_and_newest_first(self):
        Note.objects.create(app_user=self.user_a, raw_text='Newest A note')
        self.authenticate(self.user_a)
        response = self.client.get('/api/v1/notes/')
        self.assertEqual([item['raw_text'] for item in response.data['results']], ['Newest A note', 'User A private note'])

    def test_create_trims_text_sets_owner_and_unprocessed_status(self):
        self.authenticate(self.user_a)
        response = self.client.post('/api/v1/notes/', {'raw_text': '  Buy eggs  ', 'processing_status': 'PROCESSED'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        note = Note.objects.get(pk=response.data['id'])
        self.assertEqual(note.app_user, self.user_a)
        self.assertEqual(note.raw_text, 'Buy eggs')
        self.assertEqual(note.processing_status, Note.ProcessingStatus.UNPROCESSED)

    def test_blank_note_is_rejected(self):
        self.authenticate(self.user_a)
        response = self.client.post('/api/v1/notes/', {'raw_text': '   '}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_owner_can_retrieve_update_and_delete(self):
        self.authenticate(self.user_a)
        detail = f'/api/v1/notes/{self.note_a.pk}/'
        self.assertEqual(self.client.get(detail).status_code, status.HTTP_200_OK)
        update = self.client.patch(detail, {'raw_text': 'Updated note'}, format='json')
        self.assertEqual(update.data['raw_text'], 'Updated note')
        self.assertEqual(self.client.delete(detail).status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Note.objects.filter(pk=self.note_a.pk).exists())

    def test_user_b_cannot_retrieve_update_or_delete_user_a_note(self):
        self.authenticate(self.user_b)
        detail = f'/api/v1/notes/{self.note_a.pk}/'
        self.assertEqual(self.client.get(detail).status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.patch(detail, {'raw_text': 'Stolen'}, format='json').status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.delete(detail).status_code, status.HTTP_404_NOT_FOUND)
        self.note_a.refresh_from_db()
        self.assertEqual(self.note_a.raw_text, 'User A private note')

    def test_list_paginates_at_fifty_with_total_count(self):
        self.authenticate(self.user_a)
        for index in range(53):
            Note.objects.create(app_user=self.user_a, raw_text=f'Paginated note {index}')
        first = self.client.get('/api/v1/notes/')
        self.assertEqual(first.data['count'], 54)
        self.assertEqual(len(first.data['results']), 50)
        self.assertIsNotNone(first.data['next'])
        second = self.client.get('/api/v1/notes/?page=2')
        self.assertEqual(len(second.data['results']), 4)
        self.assertIsNone(second.data['next'])


class AdminAccessTests(TestCase):
    def setUp(self):
        from django.contrib.auth import get_user_model
        user_model = get_user_model()
        self.regular = user_model.objects.create_user(username='regular', password='SafePass!2026')
        self.admin_user = user_model.objects.create_superuser(username='admin', email='admin@example.com', password='AdminPass!2026')

    def test_anonymous_and_regular_users_cannot_access_admin_index(self):
        admin_url = reverse('admin:index')
        self.assertEqual(self.client.get(admin_url).status_code, status.HTTP_302_FOUND)
        self.client.force_login(self.regular)
        self.assertEqual(self.client.get(admin_url).status_code, status.HTTP_302_FOUND)

    def test_superuser_cannot_access_private_note_admin(self):
        self.client.force_login(self.admin_user)
        self.assertNotIn(Note, admin.site._registry)
