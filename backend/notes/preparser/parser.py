"""Small, deterministic evidence extractor used as a review signal only."""
import re
from decimal import Decimal, InvalidOperation


MAX_INPUT_LENGTH = 12000
MONEY_RE = re.compile(
    r'(?P<prefix>৳|\$|BDT\s*|USD\s*)?(?P<number>\d+(?:\.\d+)?)\s*'
    r'(?P<scale>k|thousand|lakh|lac|dollars?|taka|tk)?', re.IGNORECASE,
)
DEBIT_RE = re.compile(r'\b(bought|purchased|spent|paid|cost|charged|bill|fee|rent|fare)\b', re.I)
CREDIT_RE = re.compile(r'\b(salary|received|credited|earned|income|refund|cashback|bonus|allowance)\b', re.I)
# Intent markers decide HOW money reads, not whether it exists.
# Future intent: a commitment where nothing has been spent yet.
FUTURE_INTENT_RE = re.compile(
    r'\b(have to|has to|need to|needs to|want to|plan to|planning to|going to|will|shall)\b'
    r'[\w\s,]{0,40}?\b(buy|get|pick up|purchase|pay|spend|order)\b'
    r'|\b(buy|get|pick up|purchase|pay|spend|order)\b[\w\s,]{0,20}?\b(tomorrow|later|next|soon|today)\b',
    re.I,
)
# Past spend: money already left. Any explicit past-tense spend verb counts,
# even without the DEBIT_RE nouns above (e.g. "bought" is covered by both).
PAST_SPEND_RE = re.compile(
    r'\b(bought|purchased|spent|paid|cost|charged|was charged)\b', re.I,
)


# Obligation tied to an explicit date: "submit the report on Friday",
# "have to visit campus tomorrow". Routes toward EVENT, never assumed.
OBLIGATION_DATE_RE = re.compile(
    r'\b(have to|has to|need to|needs to|must|should|due)\b'
    r'[\w\s,]{0,60}?'
    r'\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|'
    r'january|february|march|april|may|june|july|august|september|october|november|december|'
    r'\d{4}-\d{2}-\d{2}|\d{1,2}(st|nd|rd|th)?)\b',
    re.I,
)


def _amount(number, scale):
    try:
        amount = Decimal(number)
    except (InvalidOperation, TypeError):
        return None
    multiplier = {
        'k': Decimal('1000'), 'thousand': Decimal('1000'),
        'lakh': Decimal('100000'), 'lac': Decimal('100000'),
    }.get((scale or '').lower(), Decimal('1'))
    return amount * multiplier


def parse_money(text):
    """Return explicit money evidence without guessing ambiguous symbols."""
    matches = []
    for match in MONEY_RE.finditer(text):
        prefix = (match.group('prefix') or '').strip().upper()
        scale = (match.group('scale') or '').lower()
        if not prefix and not scale:
            continue
        if prefix == '$' or prefix.startswith('USD') or scale == 'dollar' or scale == 'dollars':
            currency = 'USD'
        elif prefix.startswith('BDT') or prefix == '৳' or scale in {'taka', 'tk'}:
            currency = 'BDT'
        else:
            currency = None
        amount = _amount(match.group('number'), scale)
        if amount is not None:
            matches.append({'amount': str(amount), 'currency': currency, 'text': match.group(0).strip()})
    return matches


def parse_note_evidence(text):
    """Extract only explicit facts; callers must not treat this as authoritative."""
    text = str(text or '')
    if len(text) > MAX_INPUT_LENGTH:
        text = text[:MAX_INPUT_LENGTH]
    debit = bool(DEBIT_RE.search(text))
    credit = bool(CREDIT_RE.search(text))
    future = bool(FUTURE_INTENT_RE.search(text))
    past = bool(PAST_SPEND_RE.search(text))
    # Intent is unknown when markers conflict or are absent entirely.
    intent = 'future' if future and not past else 'past' if past and not future else None
    return {
        'money': parse_money(text),
        'direction': 'DEBIT' if debit and not credit else 'CREDIT' if credit and not debit else None,
        'direction_ambiguous': debit and credit,
        'intent': intent,
        'intent_ambiguous': future and past,
        'task_hint': bool(re.search(r'\b(todo|need to|remember to|must|should)\b', text, re.I)),
        'event_hint': bool(re.search(r'\b(on|at|meeting|class|appointment|exam)\b', text, re.I)),
        'obligation_hint': bool(OBLIGATION_DATE_RE.search(text)),
        'shopping_hint': bool(re.search(r'\b(buy|bought|shopping|groceries|pick up)\b', text, re.I)),
    }
