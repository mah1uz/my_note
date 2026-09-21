from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.db import IntegrityError
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import (
    LoginSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    UserSerializer,
)

User = get_user_model()


def set_refresh_cookie(response, token):
    response.set_cookie(
        settings.REFRESH_COOKIE_NAME,
        str(token),
        max_age=int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds()),
        httponly=True,
        secure=settings.REFRESH_COOKIE_SECURE,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
        path=settings.REFRESH_COOKIE_PATH,
    )


def auth_response(user, response_status=status.HTTP_200_OK):
    refresh = RefreshToken.for_user(user)
    response = Response(
        {'access': str(refresh.access_token), 'user': UserSerializer(user).data},
        status=response_status,
    )
    set_refresh_cookie(response, refresh)
    return response


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user = serializer.save()
        except IntegrityError:
            raise ValidationError({'email': 'An account with this email already exists.'})
        return auth_response(user, status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return auth_response(serializer.validated_data['user'])


class RefreshView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        request.data
        raw_token = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if not raw_token:
            return Response({'detail': 'Refresh token is missing.'}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            old_refresh = RefreshToken(raw_token)
            user = User.objects.get(pk=old_refresh['user_id'], is_active=True)
            old_refresh.blacklist()
        except (TokenError, User.DoesNotExist):
            return Response({'detail': 'Refresh token is invalid or expired.'}, status=status.HTTP_401_UNAUTHORIZED)
        return auth_response(user)


class LogoutView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        request.data
        raw_token = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if raw_token:
            try:
                RefreshToken(raw_token).blacklist()
            except TokenError:
                pass
        response = Response(status=status.HTTP_204_NO_CONTENT)
        response.delete_cookie(settings.REFRESH_COOKIE_NAME, path=settings.REFRESH_COOKIE_PATH)
        return response


class MeView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.filter(email__iexact=serializer.validated_data['email'], is_active=True).first()
        payload = {'detail': 'If the account exists, a password reset link has been sent.'}
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            reset_url = f'{settings.FRONTEND_URL}/reset-password/{uid}/{token}'
            send_mail('Reset your Rememberly password', f'Use this link to reset your password:\n\n{reset_url}', None, [user.email])
        return Response(payload)


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user_id = force_str(urlsafe_base64_decode(serializer.validated_data['uid']))
            user = User.objects.get(pk=user_id, is_active=True)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({'detail': 'The password reset link is invalid or expired.'}, status=status.HTTP_400_BAD_REQUEST)
        if not default_token_generator.check_token(user, serializer.validated_data['token']):
            return Response({'detail': 'The password reset link is invalid or expired.'}, status=status.HTTP_400_BAD_REQUEST)
        serializer.validate_password_for_user(user)
        user.set_password(serializer.validated_data['password'])
        user.save(update_fields=['password'])
        for outstanding_token in OutstandingToken.objects.filter(user=user):
            BlacklistedToken.objects.get_or_create(token=outstanding_token)
        return Response({'detail': 'Password reset successfully.'})
