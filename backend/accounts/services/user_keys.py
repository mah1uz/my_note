"""Per-user personal Groq keys, encrypted at rest with SERVER_KEY_SECRET."""
from django.utils import timezone

from accounts.models import UserGroqKey
from accounts.services import trial_keys


def get_user_key_row(user):
    return UserGroqKey.objects.filter(user=user).first()


def get_user_key_plaintext(user):
    row = get_user_key_row(user)
    if row is None:
        return None
    try:
        fernet = trial_keys._fernet()
        return fernet.decrypt(row.key_encrypted.encode('utf-8')).decode('utf-8')
    except Exception as error:
        raise trial_keys.KeyMisconfigured('A stored personal key could not be decrypted.') from error


def save_user_key(user, raw):
    value = str(raw or '').strip()
    if not trial_keys.validate_format(value):
        raise ValueError('That does not look like a Groq API key.')
    encrypted = trial_keys.encrypt_key(value)
    hint = value[-4:]
    row, _ = UserGroqKey.objects.update_or_create(
        user=user,
        defaults={'key_encrypted': encrypted, 'key_hint': hint, 'updated_at': timezone.now()},
    )
    return row


def delete_user_key(user):
    UserGroqKey.objects.filter(user=user).delete()


def user_key_status(user):
    row = get_user_key_row(user)
    if row is None:
        return {'has_key': False, 'masked': '', 'updated_at': None}
    return {
        'has_key': True,
        'masked': f'••••{row.key_hint}' if row.key_hint else '••••',
        'updated_at': row.updated_at.isoformat() if row.updated_at else None,
    }
