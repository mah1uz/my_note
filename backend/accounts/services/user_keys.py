"""Per-user personal AI keys (one row per user+provider), encrypted at rest."""
from django.utils import timezone

from accounts.models import UserGroqKey
from accounts.services import trial_keys


def _provider(value):
    from ai.services.providers import normalize_provider

    return normalize_provider(value)


def get_user_key_row(user, provider='groq'):
    return UserGroqKey.objects.filter(user=user, provider=_provider(provider)).first()


def get_user_key_plaintext(user, provider='groq'):
    row = get_user_key_row(user, provider)
    if row is None:
        return None
    try:
        fernet = trial_keys._fernet()
        return fernet.decrypt(row.key_encrypted.encode('utf-8')).decode('utf-8')
    except Exception as error:
        raise trial_keys.KeyMisconfigured('A stored personal key could not be decrypted.') from error


def save_user_key(user, raw, provider='groq'):
    from ai.services.providers import provider_label

    provider = _provider(provider)
    value = str(raw or '').strip()
    if not trial_keys.validate_format(value, provider):
        raise ValueError(f'That does not look like a valid {provider_label(provider)} API key.')
    encrypted = trial_keys.encrypt_key(value)
    hint = value[-4:]
    row, _ = UserGroqKey.objects.update_or_create(
        user=user, provider=provider,
        defaults={'key_encrypted': encrypted, 'key_hint': hint, 'updated_at': timezone.now()},
    )
    return row


def delete_user_key(user, provider='groq'):
    UserGroqKey.objects.filter(user=user, provider=_provider(provider)).delete()


def user_key_status(user, provider='groq'):
    provider = _provider(provider)
    row = get_user_key_row(user, provider)
    if row is None:
        return {'has_key': False, 'masked': '', 'updated_at': None, 'provider': provider}
    return {
        'has_key': True,
        'masked': f'••••{row.key_hint}' if row.key_hint else '••••',
        'updated_at': row.updated_at.isoformat() if row.updated_at else None,
        'provider': provider,
    }


def all_user_key_statuses(user):
    from ai.services.providers import PROVIDERS

    return {provider: user_key_status(user, provider) for provider in PROVIDERS}
