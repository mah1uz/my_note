"""Exact provider contract. Validate JSON before any serializer or database write."""
import json
from datetime import datetime

from jsonschema import Draft202012Validator, FormatChecker, ValidationError

from notes.constants import DOMAINS, IMPORTANCES, ITEM_TYPES, MAX_ITEMS


ITEM_PROPERTIES = {
    'type': {'type': 'string', 'enum': list(ITEM_TYPES)},
    'title': {'type': 'string', 'minLength': 1, 'maxLength': 200},
    'summary': {'type': 'string', 'maxLength': 500},
    'normalized_text': {'type': 'string', 'maxLength': 1000},
    'domains': {'type': 'array', 'maxItems': 9, 'uniqueItems': True,
                'items': {'type': 'string', 'enum': [slug for slug, _ in DOMAINS]}},
    'start_date': {'type': ['string', 'null'], 'format': 'date'},
    'due_date': {'type': ['string', 'null'], 'format': 'date'},
    'start_datetime': {'type': ['string', 'null'], 'format': 'date-time'},
    'due_datetime': {'type': ['string', 'null'], 'format': 'date-time'},
    'amount': {'type': ['number', 'null'], 'minimum': 0, 'maximum': 9999999999.99},
    'currency': {'type': ['string', 'null'], 'pattern': '^[A-Z]{3}$'},
    'quantity': {'type': ['number', 'null'], 'minimum': 0, 'maximum': 999999999.999},
    'unit': {'type': ['string', 'null'], 'maxLength': 20},
    'place_hint': {'type': ['string', 'null'], 'maxLength': 120},
    'importance': {'type': 'string', 'enum': list(IMPORTANCES)},
    'confidence': {'type': ['number', 'null'], 'minimum': 0, 'maximum': 1},
}

ANALYSIS_SCHEMA = {
    'type': 'object', 'required': ['summary', 'items'], 'additionalProperties': False,
    'properties': {
        'summary': {'type': 'string', 'maxLength': 500},
        'items': {
            'type': 'array', 'maxItems': MAX_ITEMS,
            'items': {'type': 'object', 'required': list(ITEM_PROPERTIES),
                      'additionalProperties': False, 'properties': ITEM_PROPERTIES},
        },
    },
}


class InvalidAnalysis(ValueError):
    pass


def reject_constant(value):
    raise ValueError('Non-finite JSON number')


def reject_duplicate_keys(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate JSON key')
        result[key] = value
    return result


def parse_analysis(raw):
    if not isinstance(raw, str) or len(raw) > 40000:
        raise InvalidAnalysis('The AI response was empty or too large.')
    try:
        data = json.loads(raw, parse_constant=reject_constant, object_pairs_hook=reject_duplicate_keys)
        Draft202012Validator(ANALYSIS_SCHEMA, format_checker=FormatChecker()).validate(data)
        # jsonschema's date-time checker is an optional dependency; enforce it here too.
        for item in data['items']:
            for field in ('start_datetime', 'due_datetime'):
                value = item[field]
                if value is not None:
                    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
                    if 'T' not in value or parsed.tzinfo is None or parsed.utcoffset() is None:
                        raise ValueError('Datetime requires an explicit UTC offset')
    except (ValueError, RecursionError, ValidationError) as error:
        # Do not forward validation messages containing user/provider content.
        raise InvalidAnalysis('The AI response did not match the required schema.') from error
    return data
