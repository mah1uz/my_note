from decimal import Decimal

from django.test import SimpleTestCase

from .parser import parse_note_evidence


class NotePreparserTests(SimpleTestCase):
    def test_supported_money_forms_use_decimal(self):
        evidence = parse_note_evidence('BDT 200, 20k, 1.5k, 2 lakh, $20, USD 20, 20 dollars')
        self.assertEqual(
            [(item['amount'], item['currency']) for item in evidence['money']],
            [('200', 'BDT'), ('20000', None), ('1500.0', None), ('200000', None),
             ('20', 'USD'), ('20', 'USD'), ('20', 'USD')],
        )

    def test_direction_is_unknown_when_cues_conflict_or_are_missing(self):
        self.assertIsNone(parse_note_evidence('5000 taka from Rahim')['direction'])
        evidence = parse_note_evidence('received a refund after I paid the fee')
        self.assertIsNone(evidence['direction'])
        self.assertTrue(evidence['direction_ambiguous'])

    def test_cues_are_case_and_unicode_safe(self):
        evidence = parse_note_evidence('I BOUGHT apples for ৳250 and need to remember them')
        self.assertEqual(evidence['direction'], 'DEBIT')
        self.assertEqual(evidence['money'][0]['currency'], 'BDT')
        self.assertTrue(evidence['task_hint'])

    def test_long_input_is_bounded(self):
        evidence = parse_note_evidence('x' * 50000)
        self.assertEqual(evidence['money'], [])

    def test_future_purchase_intent_is_not_a_spend(self):
        # The reported shampoo scenario: commitment, nothing spent yet.
        evidence = parse_note_evidence('i have to buy shampoo for 100 taka')
        self.assertEqual(evidence['intent'], 'future')
        self.assertTrue(evidence['shopping_hint'])
        self.assertIsNone(evidence['direction'])
        self.assertEqual(evidence['money'][0]['currency'], 'BDT')

    def test_future_intent_forms(self):
        for text in (
            'need to get rice 50 tk tomorrow',
            'will pay house rent 20000 taka next month',
            'planning to buy a phone for 20k soon',
            'must pick up medicine today, around 300 taka',
        ):
            with self.subTest(text=text):
                self.assertEqual(parse_note_evidence(text)['intent'], 'future')

    def test_past_spend_intent(self):
        for text in (
            'bought shampoo for 100 taka',
            'paid 1200 taka for internet yesterday',
            'spent 500 on transport',
        ):
            with self.subTest(text=text):
                evidence = parse_note_evidence(text)
                self.assertEqual(evidence['intent'], 'past')
                self.assertEqual(evidence['direction'], 'DEBIT')

    def test_vague_money_has_no_intent(self):
        evidence = parse_note_evidence('shampoo 100 taka')
        self.assertIsNone(evidence['intent'])
        self.assertFalse(evidence['intent_ambiguous'])
        self.assertTrue(evidence['money'])

    def test_conflicting_intent_markers_stay_unknown(self):
        evidence = parse_note_evidence('bought rice yesterday but have to buy oil for 200 taka')
        self.assertIsNone(evidence['intent'])
        self.assertTrue(evidence['intent_ambiguous'])

    def test_obligation_with_date_hints_event(self):
        for text in (
            'have to submit the report on Friday',
            'must visit campus tomorrow for admission',
            'project due 2026-10-05, need to prepare slides',
        ):
            with self.subTest(text=text):
                self.assertTrue(parse_note_evidence(text)['obligation_hint'])
        self.assertFalse(parse_note_evidence('buy shampoo')['obligation_hint'])
