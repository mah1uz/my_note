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

# Same-day intent: any explicit indication the work is for today.
# Conservative: only fires on explicit today tokens, never on vague
# "soon/later". Used as a fallback signal when the provider leaves
# a TASK/EVENT undated.
DUE_TODAY_RE = re.compile(
    r'\b(today|tonight|this\s+morning|this\s+afternoon|this\s+evening|'
    r'by\s+today|by\s+tonight|before\s+tonight|end\s+of\s+day|eod)\b',
    re.I,
)

# Explicit clock time: "11pm", "11 pm", "11:30pm", "23:00".
TIME_RE = re.compile(
    r'\b(?:[01]?\d(?::[0-5]\d)?\s*(?:am|pm)|(?:[01]?\d|2[0-3]):[0-5]\d)\b',
    re.I,
)

# Timed gathering: meeting/class/appointment near an explicit time.
# Narrow verbs keep "meet friends someday" from matching.
TIMED_MEETING_RE = re.compile(
    r'\b(meeting|class|appointment|interview|lecture|exam|seminar|session)\b'
    r'[\w\s,]{0,30}?'
    r'(?:[01]?\d(?::[0-5]\d)?\s*(?:am|pm)|(?:[01]?\d|2[0-3]):[0-5]\d)\b'
    r'|(?:[01]?\d(?::[0-5]\d)?\s*(?:am|pm)|(?:[01]?\d|2[0-3]):[0-5]\d)'
    r'[\w\s,]{0,30}?\b(meeting|class|appointment|interview|lecture|exam|seminar|session)\b',
    re.I,
)

# Shopping acquisition: get/buy/pick up/purchase/order near explicit money.
# Catches "get a brush for 150 taka" where the verb alone is generic but
# the price makes the purchase intent explicit.
SHOPPING_ACQUIRE_RE = re.compile(
    r'\b(buy|get|pick\s+up|purchase|order)\b'
    r'[\w\s,]{0,40}?'
    r'(?:\u09f3|\$|BDT\s*|USD\s*)?\d+(?:\.\d+)?\s*'
    r'(?:k|thousand|lakh|lac|dollars?|taka|tk)?',
    re.I,
)

# Work duty nouns: "work", "shift", "duty", "homework". Used only together
# with an explicit today signal to rescue vague "i have work today" items
# the provider files as INFORMATION.
WORK_DUTY_RE = re.compile(r'\b(work|shift|duty|homework)\b', re.I)

# Gathering nouns: checked against a single item's own text so a meeting
# clause is never "corrected" into a task and vice versa.
EVENT_NOUN_RE = re.compile(
    r'\b(meeting|class|appointment|interview|lecture|exam|seminar|session)\b',
    re.I,
)

# Any other explicit date reference (tomorrow, weekday, month, calendar
# date). Guards the note-level due-today fallback: an item whose own text
# points at another day must not be forced onto today in multi-clause notes
# ("work today ... meeting tomorrow"). Bare clock numbers are excluded so
# quantities ("2 onions") do not count; require a date word or full date.
OTHER_DATE_RE = re.compile(
    r'\b(tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|'
    r'january|february|march|april|may|june|july|august|september|october|november|december|'
    r'\d{4}-\d{2}-\d{2}|\d{1,2}(st|nd|rd|th))\b',
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
        'due_today_hint': bool(DUE_TODAY_RE.search(text)),
        'timed_meeting_hint': bool(TIMED_MEETING_RE.search(text)),
        'shopping_acquire_hint': bool(SHOPPING_ACQUIRE_RE.search(text)),
        'work_duty_hint': bool(WORK_DUTY_RE.search(text)),
    }
