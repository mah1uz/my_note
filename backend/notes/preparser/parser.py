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
    return {
        'money': parse_money(text),
        'direction': 'DEBIT' if debit and not credit else 'CREDIT' if credit and not debit else None,
        'direction_ambiguous': debit and credit,
        'task_hint': bool(re.search(r'\b(todo|need to|remember to|must|should)\b', text, re.I)),
        'event_hint': bool(re.search(r'\b(on|at|meeting|class|appointment|exam)\b', text, re.I)),
        'shopping_hint': bool(re.search(r'\b(buy|bought|shopping|groceries|pick up)\b', text, re.I)),
    }
