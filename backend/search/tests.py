from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.test import SimpleTestCase
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import AppUser
from finance.models import FinanceTransaction
from notes.models import Note, NoteItem

from .parser import parse_query


class SearchParserTests(SimpleTestCase):
    def test_explicit_finance_query_is_typed(self):
        parsed = parse_query('expenses over 1000 taka this month', today=date(2026, 9, 22))
        self.assertEqual(parsed['direction'], 'DEBIT')
        self.assertEqual(parsed['currency'], 'BDT')
        self.assertEqual(parsed['amount'], Decimal('1000'))
        self.assertEqual(parsed['amount_comparison'], 'gt')
        self.assertIsNone(parsed['aggregate'])
        self.assertEqual(parsed['date_from'], date(2026, 9, 1))

    def test_ambiguous_query_does_not_add_hard_finance_filters(self):
        parsed = parse_query('university things I should worry about')
        self.assertIsNone(parsed['direction'])
        self.assertIsNone(parsed['currency'])
        self.assertIsNone(parsed['amount'])

    def test_query_length_is_bounded(self):
        with self.assertRaises(ValueError):
            parse_query('x' * 501)


class SearchApiTests(APITestCase):
    def setUp(self):
        self.user = AppUser.objects.create(email='search@example.com')
        self.other = AppUser.objects.create(email='other-search@example.com')
        self.client.force_authenticate(self.user)
        note = Note.objects.create(app_user=self.user, raw_text='University deadline and books')
        NoteItem.objects.create(
            note=note, item_type='TASK', title='University deadline',
            summary='Submit the university project', is_confirmed=True,
        )
        other_note = Note.objects.create(app_user=self.other, raw_text='University private')
        NoteItem.objects.create(note=other_note, item_type='TASK', title='Private university task', is_confirmed=True)
        FinanceTransaction.objects.create(
            user=self.user, direction='DEBIT', amount=Decimal('1200'), currency='BDT',
            label='University books', transaction_at='2026-09-10T12:00:00+06:00',
        )

    def test_search_is_owner_scoped_and_returns_canonical_kinds(self):
        response = self.client.post('/api/v1/search/', {'query': 'university'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual({result['kind'] for result in response.data['results']}, {'NOTE_ITEM', 'TRANSACTION'})
        self.assertNotIn('Private university task', {result['title'] for result in response.data['results']})

    def test_deterministic_finance_answer_does_not_call_provider(self):
        # Views bind the service reference directly, so patch the name the view uses.
        with patch('search.views.generate_grounded_answer') as provider:
            response = self.client.post('/api/v1/search/answer/', {'query': 'how much did I spend this month?'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['mode'], 'deterministic')
        self.assertIn('1200.0000', response.data['answer'])
        provider.assert_not_called()

    def test_generated_answer_rejects_or_abstains_without_cross_user_sources(self):
        with patch('search.views.generate_grounded_answer', side_effect=RuntimeError('provider')):
            response = self.client.post('/api/v1/search/answer/', {'query': 'university'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['mode'], 'abstained')
        self.assertEqual(response.data['sources'], [])

    def test_search_requires_query(self):
        response = self.client.post('/api/v1/search/', {'query': ' '}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_stopwords_never_retrieve_on_their_own(self):
        parsed = parse_query('do i have any exams?')
        self.assertEqual(parsed['content_terms'], ['exams'])
        self.assertEqual(parse_query('do i have any')['content_terms'], [])

    def test_irrelevant_note_is_excluded_and_empty_abstains(self):
        toothpaste = Note.objects.create(app_user=self.user, raw_text='I have to buy toothpaste tomorrow.')
        NoteItem.objects.create(
            note=toothpaste, item_type='TASK', title='Buy toothpaste',
            summary='Pick up toothpaste', is_confirmed=True,
        )
        response = self.client.post('/api/v1/search/', {'query': 'do i have any exams?'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['results'], [])
        answer = self.client.post('/api/v1/search/answer/', {'query': 'do i have any exams?'}, format='json')
        self.assertEqual(answer.data['mode'], 'abstained')
        self.assertIn("couldn't find anything", answer.data['answer'])

    def test_title_match_outranks_raw_text_match(self):
        note = Note.objects.create(app_user=self.user, raw_text='university mentioned here')
        NoteItem.objects.create(note=note, item_type='TASK', title='Unrelated title', is_confirmed=True)
        response = self.client.post('/api/v1/search/', {'query': 'university'}, format='json')
        titles = [result['title'] for result in response.data['results']]
        self.assertLess(titles.index('University deadline'), titles.index('Unrelated title'))

    def test_finance_question_returns_ledger_rows_lexically(self):
        response = self.client.post('/api/v1/search/', {'query': 'how much did I spend this month?'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        kinds = [result['kind'] for result in response.data['results']]
        self.assertIn('TRANSACTION', kinds)
        self.assertEqual(response.data['results'][0]['title'], 'University books')

    def test_almost_does_not_trigger_max_aggregate(self):
        parsed = parse_query('I almost bought the dip')
        self.assertIsNone(parsed['aggregate'])
        self.assertEqual(parse_query('where did I spend the most?')['aggregate'], 'MAX')
