"""Admin dashboard API. Manages users, admins, and global switches only.

Private note/item content is never serialized here by design.
"""
from django.contrib.auth import get_user_model
from django.db import models
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.authentication import TokenAuthentication
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token

from notes.models import Note, NoteItem

from .models import AdminProfile, AppUser, ProAccessRequest
from .permissions import IsActiveAdmin, IsSuperAdmin
from .serializers import (
    AdminCreateSerializer,
    AdminLoginSerializer,
    AdminProfileSerializer,
    AdminUserSerializer,
    AdminProRequestSerializer,
    AISettingsSerializer,
)
from .services.ai_config import get_server_ai_enabled, set_server_ai_enabled
from .services.audit import log_admin_action

User = get_user_model()


def _actor(request):
    return getattr(request.user, 'admin_profile', None)


def would_remove_last_super_admin(profile, validated_data):
    """True if applying these changes leaves zero active super admins.

    Defense in depth alongside the self-edit block: the API permission
    layer normally guarantees another active super admin (the actor), but
    this documents and enforces the invariant at the decision point.
    """
    if profile.role != AdminProfile.Role.SUPER_ADMIN or not profile.is_active:
        return False
    demoting = (
        validated_data.get('role', profile.role) != AdminProfile.Role.SUPER_ADMIN
        or validated_data.get('is_active', True) is False
    )
    if not demoting:
        return False
    return not AdminProfile.objects.filter(
        role=AdminProfile.Role.SUPER_ADMIN, is_active=True,
    ).exclude(pk=profile.pk).exists()


class AdminPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 100


class AdminLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = AdminLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        profile = serializer.validated_data['profile']
        token, _ = Token.objects.get_or_create(user=user)
        log_admin_action('admin.login', request=request, actor=profile)
        return Response({
            'token': token.key,
            'admin': AdminProfileSerializer(profile).data,
            'can_manage_admins': profile.role == AdminProfile.Role.SUPER_ADMIN,
        })


class AdminLogoutView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsActiveAdmin]

    def post(self, request):
        log_admin_action('admin.logout', request=request, actor=_actor(request))
        Token.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminMeView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsActiveAdmin]

    def get(self, request):
        profile = _actor(request)
        return Response({
            'admin': AdminProfileSerializer(profile).data,
            'can_manage_admins': profile.role == AdminProfile.Role.SUPER_ADMIN,
        })


class AdminUserListView(generics.ListAPIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsActiveAdmin]
    pagination_class = AdminPagination
    serializer_class = AdminUserSerializer

    def get_queryset(self):
        queryset = AppUser.objects.all().order_by('-created_at')
        search = (self.request.query_params.get('search') or '').strip()
        if search:
            queryset = queryset.filter(
                models.Q(email__icontains=search) | models.Q(display_name__icontains=search),
            )
        status_filter = (self.request.query_params.get('status') or '').strip().upper()
        if status_filter in ('ACTIVE', 'SUSPENDED', 'DELETION_PENDING', 'DELETED'):
            queryset = queryset.filter(status=status_filter)
        return queryset

    def list(self, request, *args, **kwargs):
        users = list(self.paginate_queryset(self.get_queryset()))
        counts = {
            str(row['app_user_id']): row['total']
            for row in Note.objects.filter(app_user__in=users).values('app_user_id').annotate(total=models.Count('id'))
        }
        confirmed = {
            str(row['note__app_user_id']): row['total']
            for row in NoteItem.objects.filter(note__app_user__in=users, is_confirmed=True)
            .values('note__app_user_id').annotate(total=models.Count('id'))
        }
        data = self.get_serializer(users, many=True).data
        for entry in data:
            entry['notes_count'] = counts.get(entry['id'], 0)
            entry['confirmed_items_count'] = confirmed.get(entry['id'], 0)
        return self.get_paginated_response(data)


class AdminUserDetailView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsActiveAdmin]

    def _get_user(self, pk):
        try:
            return AppUser.objects.get(pk=pk)
        except (AppUser.DoesNotExist, ValueError, TypeError):
            return None

    def _detail(self, user):
        data = AdminUserSerializer(user).data
        data['notes_count'] = Note.objects.filter(app_user=user).count()
        data['confirmed_items_count'] = NoteItem.objects.filter(note__app_user=user, is_confirmed=True).count()
        return Response(data)

    def get(self, request, pk):
        user = self._get_user(pk)
        if user is None:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
        return self._detail(user)

    def patch(self, request, pk):
        user = self._get_user(pk)
        if user is None:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = AdminUserSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        changed = dict(serializer.validated_data)
        for field, value in changed.items():
            setattr(user, field, value)
        user.save(update_fields=[*changed.keys(), 'updated_at'])
        log_admin_action(
            'user.updated', request=request, actor=_actor(request), target_user=user,
            metadata={'changed': sorted(changed.keys())},
        )
        user.refresh_from_db()
        return self._detail(user)

    def delete(self, request, pk):
        if (request.query_params.get('confirm') or '').lower() not in ('true', '1', 'yes'):
            return Response(
                {'detail': 'Add ?confirm=true to permanently delete this user and all their content.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user = self._get_user(pk)
        if user is None:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
        email = user.email
        log_admin_action(
            'user.deleted', request=request, actor=_actor(request),
            metadata={'email': email},
        )
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminListCreateView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        profiles = AdminProfile.objects.select_related('django_user').order_by('-created_at')
        return Response(AdminProfileSerializer(profiles, many=True).data)

    def post(self, request):
        serializer = AdminCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user = User.objects.create_user(
            username=data['username'],
            email=(data.get('email') or '').strip().lower(),
            password=data['password'],
            is_staff=True,
            is_superuser=data['role'] == AdminProfile.Role.SUPER_ADMIN,
        )
        profile = AdminProfile.objects.create(
            django_user=user, role=data['role'], created_by_admin=_actor(request),
        )
        log_admin_action(
            'admin.created', request=request, actor=_actor(request), target_admin=profile,
            metadata={'username': user.username, 'role': profile.role},
        )
        return Response(AdminProfileSerializer(profile).data, status=status.HTTP_201_CREATED)


class AdminDetailView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsSuperAdmin]

    def patch(self, request, pk):
        try:
            profile = AdminProfile.objects.select_related('django_user').get(pk=pk)
        except (AdminProfile.DoesNotExist, ValueError, TypeError):
            return Response({'detail': 'Admin not found.'}, status=status.HTTP_404_NOT_FOUND)
        if profile == _actor(request):
            return Response(
                {'detail': 'You cannot change your own admin record.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = AdminProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        if would_remove_last_super_admin(profile, serializer.validated_data):
            return Response(
                {'detail': 'Cannot remove the last active super admin.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        changed = {}
        if 'role' in serializer.validated_data:
            changed['role'] = serializer.validated_data['role']
            profile.role = changed['role']
            profile.django_user.is_superuser = changed['role'] == AdminProfile.Role.SUPER_ADMIN
            profile.django_user.save(update_fields=['is_superuser'])
        if 'is_active' in serializer.validated_data:
            changed['is_active'] = serializer.validated_data['is_active']
            profile.is_active = changed['is_active']
        profile.save()
        log_admin_action(
            'admin.updated', request=request, actor=_actor(request), target_admin=profile,
            metadata={'changed': changed},
        )
        profile.refresh_from_db()
        return Response(AdminProfileSerializer(profile).data)


class AISettingsView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsActiveAdmin]

    def get(self, request):
        return Response({'server_ai_enabled': get_server_ai_enabled()})

    def patch(self, request):
        serializer = AISettingsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        enabled = set_server_ai_enabled(serializer.validated_data['server_ai_enabled'])
        log_admin_action(
            'ai_settings.updated', request=request, actor=_actor(request),
            metadata={'server_ai_enabled': enabled},
        )
        return Response({'server_ai_enabled': enabled})


class ProRequestListView(generics.ListAPIView):
    """Admin queue of Pro access requests. Identity shown is the verified
    account email; nothing here is visible to normal users."""
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsActiveAdmin]
    pagination_class = AdminPagination
    serializer_class = AdminProRequestSerializer

    def get_queryset(self):
        queryset = ProAccessRequest.objects.select_related('user').order_by('-created_at', '-id')
        status_filter = (self.request.query_params.get('status') or '').strip().upper()
        if status_filter:
            if status_filter not in ProAccessRequest.Status.values:
                raise ValidationError({'status': 'Unsupported status filter.'})
            queryset = queryset.filter(status=status_filter)
        return queryset


class ProRequestDetailView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsActiveAdmin]

    def _get_request(self, code):
        try:
            return ProAccessRequest.objects.select_related('user').get(code=str(code).strip().upper())
        except (ProAccessRequest.DoesNotExist, ValueError):
            return None

    def get(self, request, code):
        pro_request = self._get_request(code)
        if pro_request is None:
            return Response({'detail': 'Pro request not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(AdminProRequestSerializer(pro_request).data)

    def patch(self, request, code):
        pro_request = self._get_request(code)
        if pro_request is None:
            return Response({'detail': 'Pro request not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = AdminProRequestSerializer(pro_request, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        changed = dict(serializer.validated_data)
        for field, value in changed.items():
            setattr(pro_request, field, value)
        if 'status' in changed and changed['status'] != ProAccessRequest.Status.PENDING:
            pro_request.decided_at = timezone.now()
        pro_request.save(update_fields=[*changed.keys(), 'decided_at', 'updated_at'])
        log_admin_action(
            'pro_request.updated', request=request, actor=_actor(request),
            target_user=pro_request.user, metadata={'status': pro_request.status},
        )
        if 'status' in changed:
            try:
                from notifications.services import notify_pro_request_update
                notify_pro_request_update(pro_request)
            except Exception:
                pass
        pro_request.refresh_from_db()
        return Response(AdminProRequestSerializer(pro_request).data)
