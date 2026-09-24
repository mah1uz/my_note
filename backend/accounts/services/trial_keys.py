"""Server-owned Groq key pool for the free trial.

Plaintext keys live only in transit: they arrive over the admin API,
are Fernet-encrypted before the first write, and are decrypted only
inside the provider call. Nothing here ever logs or returns key
material — callers get masked hints plus metadata.
"""
from cryptography.fernet import Fernet, InvalidToken

from django.conf import settings
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from accounts.models import GroqServerKey


class KeyMisconfigured(Exception):
    """SERVER_KEY_SECRET is missing or invalid; pool management is offline."""


MAX_FAILURES = 3


def _fernet():
    secret = (getattr(settings, 'SERVER_KEY_SECRET', '') or '').strip()
    if not secret:
        raise KeyMisconfigured(
            'SERVER_KEY_SECRET is not configured. Set it to use admin-managed trial keys; '
            'the .env GROQ_API_KEY fallback keeps working without it.'
        )
    try:
        return Fernet(secret.encode('utf-8'))
    except (ValueError, TypeError) as error:
        raise KeyMisconfigured('SERVER_KEY_SECRET is not a valid Fernet key.') from error


def encrypt_key(raw):
    return _fernet().encrypt(str(raw).encode('utf-8')).decode('utf-8')


def decrypt_key(key):
    try:
        return _fernet().decrypt(key.key_encrypted.encode('utf-8')).decode('utf-8')
    except (InvalidToken, ValueError, AttributeError) as error:
        raise KeyMisconfigured('A stored trial key could not be decrypted.') from error


def masked(key):
    return f'••••{key.key_hint}' if key.key_hint else '••••'


def validate_format(raw):
    """Cheap shape check only — no provider call, no quota spent."""
    value = str(raw or '').strip()
    if len(value) < 20 or len(value) > 200:
        return False
    return value.startswith('gsk_')


@transaction.atomic
def add_key(label, raw, admin_profile=None):
    value = str(raw or '').strip()
    if not validate_format(value):
        raise ValueError('That does not look like a Groq API key.')
    return GroqServerKey.objects.create(
        label=str(label or '').strip()[:80] or 'Trial key',
        key_encrypted=encrypt_key(value),
        key_hint=value[-4:],
        created_by_admin=admin_profile,
    )


def active_keys():
    """Active pool in round-robin order: never-used first, then least-recently-used."""
    return list(
        GroqServerKey.objects.filter(is_active=True).order_by(
            F('last_used_at').asc(nulls_first=True), 'created_at', 'id',
        )
    )


def has_usable_server_key():
    if getattr(settings, 'GROQ_API_KEY', ''):
        return True
    return GroqServerKey.objects.filter(is_active=True).exists()


@transaction.atomic
def record_use(key):
    GroqServerKey.objects.filter(pk=key.pk).update(
        use_count=key.use_count + 1, last_used_at=timezone.now(),
        updated_at=timezone.now(),
    )
    key.use_count += 1
    key.last_used_at = timezone.now()


@transaction.atomic
def record_failure(key, reason):
    """Count a provider failure; auto-disable at the threshold."""
    fresh = GroqServerKey.objects.select_for_update().get(pk=key.pk)
    fresh.consecutive_failures += 1
    if fresh.consecutive_failures >= MAX_FAILURES:
        fresh.is_active = False
        fresh.disabled_reason = reason
    fresh.save(update_fields=(
        'consecutive_failures', 'is_active', 'disabled_reason', 'updated_at',
    ))
    return fresh


@transaction.atomic
def record_success(key):
    GroqServerKey.objects.filter(pk=key.pk).update(
        consecutive_failures=0, disabled_reason='', updated_at=timezone.now(),
    )
