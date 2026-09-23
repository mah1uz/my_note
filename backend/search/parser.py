"""Deterministic query parsing for lexical search and finance shortcuts."""
import re
from calendar import monthrange
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation

from django.utils import timezone


MAX_QUERY_LENGTH = 500
AGGREGATES = ('MAX', 'MIN', 'SUM', 'AVG', 'COUNT')

# Filler words carry no retrieval meaning. Without them, "do i have any
# exams?" matches any note containing "have" — including a toothpaste note.
STOPWORDS = frozenset({
    'a', 'an', 'the', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he',
    'she', 'it', 'they', 'them', 'this', 'that', 'these', 'those', 'is',
    'are', 'was', 'were', 'be', 'been', 'do', 'does', 'did', 'have',
    'has', 'had', 'having', 'can', 'could', 'will', 'would', 'should',
    'there', 'here', 'what', 'when', 'where', 'which', 'who', 'whom',
    'how', 'why', 'any', 'some', 'all', 'no', 'not', 'only', 'just',
    'very', 'too', 'so', 'than', 'then', 'and', 'or', 'but', 'if',
    'of', 'at', 'by', 'for', 'with', 'about', 'into', 'over', 'after',
    'before', 'between', 'out', 'up', 'down', 'in', 'on', 'to', 'from',
    'as', 's', 't',
})
MAX_CONTENT_TERMS = 10


def parse_query(query, *, today=None):
    query = str(query or '').strip()
    if len(query) > MAX_QUERY_LENGTH:
        raise ValueError('Search queries must be 500 characters or fewer.')
    lower = query.lower()
    amount_match = re.search(r'(?:over|above|more than|under|below|less than)\s+(?:৳|\$|bdt\s*|usd\s*)?(\d+(?:\.\d+)?)', lower)
    amount = None
    comparison = None
    if amount_match:
        try:
            amount = Decimal(amount_match.group(1))
        except InvalidOperation:
            amount = None
        phrase = lower[amount_match.start():amount_match.end()]
        comparison = 'gt' if phrase.startswith(('over', 'above', 'more')) else 'lt'
    currency = 'USD' if re.search(r'\b(?:usd|dollar|dollars)\b|\$', lower) else 'BDT' if re.search(r'\b(?:bdt|taka|tk)\b|৳', lower) else None
    direction = 'DEBIT' if re.search(r'\b(expense|expenses|spent|spend|debit|paid|bought)\b', lower) else 'CREDIT' if re.search(r'\b(income|salary|received|credit|earned)\b', lower) else None
    aggregate = next((name for name in AGGREGATES if re.search(rf'\b{name.lower()}\b|\b{dict(MAX="most", MIN="least", SUM="total", AVG="average", COUNT="count").get(name, "")}', lower)), None)
    if aggregate is None and re.search(r'how much|total|spent this month|income last month', lower):
        aggregate = 'SUM'
    if 'most' in lower:
        aggregate = 'MAX'
    today = today or timezone.localdate()
    date_from = date_to = None
    if 'this month' in lower:
        date_from = today.replace(day=1)
        date_to = today.replace(day=monthrange(today.year, today.month)[1])
    elif 'last month' in lower:
        previous = (today.replace(day=1) - timedelta(days=1))
        date_from = previous.replace(day=1)
        date_to = previous
    dates = re.findall(r'\b(20\d{2}-\d{2}-\d{2})\b', lower)
    if len(dates) == 1:
        date_from = date_to = date.fromisoformat(dates[0])
    elif len(dates) >= 2:
        date_from, date_to = date.fromisoformat(dates[0]), date.fromisoformat(dates[1])
    type_map = {'task': 'TASK', 'event': 'EVENT', 'shopping': 'SHOPPING', 'expense': 'EXPENSE', 'information': 'INFORMATION'}
    item_type = next((value for key, value in type_map.items() if re.search(rf'\b{key}s?\b', lower)), None)
    terms = re.findall(r'[\w৳$]+', lower, re.UNICODE)
    content_terms = [term for term in terms if len(term) > 2 and term not in STOPWORDS][:MAX_CONTENT_TERMS]
    return {
        'query': query, 'terms': terms, 'content_terms': content_terms,
        'direction': direction, 'currency': currency, 'amount': amount,
        'amount_comparison': comparison, 'aggregate': aggregate,
        'date_from': date_from, 'date_to': date_to, 'item_type': item_type,
    }
