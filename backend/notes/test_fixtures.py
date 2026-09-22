"""Synthetic, deterministic provider responses shared by unit and browser tests."""
from copy import deepcopy


def prediction(item_type='TASK', title='Buy eggs', **changes):
    data = {
        'type': item_type, 'title': title, 'summary': '', 'normalized_text': title,
        'domains': ['shopping'], 'start_date': None, 'due_date': None,
        'start_datetime': None, 'due_datetime': None,
        'amount': None, 'currency': None, 'quantity': None, 'unit': None,
        'place_hint': None, 'importance': 'NORMAL', 'confidence': 0.94,
    }
    data.update(changes)
    return data


EXAMPLES = {
    'I have an EM quiz on September 23.': [prediction('EVENT', 'EM Quiz', domains=['education'], start_date='2026-09-23')],
    'I need eggs from Agora.': [prediction(place_hint='Agora')],
    'I bought 300gm chilli for 50 taka.': [prediction('EXPENSE', 'Chilli', domains=['shopping', 'finance'], amount=50, currency='BDT', quantity=300, unit='gram')],
    'Tomorrow class at 10, buy eggs afterwards, and today I spent 250 taka on books.': [
        prediction('EVENT', 'Class', domains=['education'], start_date='2026-09-22', summary='10 o’clock: AM/PM needs review.'),
        prediction(),
        prediction('EXPENSE', 'Books', domains=['education', 'finance'], amount=250, currency='BDT', start_date='2026-09-21'),
    ],
    'My project supervisor prefers weekly progress updates.': [prediction('INFORMATION', 'Weekly progress updates', domains=['education', 'work'])],
    'Get that thing from Rahim tomorrow.': [prediction('TASK', 'Get that thing from Rahim', domains=['other'], due_date='2026-09-22', confidence=0.35, summary='The object and exact time are unknown.')],
}


def example_output(text):
    return {'summary': 'Test fixture — not live AI output.', 'items': deepcopy(EXAMPLES[text])}
