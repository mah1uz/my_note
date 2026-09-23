from datetime import datetime, time
from decimal import Decimal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.conf import settings
from django.db.models import Case, DecimalField, Sum, When

from .models import FinanceTransaction


def local_day_bounds(user, day):
    """Resolve a calendar date in the user's timezone to an aware range."""
    try:
        zone = ZoneInfo(user.timezone)
    except (ZoneInfoNotFoundError, ValueError, TypeError):
        zone = ZoneInfo(settings.TIME_ZONE)
    start = datetime.combine(day, time.min).replace(tzinfo=zone)
    end = datetime.combine(day, time.max).replace(tzinfo=zone)
    return start, end


def summarize(user, queryset=None, date_from=None, date_to=None):
    """Deterministic per-currency totals. Currencies are never mixed."""
    queryset = queryset if queryset is not None else FinanceTransaction.objects.filter(user=user)
    if date_from is not None:
        start, _ = local_day_bounds(user, date_from)
        queryset = queryset.filter(transaction_at__gte=start)
    if date_to is not None:
        _, end = local_day_bounds(user, date_to)
        queryset = queryset.filter(transaction_at__lte=end)
    summaries = []
    currencies = queryset.order_by('currency').values_list('currency', flat=True).distinct()
    for currency in currencies:
        scoped = queryset.filter(currency=currency)
        totals = scoped.aggregate(
            credits=Sum(Case(
                When(direction=FinanceTransaction.Direction.CREDIT, then='amount'),
                default=Decimal('0'), output_field=DecimalField(max_digits=18, decimal_places=4),
            )),
            debits=Sum(Case(
                When(direction=FinanceTransaction.Direction.DEBIT, then='amount'),
                default=Decimal('0'), output_field=DecimalField(max_digits=18, decimal_places=4),
            )),
        )
        credits = totals['credits'] or Decimal('0')
        debits = totals['debits'] or Decimal('0')
        quantum = Decimal('0.0001')
        summaries.append({
            'currency': currency,
            'credits': str(credits.quantize(quantum)),
            'debits': str(debits.quantize(quantum)),
            'balance': str((credits - debits).quantize(quantum)),
        })
    return summaries
