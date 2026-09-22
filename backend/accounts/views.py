from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone

from .models import AppUser, UserAiEntitlement, UserPreference
from .serializers import AiEntitlementSerializer, AppUserSerializer, PreferenceSerializer


def _require_app_user(request):
    if not isinstance(request.user, AppUser):
        return Response(
            {'detail': 'A Supabase-authenticated user is required.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )
    return None


class MeView(APIView):
    """Return the application profile resolved from the Supabase JWT."""

    def get(self, request):
        denied = _require_app_user(request)
        if denied:
            return denied
        return Response(AppUserSerializer(request.user).data)

    def patch(self, request):
        denied = _require_app_user(request)
        if denied:
            return denied
        serializer = AppUserSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        user = request.user
        for field, value in serializer.validated_data.items():
            setattr(user, field, value)
        user.save(update_fields=[*serializer.validated_data.keys(), 'updated_at'])
        user.refresh_from_db()
        return Response(AppUserSerializer(user).data)


class PreferenceView(APIView):
    """Read and update the authenticated user's notification preferences."""

    def get(self, request):
        denied = _require_app_user(request)
        if denied:
            return denied
        preference, _ = UserPreference.objects.get_or_create(user=request.user)
        return Response(PreferenceSerializer(preference).data)

    def patch(self, request):
        denied = _require_app_user(request)
        if denied:
            return denied
        preference, _ = UserPreference.objects.get_or_create(user=request.user)
        serializer = PreferenceSerializer(preference, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


PROFILE_DEFAULTS = {
    'display_name': '',
    'timezone': 'Asia/Dhaka',
    'locale': 'en-BD',
    'default_currency': 'BDT',
}

PREFERENCE_DEFAULTS = {
    'notification_enabled': False,
    'time_reminders_enabled': False,
    'location_reminders_enabled': False,
    'daily_briefing_enabled': True,
    'week_starts_on': 0,
    'profession': '',
    'priority_profile': 'BALANCED',
    'onboarding_completed_at': None,
    'onboarding_tour_version': 0,
}


def settings_payload(user):
    preference, _ = UserPreference.objects.get_or_create(user=user)
    return {
        'user': AppUserSerializer(user).data,
        'preferences': PreferenceSerializer(preference).data,
    }


class SettingsView(APIView):
    """Return profile + preferences in a single round trip for the Settings page."""

    def get(self, request):
        denied = _require_app_user(request)
        if denied:
            return denied
        return Response(settings_payload(request.user))


class PreferenceResetView(APIView):
    """Restore profile defaults and notification preferences."""

    def post(self, request):
        denied = _require_app_user(request)
        if denied:
            return denied
        user = request.user
        for field, value in PROFILE_DEFAULTS.items():
            setattr(user, field, value)
        user.save(update_fields=[*PROFILE_DEFAULTS.keys(), 'updated_at'])
        UserPreference.objects.update_or_create(
            user=user, defaults=PREFERENCE_DEFAULTS,
        )
        user.refresh_from_db()
        return Response(settings_payload(user))


class AiEntitlementView(APIView):
    """Return the authenticated user's backend-authoritative trial usage."""

    def get(self, request):
        denied = _require_app_user(request)
        if denied:
            return denied
        entitlement, _ = UserAiEntitlement.objects.get_or_create(user=request.user)
        return Response(AiEntitlementSerializer(entitlement).data)


class OnboardingCompleteView(APIView):
    """Persist onboarding choices; completion stays server-authoritative."""

    def post(self, request):
        denied = _require_app_user(request)
        if denied:
            return denied
        preference, _ = UserPreference.objects.get_or_create(user=request.user)
        serializer = PreferenceSerializer(preference, data={
            'profession': request.data.get('profession', preference.profession),
            'priority_profile': request.data.get('priority_profile', preference.priority_profile),
            'onboarding_tour_version': request.data.get('onboarding_tour_version', preference.onboarding_tour_version),
        }, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(onboarding_completed_at=timezone.now())
        return Response(settings_payload(request.user))
