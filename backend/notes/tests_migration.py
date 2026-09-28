from datetime import timedelta
from importlib import import_module
from types import SimpleNamespace

from django.apps import apps
from django.db import connection
from django.test import TestCase
from django.utils import timezone

from accounts.models import AppUser
from .models import Domain, Note, NoteItem


class MedicineCategoryCorrectionTests(TestCase):
    def test_corrects_only_reported_single_item_medicine_obligation(self):
        owner = AppUser.objects.create(email='med-category@example.com', timezone='Asia/Dhaka')
        note = Note.objects.create(app_user=owner, raw_text='i have to take my med tomorrow',
                                   processing_status='PROCESSED', revision=5)
        medicine = NoteItem.objects.create(note=note, item_type='TASK', title='Take my med',
                                           is_confirmed=True)
        shopping_note = Note.objects.create(app_user=owner, raw_text='i have to take my med tomorrow and buy pills',
                                            processing_status='PROCESSED')
        shopping = NoteItem.objects.create(note=shopping_note, item_type='TASK', title='Buy meds',
                                           is_confirmed=True)
        domain, _ = Domain.objects.get_or_create(slug='shopping', defaults={'name': 'Shopping'})
        shopping.domains.add(domain)
        mixed_note = Note.objects.create(app_user=owner, raw_text='i have to take my med tomorrow and file taxes',
                                         processing_status='PROCESSED')
        mixed = NoteItem.objects.create(note=mixed_note, item_type='TASK', title='Take my med',
                                        is_confirmed=True)
        NoteItem.objects.create(note=mixed_note, item_type='TASK', title='File taxes', is_confirmed=True)

        migration = import_module('notes.migrations.0010_correct_confirmed_medicine_obligation')
        migration.correct_medicine_obligation(apps, SimpleNamespace(connection=connection))
        medicine.refresh_from_db()
        note.refresh_from_db()
        shopping.refresh_from_db()
        mixed.refresh_from_db()
        self.assertEqual(medicine.item_type, 'EVENT')
        self.assertEqual(medicine.start_date, timezone.localtime(note.created_at,
                         timezone.get_fixed_timezone(6 * 60)).date() + timedelta(days=1))
        self.assertEqual(note.revision, 6)
        self.assertEqual(shopping.item_type, 'TASK')
        self.assertEqual(mixed.item_type, 'TASK')
