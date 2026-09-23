from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import AdminProfile, ProAccessRequest, UserAiEntitlement, UserPreference


class AppUserSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    name = serializers.CharField(read_only=True)
    username = serializers.CharField(read_only=True)
    email = serializers.EmailField(read_only=True)
    display_name = serializers.CharField(
        max_length=120, allow_blank=True, required=False,
    )
    timezone = serializers.CharField(max_length=64, required=False)
    locale = serializers.CharField(max_length=16, required=False)
    default_currency = serializers.RegexField(
        regex=r'^[A-Z]{3}$', max_length=3, required=False,
        error_messages={'invalid': 'Use a 3-letter uppercase currency code.'},
    )

    def validate_display_name(self, value):
        return value.strip()[:120]

    def validate_timezone(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Timezone must not be blank.')
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise serializers.ValidationError('Unknown timezone.')
        return value

    def to_representation(self, user):
        return {
            'id': str(user.id),
            'name': user.display_name or user.email,
            'username': user.email,
            'email': user.email,
            'display_name': user.display_name,
            'timezone': user.timezone,
            'locale': user.locale,
            'default_currency': user.default_currency,
        }


class AdminLoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        user = authenticate(username=attrs['username'].strip(), password=attrs['password'])
        if user is None or not user.is_active:
            raise serializers.ValidationError('Invalid credentials.')
        profile = getattr(user, 'admin_profile', None)
        if profile is None or not profile.is_active:
            raise serializers.ValidationError('This account is not an active admin.')
        attrs['user'] = user
        attrs['profile'] = profile
        return attrs


class AdminProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='django_user.username', read_only=True)
    email = serializers.EmailField(source='django_user.email', read_only=True)

    class Meta:
        model = AdminProfile
        fields = ('id', 'username', 'email', 'role', 'is_active', 'created_at', 'updated_at')
        read_only_fields = ('id', 'created_at', 'updated_at')


class AdminCreateSerializer(serializers.Serializer):
    username = serializers.RegexField(regex=r'^[\w.@+-]+$', max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, trim_whitespace=False, min_length=8)
    role = serializers.ChoiceField(choices=('ADMIN', 'SUPER_ADMIN'), default='ADMIN')

    def validate_username(self, value):
        if get_user_model().objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('An account with this username already exists.')
        return value

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as error:
            raise serializers.ValidationError(error.messages)
        return value


class AdminUserSerializer(serializers.Serializer):
    """Safe admin projection of an AppUser. Never includes note or item content."""

    id = serializers.CharField(read_only=True)
    email = serializers.EmailField(read_only=True)
    display_name = serializers.CharField(max_length=120, allow_blank=True, required=False)
    status = serializers.ChoiceField(choices=('ACTIVE', 'SUSPENDED'), required=False)
    timezone = serializers.CharField(max_length=64, required=False)
    locale = serializers.CharField(max_length=16, required=False)
    default_currency = serializers.RegexField(
        regex=r'^[A-Z]{3}$', max_length=3, required=False,
        error_messages={'invalid': 'Use a 3-letter uppercase currency code.'},
    )
    notes_count = serializers.IntegerField(read_only=True)
    confirmed_items_count = serializers.IntegerField(read_only=True)
    last_seen_at = serializers.DateTimeField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)

    def validate_display_name(self, value):
        return value.strip()[:120]

    def validate_timezone(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Timezone must not be blank.')
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise serializers.ValidationError('Unknown timezone.')
        return value


class AISettingsSerializer(serializers.Serializer):
    server_ai_enabled = serializers.BooleanField()


class PreferenceSerializer(serializers.ModelSerializer):
    week_starts_on = serializers.IntegerField(min_value=0, max_value=6, required=False)
    onboarding_completed_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = UserPreference
        fields = (
            'notification_enabled', 'time_reminders_enabled',
            'location_reminders_enabled', 'daily_briefing_enabled',
            'week_starts_on', 'profession', 'priority_profile',
            'onboarding_completed_at', 'onboarding_tour_version',
        )
        extra_kwargs = {field: {'required': False} for field in fields}


class AiEntitlementSerializer(serializers.ModelSerializer):
    remaining = serializers.SerializerMethodField()

    class Meta:
        model = UserAiEntitlement
        fields = ('trial_limit', 'trial_used', 'remaining', 'trial_started_at', 'trial_expires_at')
        read_only_fields = fields

    def get_remaining(self, entitlement):
        return max(entitlement.trial_limit - entitlement.trial_used, 0)


class ProRequestCreateSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=500, allow_blank=True, default='')

    def validate_reason(self, value):
        return value.strip()[:500]


class ProRequestSerializer(serializers.ModelSerializer):
    """User projection: code + status, never the database primary key."""

    class Meta:
        model = ProAccessRequest
        fields = ('code', 'status', 'reason', 'created_at', 'decided_at')
        read_only_fields = fields


class AdminProRequestSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    display_name = serializers.CharField(source='user.display_name', read_only=True)
    status = serializers.ChoiceField(choices=ProAccessRequest.Status.choices)

    class Meta:
        model = ProAccessRequest
        fields = (
            'code', 'user_email', 'display_name', 'reason', 'status',
            'created_at', 'updated_at', 'decided_at',
        )
        read_only_fields = ('code', 'user_email', 'display_name', 'reason', 'created_at', 'updated_at', 'decided_at')
