"""In-app notification evaluation. No scheduler exists in this project, so
evaluation runs server-side whenever the client polls the list endpoint.
Dedup keys make re-evaluation safe: repeated polls never duplicate rows."""

import logging
from calendar import monthrange
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation
from zoneinfo import ZoneInfo

from django.db import IntegrityError
from django.utils import timezone

from finance.services import summarize

logger = logging.getLogger(__name__)

DUE_WINDOW = timedelta(hours=48)
EXPENSE_THRESHOLD_KEY = 'expense_mom_threshold_pct'
EXPENSE_THRESHOLD_DEFAULT = Decimal('15')


def emit(user, type, title, message='', payload=None, dedup_key=None):
    """Create a notification, or return the existing row for a dedup key."""
    from .models import Notification

    if dedup_key:
        existing = Notification.objects.filter(user=user, dedup_key=dedup_key).first()
        if existing is not None:
            return existing, False
    try:
        return Notification.objects.create(
            user=user, type=type, title=title[:200], message=message[:500],
            payload=dict(payload or {}), dedup_key=dedup_key,
        ), True
    except IntegrityError:
        # Lost a race with another evaluation; return the winner.
        return Notification.objects.get(user=user, dedup_key=dedup_key), False


def get_expense_threshold_pct():
    from accounts.models import SystemSetting

    row = SystemSetting.objects.filter(key=EXPENSE_THRESHOLD_KEY).first()
    if row is None:
        return EXPENSE_THRESHOLD_DEFAULT
    try:
        value = Decimal(str(row.value))
    except (InvalidOperation, TypeError, ValueError):
        return EXPENSE_THRESHOLD_DEFAULT
    return value if value > 0 else EXPENSE_THRESHOLD_DEFAULT


def _user_today(user):
    try:
        zone = ZoneInfo(user.timezone)
    except Exception:
        zone = ZoneInfo('Asia/Dhaka')
    return timezone.now().astimezone(zone).date(), zone


def evaluate_due_tasks(user, today=None):
    """One row per open task due within 48h. Completed, cancelled,
    archived, and deleted tasks never match; changed due dates retire
    the stale unread row for the same item."""
    from notes.models import NoteItem
    from .models import Notification

    today = today or _user_today(user)[0]
    now = timezone.now()
    horizon = now + DUE_WINDOW
    created = []
    candidates = NoteItem.objects.filter(
        note__app_user=user, note__is_archived=False,
        is_confirmed=True, item_type='TASK', status='PENDING',
    ).select_related('note')
    for item in candidates:
        try:
            if _evaluate_one_due_task(user, item, today, now, horizon):
                created.append(item.pk)
        except Exception:
            logger.exception('Skipping bad due-task row for user %s', user.pk)
            continue
    return created


def _evaluate_one_due_task(user, item, today, now, horizon):
    from .models import Notification

    due_date, bucket = None, None
    if item.due_datetime is not None:
        if item.due_datetime < now or item.due_datetime > horizon:
            return False
        due_date = item.due_datetime.date()
        bucket = item.due_datetime.strftime('%Y-%m-%dT%H')
    elif item.due_date is not None:
        if item.due_date < today or item.due_date > (today + timedelta(days=2)):
            return False
        due_date = item.due_date
        bucket = item.due_date.isoformat()
    else:
        return False
    # A changed due date retires the previous unread reminder.
    Notification.objects.filter(
        user=user, type=Notification.Type.TASK_DUE_SOON,
        payload__note_item_id=item.pk, read_at__isnull=True,
    ).exclude(dedup_key=f'task_due:{item.pk}:{bucket}').delete()
    when = f"{due_date.strftime('%A, %B')} {due_date.day}"
    _, was_created = emit(
        user, Notification.Type.TASK_DUE_SOON, item.title,
        f'Due {when}.', {'note_item_id': item.pk, 'note_id': item.note_id},
        dedup_key=f'task_due:{item.pk}:{bucket}',
    )
    return was_created


def _month_bounds(today):
    first_this = today.replace(day=1)
    last_this = today.replace(day=monthrange(today.year, today.month)[1])
    last_prev = first_this - timedelta(days=1)
    first_prev = last_prev.replace(day=1)
    return (first_prev, last_prev), (first_this, last_this)


def _format_pct(ratio):
    pct = (ratio * 100).quantize(Decimal('0.1')).normalize()
    return f'{pct:f}'


def evaluate_expense_increase(user, today=None):
    """Locked rule: per currency, this month's DEBIT total vs last month's.

    Fires when the increase exceeds the configured threshold (default 15%).
    A zero baseline reports the amount, never a percentage. Equal or lower
    spending is always silent. At most one row per currency per month.
    """
    from .models import Notification

    today = today or _user_today(user)[0]
    (prev_from, prev_to), (this_from, this_to) = _month_bounds(today)
    threshold = get_expense_threshold_pct()
    previous = {row['currency']: Decimal(row['debits']) for row in summarize(user, date_from=prev_from, date_to=prev_to)}
    current = {row['currency']: Decimal(row['debits']) for row in summarize(user, date_from=this_from, date_to=this_to)}
    month_label = this_from.strftime('%B')
    prev_label = prev_from.strftime('%B')
    created = []
    for currency in sorted(set(previous) | set(current)):
        base = previous.get(currency, Decimal('0'))
        this = current.get(currency, Decimal('0'))
        if this <= 0 or this <= base:
            continue
        key = f'expense_mom:{currency}:{this_from.strftime("%Y-%m")}'
        if base <= 0:
            message = f'You spent {currency} {this.normalize():f} in {month_label}; {prev_label} had no recorded spending.'
        else:
            ratio = (this - base) / base
            if ratio * 100 <= threshold:
                continue
            message = (
                f'{month_label} spending is up {_format_pct(ratio)}% vs {prev_label} '
                f'({currency} {this.normalize():f} vs {currency} {base.normalize():f}).'
            )
        _, was_created = emit(
            user, Notification.Type.EXPENSE_INCREASED, 'Monthly spending increased',
            message, {'currency': currency, 'month': this_from.strftime('%Y-%m')},
            dedup_key=key,
        )
        if was_created:
            created.append(currency)
    return created


def notify_task_completed(user, item, revision):
    from .models import Notification

    return emit(
        user, Notification.Type.TASK_COMPLETED, f'Completed: {item.title}',
        'Marked complete.', {'note_item_id': item.pk, 'note_id': item.note_id},
        dedup_key=f'task_completed:{item.pk}:{revision}',
    )


def notify_pro_request_update(pro_request):
    from .models import Notification

    return emit(
        pro_request.user, Notification.Type.PRO_REQUEST_UPDATE,
        f'Pro request {pro_request.status.title()}',
        f'Request {pro_request.code} is now {pro_request.status.title()}.',
        {'pro_request_code': pro_request.code, 'status': pro_request.status},
        dedup_key=f'pro_request:{pro_request.code}:{pro_request.status}',
    )


def evaluate_for_user(user, today=None):
    """Run all evaluators, isolated so one failure never breaks the list."""
    for evaluator in (evaluate_due_tasks, evaluate_expense_increase):
        try:
            evaluator(user, today=today)
        except Exception:
            logger.exception('Notification evaluation failed for user %s', user.pk)
