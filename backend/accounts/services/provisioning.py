from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from accounts.models import AppUser, UserAiEntitlement, UserAuthIdentity, UserPreference

# Presence writes are cached: per-request last_seen_at UPDATEs cost a
# row-locked write transaction on every API call (brutal under N+1
# fan-out), while nothing reads the stamp fresher than minutes.
LAST_SEEN_STALENESS = timedelta(minutes=5)


def _claim_email(claims):
    email = str(claims.get('email', '')).strip().lower()
    if not email or '@' not in email:
        raise ValueError('The authenticated token does not contain a valid email.')
    return email


def _display_name(claims, email):
    metadata = claims.get('user_metadata') or {}
    return str(
        metadata.get('full_name') or metadata.get('name') or claims.get('name') or email.split('@', 1)[0]
    ).strip()[:120]


@transaction.atomic
def provision_from_claims(claims):
    issuer = str(claims.get('iss', '')).strip()
    subject = str(claims.get('sub', '')).strip()
    if not issuer or not subject:
        raise ValueError('The authenticated token is missing issuer or subject.')

    now = timezone.now()
    identity = UserAuthIdentity.objects.select_for_update().select_related('user').filter(
        issuer=issuer, subject=subject,
    ).first()
    if identity:
        user = identity.user
        if user.status != AppUser.Status.ACTIVE:
            raise PermissionError('This application account is not active.')
        if identity.last_seen_at is None or now - identity.last_seen_at >= LAST_SEEN_STALENESS:
            identity.last_seen_at = now
            identity.save(update_fields=('last_seen_at',))
            user.last_seen_at = now
            user.save(update_fields=('last_seen_at', 'updated_at'))
        return user

    email = _claim_email(claims)
    user = AppUser.objects.filter(
        email=email, status__in=(AppUser.Status.ACTIVE, AppUser.Status.SUSPENDED, AppUser.Status.DELETION_PENDING),
    ).first()
    if user:
        # Never silently merge by email. An existing local account needs an explicit link workflow.
        raise ValueError('An application account already exists for this email and needs explicit linking.')

    user = AppUser.objects.create(
        email=email,
        display_name=_display_name(claims, email),
        email_verified_at=now if claims.get('email_confirmed_at') or claims.get('email_verified') else None,
        last_seen_at=now,
    )
    UserAuthIdentity.objects.create(user=user, auth_system='SUPABASE', issuer=issuer, subject=subject, last_seen_at=now)
    UserPreference.objects.create(user=user)
    UserAiEntitlement.objects.create(user=user)
    return user
