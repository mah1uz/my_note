from datetime import date
from decimal import Decimal

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import AppUser
from notes.models import Domain, Note, NoteItem

from .models import FinanceTransaction
from .services import summarize


def transaction_payload(**overrides):
    payload = {
        'direction': 'DEBIT',
        'amount': '250.00',
        'currency': 'BDT',
        'label': '  Books  ',
        'transaction_at': '2026-09-20T10:00:00+06:00',
    }
    payload.update(overrides)
    return payload


class FinanceTransactionApiTests(APITestCase):
    def setUp(self):
        self.user = AppUser.objects.create(email='finance@example.com')
        self.other = AppUser.objects.create(email='other@example.com')
        self.client.force_authenticate(self.user)

    def test_create_manual_transaction_trims_label_and_is_isolated(self):
        response = self.client.post('/api/v1/transactions/', transaction_payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['label'], 'Books')
        self.assertEqual(response.data['source_kind'], 'MANUAL')
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get('/api/v1/transactions/').data, [])
        self.assertEqual(
            self.client.get(f"/api/v1/transactions/{response.data['id']}/").status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_rejects_nonpositive_amount_invalid_direction_and_currency(self):
        for payload in (
            transaction_payload(amount='0'),
            transaction_payload(amount='-5'),
            transaction_payload(direction='INCOME'),
            transaction_payload(currency='bdt'),
            transaction_payload(currency='BDTT'),
            transaction_payload(label='   '),
        ):
            with self.subTest(payload=payload):
                response = self.client.post('/api/v1/transactions/', payload, format='json')
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(FinanceTransaction.objects.exists())

    def test_balance_uses_credits_minus_debits_per_currency(self):
        self.client.post('/api/v1/transactions/', transaction_payload(
            direction='CREDIT', amount='20000', label='Salary',
            transaction_at='2026-09-01T09:00:00+06:00'), format='json')
        self.client.post('/api/v1/transactions/', transaction_payload(
            amount='250.50', label='Books'), format='json')
        self.client.post('/api/v1/transactions/', transaction_payload(
            direction='CREDIT', amount='100', currency='USD', label='Gift',
            transaction_at='2026-09-05T09:00:00+06:00'), format='json')
        response = self.client.get('/api/v1/transactions/summary/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['currencies'], [
            {'currency': 'BDT', 'credits': '20000.0000', 'debits': '250.5000', 'balance': '19749.5000'},
            {'currency': 'USD', 'credits': '100.0000', 'debits': '0.0000', 'balance': '100.0000'},
        ])

    def test_month_boundary_uses_user_timezone(self):
        # 2026-08-31 18:30 UTC is 2026-09-01 00:30 in Asia/Dhaka.
        self.client.post('/api/v1/transactions/', transaction_payload(
            amount='500', label='Edge', transaction_at='2026-08-31T18:30:00+00:00'), format='json')
        response = self.client.get('/api/v1/transactions/summary/?date_from=2026-09-01&date_to=2026-09-30')
        self.assertEqual(len(response.data['currencies']), 1)
        self.assertEqual(response.data['currencies'][0]['debits'], '500.0000')
        response = self.client.get('/api/v1/transactions/summary/?date_from=2026-08-01&date_to=2026-08-31')
        self.assertEqual(response.data['currencies'], [])

    def test_opening_balance_limited_to_one_per_currency(self):
        url = '/api/v1/transactions/'
        first = self.client.post(url, transaction_payload(
            direction='CREDIT', amount='1000', label='Opening',
            source_kind='OPENING_BALANCE'), format='json')
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        second = self.client.post(url, transaction_payload(
            direction='CREDIT', amount='500', label='Again',
            source_kind='OPENING_BALANCE'), format='json')
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
        other_currency = self.client.post(url, transaction_payload(
            direction='CREDIT', amount='10', currency='USD', label='USD opening',
            source_kind='OPENING_BALANCE'), format='json')
        self.assertEqual(other_currency.status_code, status.HTTP_201_CREATED)

    def test_note_derived_transaction_links_source_and_blocks_duplicates(self):
        note = Note.objects.create(app_user=self.user, raw_text='Bought books')
        item = NoteItem.objects.create(note=note, item_type='EXPENSE', title='Books', is_confirmed=True)
        url = '/api/v1/transactions/'
        first = self.client.post(url, transaction_payload(note_item=item.pk), format='json')
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(first.data['source_kind'], 'AI_NOTE')
        duplicate = self.client.post(url, transaction_payload(note_item=item.pk, label='Again'), format='json')
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(FinanceTransaction.objects.filter(note_item=item).count(), 1)

    def test_note_derived_transaction_rejects_unconfirmed_and_foreign_items(self):
        own_note = Note.objects.create(app_user=self.user, raw_text='Draft')
        draft = NoteItem.objects.create(note=own_note, item_type='TASK', title='Draft')
        foreign_note = Note.objects.create(app_user=self.other, raw_text='Private')
        foreign = NoteItem.objects.create(note=foreign_note, item_type='TASK', title='Private', is_confirmed=True)
        url = '/api/v1/transactions/'
        for item_id in (draft.pk, foreign.pk, 999999):
            with self.subTest(item=item_id):
                response = self.client.post(url, transaction_payload(note_item=item_id), format='json')
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_source_item_delete_cascades_derived_transaction(self):
        note = Note.objects.create(app_user=self.user, raw_text='Bought books')
        item = NoteItem.objects.create(note=note, item_type='EXPENSE', title='Books', is_confirmed=True)
        self.client.post('/api/v1/transactions/', transaction_payload(note_item=item.pk), format='json')
        note.delete()
        self.assertFalse(FinanceTransaction.objects.exists())

    def test_edit_recalculates_summary_and_linkage_is_immutable(self):
        created = self.client.post('/api/v1/transactions/', transaction_payload(), format='json')
        url = f"/api/v1/transactions/{created.data['id']}/"
        patched = self.client.patch(url, {'amount': '100.00', 'direction': 'CREDIT'}, format='json')
        self.assertEqual(patched.status_code, status.HTTP_200_OK)
        summary = self.client.get('/api/v1/transactions/summary/')
        self.assertEqual(summary.data['currencies'][0]['balance'], '100.0000')
        note = Note.objects.create(app_user=self.user, raw_text='Other')
        item = NoteItem.objects.create(note=note, item_type='TASK', title='Other', is_confirmed=True)
        relink = self.client.patch(url, {'note_item': item.pk}, format='json')
        self.assertIsNone(relink.data['note_item'])

    def test_filters_and_primary_domain(self):
        shopping = Domain.objects.get(slug='shopping')
        self.client.post('/api/v1/transactions/', transaction_payload(primary_domain='shopping'), format='json')
        self.client.post('/api/v1/transactions/', transaction_payload(
            direction='CREDIT', amount='50', label='Refund'), format='json')
        self.assertEqual(len(self.client.get('/api/v1/transactions/?direction=DEBIT').data), 1)
        self.assertEqual(len(self.client.get('/api/v1/transactions/?primary_domain=shopping').data), 1)
        self.assertEqual(len(self.client.get('/api/v1/transactions/?currency=BDT').data), 2)


class FinanceServiceTests(TestCase):
    def test_summary_reads_ledger_not_noteitem_amounts(self):
        user = AppUser.objects.create(email='ledger@example.com')
        note = Note.objects.create(app_user=user, raw_text='Expensive sounding note')
        NoteItem.objects.create(
            note=note, item_type='EXPENSE', title='Yacht', amount=Decimal('999999'),
            currency='BDT', is_confirmed=True,
        )
        FinanceTransaction.objects.create(
            user=user, direction='DEBIT', amount=Decimal('250'),
            currency='BDT', label='Books', transaction_at='2026-09-20T10:00:00+06:00',
        )
        self.assertEqual(summarize(user)[0]['debits'], '250.0000')

    def test_summary_date_range_is_inclusive_per_user_timezone(self):
        user = AppUser.objects.create(email='range@example.com')
        for day, amount in ((date(2026, 9, 1), '10'), (date(2026, 9, 30), '20')):
            FinanceTransaction.objects.create(
                user=user, direction='DEBIT', amount=Decimal(amount),
                currency='BDT', label='x', transaction_at=f'{day}T12:00:00+06:00',
            )
        result = summarize(user, date_from=date(2026, 9, 1), date_to=date(2026, 9, 30))
        self.assertEqual(result[0]['debits'], '30.0000')
