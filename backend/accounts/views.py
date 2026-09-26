from rest_framework import status
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView
from django.utils import timezone

from .models import AppUser, UserAiEntitlement, UserPreference
from .serializers import AiEntitlementSerializer, AppUserSerializer, PreferenceSerializer, ProRequestCreateSerializer, ProRequestSerializer, UserGroqKeySerializer
from .services.pro_requests import create_pro_request
from .services import trial_keys
from .services import user_keys


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


class UserGroqKeyView(APIView):
    """Per-user encrypted personal Groq key. Plaintext is never returned."""

    def get(self, request):
        denied = _require_app_user(request)
        if denied:
            return denied
        return Response(user_keys.user_key_status(request.user))

    def post(self, request):
        denied = _require_app_user(request)
        if denied:
            return denied
        serializer = UserGroqKeySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            row = user_keys.save_user_key(request.user, serializer.validated_data['key'])
        except ValueError as error:
            return Response({'detail': str(error)}, status=status.HTTP_400_BAD_REQUEST)
        except trial_keys.KeyMisconfigured as error:
            return Response({'detail': str(error)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response(user_keys.user_key_status(request.user), status=status.HTTP_201_CREATED)

    def delete(self, request):
        denied = _require_app_user(request)
        if denied:
            return denied
        user_keys.delete_user_key(request.user)
        return Response({'has_key': False, 'masked': '', 'updated_at': None})


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


class ProThrottle(UserRateThrottle):
    scope = 'pro'


class ProRequestView(APIView):
    """Create or read the authenticated user's Pro access request.

    The request code is generated server-side and identifies the request
    only; it grants nothing. An open pending request is returned instead
    of creating duplicates.
    """

    throttle_classes = [ProThrottle]

    def get(self, request):
        denied = _require_app_user(request)
        if denied:
            return denied
        latest = request.user.pro_requests.order_by('-created_at', '-id').first()
        if latest is None:
            return Response(
                {'detail': 'No Pro access request yet.', 'code': 'pro_request_none'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(ProRequestSerializer(latest).data)

    def post(self, request):
        denied = _require_app_user(request)
        if denied:
            return denied
        serializer = ProRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        pro_request, created = create_pro_request(request.user, serializer.validated_data.get('reason', ''))
        return Response(
            ProRequestSerializer(pro_request).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
