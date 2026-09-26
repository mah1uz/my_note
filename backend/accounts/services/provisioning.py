from django.db import transaction
from django.utils import timezone

from accounts.models import AppUser, UserAiEntitlement, UserAuthIdentity, UserPreference


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


# Activity timestamps are refreshed at most once per bucket window. Every
# authenticated request used to take a write lock and issue two UPDATEs just
# to bump last_seen_at; tick flows fire several sequential requests, so the
# lock and writes multiplied into visible latency.
LAST_SEEN_BUCKET_SECONDS = 600


def _touch_activity(identity, user, now):
    """Best-effort activity touch without row locking.

    Concurrent requests racing a bucket rollover may both write; the values
    are idempotent timestamps, so the loser overwrites with an equivalent row.
    """
    bucket = int(now.timestamp()) // LAST_SEEN_BUCKET_SECONDS
    last = identity.last_seen_at
    last_bucket = int(last.timestamp()) // LAST_SEEN_BUCKET_SECONDS if last else None
    if last_bucket == bucket:
        return
    UserAuthIdentity.objects.filter(pk=identity.pk).update(last_seen_at=now)
    AppUser.objects.filter(pk=user.pk).update(last_seen_at=now, updated_at=now)


def provision_from_claims(claims):
    issuer = str(claims.get('iss', '')).strip()
    subject = str(claims.get('sub', '')).strip()
    if not issuer or not subject:
        raise ValueError('The authenticated token is missing issuer or subject.')

    # Fast path for the overwhelmingly common case: known identity, active
    # user. Two indexed reads, zero writes, zero locks, zero transaction.
    identity = UserAuthIdentity.objects.select_related('user').filter(
        issuer=issuer, subject=subject,
    ).first()
    if identity:
        user = identity.user
        if user.status != AppUser.Status.ACTIVE:
            raise PermissionError('This application account is not active.')
        _touch_activity(identity, user, timezone.now())
        return user

    return _provision_new_identity(issuer, subject, claims)


@transaction.atomic
def _provision_new_identity(issuer, subject, claims):
    now = timezone.now()
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
