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
