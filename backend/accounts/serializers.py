from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from rest_framework import serializers

from .models import UserPreference


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


class PreferenceSerializer(serializers.ModelSerializer):
    week_starts_on = serializers.IntegerField(min_value=0, max_value=6, required=False)

    class Meta:
        model = UserPreference
        fields = (
            'notification_enabled', 'time_reminders_enabled',
            'location_reminders_enabled', 'daily_briefing_enabled',
            'week_starts_on',
        )
        extra_kwargs = {field: {'required': False} for field in fields}
