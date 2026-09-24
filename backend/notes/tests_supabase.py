from rest_framework.test import APITestCase

from accounts.models import AppUser
from notes.models import Note


class SupabaseNoteOwnershipTests(APITestCase):
    def setUp(self):
        self.user_a = AppUser.objects.create(email='supabase-a@example.com')
        self.user_b = AppUser.objects.create(email='supabase-b@example.com')
        self.note_b = Note.objects.create(app_user=self.user_b, raw_text='Private B note')
        self.client.force_authenticate(user=self.user_a)

    def test_list_and_create_are_scoped_to_authenticated_app_user(self):
        response = self.client.get('/api/v1/notes/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['results'], [])

        response = self.client.post('/api/v1/notes/', {'raw_text': '  Private A note  '}, format='json')
        self.assertEqual(response.status_code, 201)
        note = Note.objects.get(pk=response.data['id'])
        self.assertEqual(note.app_user, self.user_a)
        self.assertEqual(note.raw_text, 'Private A note')

    def test_an_app_user_cannot_access_another_users_note(self):
        response = self.client.get(f'/api/v1/notes/{self.note_b.pk}/')
        self.assertEqual(response.status_code, 404)
