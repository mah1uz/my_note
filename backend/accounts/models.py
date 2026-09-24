import uuid

from django.conf import settings
from django.db import models


APP_USER_STATUSES = ('ACTIVE', 'SUSPENDED', 'DELETION_PENDING', 'DELETED')


class AppUser(models.Model):
    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Active'
        SUSPENDED = 'SUSPENDED', 'Suspended'
        DELETION_PENDING = 'DELETION_PENDING', 'Deletion pending'
        DELETED = 'DELETED', 'Deleted'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(max_length=320)
    display_name = models.CharField(max_length=120, blank=True)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.ACTIVE)
    timezone = models.CharField(max_length=64, default='Asia/Dhaka')
    locale = models.CharField(max_length=16, default='en-BD')
    default_currency = models.CharField(max_length=3, default='BDT')
    email_verified_at = models.DateTimeField(null=True, blank=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    suspended_at = models.DateTimeField(null=True, blank=True)
    deletion_requested_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'app_users'
        constraints = [
            models.UniqueConstraint(
                fields=('email',),
                condition=models.Q(status__in=['ACTIVE', 'SUSPENDED', 'DELETION_PENDING']),
                name='app_user_live_email_unique',
            ),
            models.CheckConstraint(
                condition=models.Q(status__in=APP_USER_STATUSES),
                name='app_user_valid_status',
            ),
            models.CheckConstraint(
                condition=models.Q(default_currency__regex=r'^[A-Z]{3}$'),
                name='app_user_currency_code',
            ),
        ]
        indexes = [
            models.Index(fields=('status', 'created_at'), name='app_user_status_created_idx'),
        ]

    @property
    def is_authenticated(self):
        return True

    @property
    def is_anonymous(self):
        return False

    def __str__(self):
        return self.email


class UserAuthIdentity(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(AppUser, on_delete=models.CASCADE, related_name='auth_identities')
    auth_system = models.CharField(max_length=32, default='SUPABASE')
    issuer = models.CharField(max_length=255)
    subject = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'user_auth_identities'
        constraints = [
            models.UniqueConstraint(fields=('issuer', 'subject'), name='auth_identity_issuer_subject_unique'),
        ]
        indexes = [models.Index(fields=('user',), name='auth_identity_user_idx')]


class UserPreference(models.Model):
    class Profession(models.TextChoices):
        STUDENT = 'STUDENT', 'Student'
        EMPLOYED = 'EMPLOYED', 'Employed'
        BOTH = 'BOTH', 'Both'
        OTHER = 'OTHER', 'Other'
        PREFER_NOT_TO_SAY = 'PREFER_NOT_TO_SAY', 'Prefer not to say'

    class PriorityProfile(models.TextChoices):
        BALANCED = 'BALANCED', 'Balanced'
        STUDY_FIRST = 'STUDY_FIRST', 'Study first'
        WORK_FIRST = 'WORK_FIRST', 'Work first'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(AppUser, on_delete=models.CASCADE, related_name='preferences')
    notification_enabled = models.BooleanField(default=False)
    time_reminders_enabled = models.BooleanField(default=False)
    location_reminders_enabled = models.BooleanField(default=False)
    daily_briefing_enabled = models.BooleanField(default=True)
    week_starts_on = models.PositiveSmallIntegerField(default=0)
    profession = models.CharField(max_length=24, choices=Profession.choices, blank=True, default='')
    priority_profile = models.CharField(
        max_length=24, choices=PriorityProfile.choices, default=PriorityProfile.BALANCED,
    )
    onboarding_completed_at = models.DateTimeField(null=True, blank=True)
    onboarding_tour_version = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_preferences'
        constraints = [
            models.CheckConstraint(
                condition=models.Q(week_starts_on__gte=0, week_starts_on__lte=6),
                name='user_preference_week_start_range',
            ),
            models.CheckConstraint(
                condition=models.Q(profession__in=['', 'STUDENT', 'EMPLOYED', 'BOTH', 'OTHER', 'PREFER_NOT_TO_SAY']),
                name='user_preference_valid_profession',
            ),
            models.CheckConstraint(
                condition=models.Q(priority_profile__in=['BALANCED', 'STUDY_FIRST', 'WORK_FIRST']),
                name='user_preference_valid_priority',
            ),
        ]


class UserAiEntitlement(models.Model):
    """Backend-authoritative free-trial quota. One row per AppUser."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(AppUser, on_delete=models.CASCADE, related_name='ai_entitlement')
    trial_limit = models.PositiveIntegerField(default=5)
    trial_used = models.PositiveIntegerField(default=0)
    trial_started_at = models.DateTimeField(null=True, blank=True)
    trial_expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_ai_entitlements'
        constraints = [
            models.CheckConstraint(
                condition=models.Q(trial_used__lte=models.F('trial_limit')),
                name='ai_trial_usage_within_limit',
            ),
        ]


class AdminProfile(models.Model):
    class Role(models.TextChoices):
        ADMIN = 'ADMIN', 'Admin'
        SUPER_ADMIN = 'SUPER_ADMIN', 'Super admin'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    django_user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='admin_profile')
    role = models.CharField(max_length=24, choices=Role.choices, default=Role.ADMIN)
    is_active = models.BooleanField(default=True)
    created_by_admin = models.ForeignKey(
        'self', null=True, blank=True, on_delete=models.SET_NULL, related_name='created_admins',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'admin_profiles'
        constraints = [
            models.CheckConstraint(
                condition=models.Q(role__in=('ADMIN', 'SUPER_ADMIN')),
                name='admin_profile_valid_role',
            ),
        ]


class SystemSetting(models.Model):
    """Global switches managed from the admin dashboard. Absent rows mean defaults."""

    key = models.CharField(max_length=64, primary_key=True)
    value = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'system_settings'

    def __str__(self):
        return self.key


class GroqServerKey(models.Model):
    """Pool of server-owned Groq keys for the free trial.

    Values are Fernet-encrypted with SERVER_KEY_SECRET; the plaintext is
    never stored, logged, or returned by any API. Round-robin selection
    spreads per-key rate limits; repeated provider failures auto-disable.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    label = models.CharField(max_length=80)
    key_encrypted = models.TextField()
    key_hint = models.CharField(max_length=12, blank=True, default='')
    is_active = models.BooleanField(default=True)
    use_count = models.PositiveIntegerField(default=0)
    consecutive_failures = models.PositiveIntegerField(default=0)
    disabled_reason = models.CharField(max_length=40, blank=True, default='')
    created_by_admin = models.ForeignKey(
        AdminProfile, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='created_trial_keys',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'groq_server_keys'
        ordering = ('created_at', 'id')

    def __str__(self):
        return f'{self.label} (••••{self.key_hint})'


class AdminAuditEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor_admin = models.ForeignKey(AdminProfile, null=True, blank=True, on_delete=models.SET_NULL, related_name='audit_events')
    action = models.CharField(max_length=64)
    target_user = models.ForeignKey(AppUser, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    target_admin = models.ForeignKey(AdminProfile, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    target_ref_hash = models.CharField(max_length=128, null=True, blank=True)
    reason = models.CharField(max_length=500, null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    ip_hash = models.CharField(max_length=128, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'admin_audit_events'
        ordering = ('-created_at',)
        indexes = [
            models.Index(fields=('actor_admin', 'created_at'), name='audit_actor_created_idx'),
            models.Index(fields=('target_user', 'created_at'), name='audit_user_created_idx'),
            models.Index(fields=('action', 'created_at'), name='audit_action_created_idx'),
        ]


class ProAccessRequest(models.Model):
    """User request for Pro access. The code is the opaque request token:
    generated server-side, unique, carrying no identity or permission."""

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        CONTACTED = 'CONTACTED', 'Contacted'
        APPROVED = 'APPROVED', 'Approved'
        DECLINED = 'DECLINED', 'Declined'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(AppUser, on_delete=models.CASCADE, related_name='pro_requests')
    code = models.CharField(max_length=12, unique=True)
    reason = models.CharField(max_length=500, blank=True, default='')
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'pro_access_requests'
        ordering = ('-created_at', '-id')
        constraints = [
            models.CheckConstraint(
                condition=models.Q(status__in=['PENDING', 'CONTACTED', 'APPROVED', 'DECLINED']),
                name='pro_request_valid_status',
            ),
        ]
        indexes = [
            models.Index(fields=('user', 'status'), name='pro_request_user_status_idx'),
            models.Index(fields=('status', 'created_at'), name='pro_request_status_created_idx'),
        ]

    def __str__(self):
        return f'{self.code} {self.status}'
