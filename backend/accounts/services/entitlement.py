from django.db import transaction
from django.utils import timezone

from accounts.models import UserAiEntitlement


class TrialUnavailable(Exception):
    """Raised when no trial quota remains. Callers map this to an API error."""


@transaction.atomic
def consume_trial(user):
    """Atomically consume one trial unit. Race-safe via row-level locking."""
    entitlement, _ = UserAiEntitlement.objects.select_for_update().get_or_create(user=user)
    now = timezone.now()
    if entitlement.trial_started_at is None:
        entitlement.trial_started_at = now
    if entitlement.trial_expires_at is not None and entitlement.trial_expires_at <= now:
        raise TrialUnavailable('The free trial period has expired. Enter a personal API key instead.')
    if entitlement.trial_used >= entitlement.trial_limit:
        raise TrialUnavailable('The free trial quota is used up. Enter a personal API key instead.')
    entitlement.trial_used += 1
    entitlement.save(update_fields=('trial_used', 'trial_started_at', 'updated_at'))
    return entitlement
