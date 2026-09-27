from django.db import transaction
from django.utils import timezone

from accounts.models import UserAiEntitlement


class TrialUnavailable(Exception):
    """Raised when no trial quota remains. Callers map this to an API error."""


def _quota_fields(provider):
    from ai.services.providers import normalize_provider, provider_label

    provider = normalize_provider(provider)
    if provider == 'gemini':
        return provider, 'trial_gemini_used', 'trial_gemini_limit'
    return provider, 'trial_used', 'trial_limit'


@transaction.atomic
def consume_trial(user, provider='groq'):
    """Atomically consume one trial unit for the given provider.

    Quotas are tracked per provider, so usage or failures on one never
    starve the other. Race-safe via row-level locking.
    """
    from ai.services.providers import provider_label

    provider, used_field, limit_field = _quota_fields(provider)
    entitlement, _ = UserAiEntitlement.objects.select_for_update().get_or_create(user=user)
    now = timezone.now()
    if entitlement.trial_started_at is None:
        entitlement.trial_started_at = now
    if entitlement.trial_expires_at is not None and entitlement.trial_expires_at <= now:
        raise TrialUnavailable('The free trial period has expired. Enter a personal API key instead.')
    if getattr(entitlement, used_field) >= getattr(entitlement, limit_field):
        raise TrialUnavailable(
            f'The {provider_label(provider)} free trial quota is used up. Enter a personal API key instead.')
    setattr(entitlement, used_field, getattr(entitlement, used_field) + 1)
    entitlement.save(update_fields=(used_field, 'trial_started_at', 'updated_at'))
    return entitlement
