from rest_framework import permissions


def _active_profile(user):
    if not getattr(user, 'is_authenticated', False):
        return None
    profile = getattr(user, 'admin_profile', None)
    if profile is None or not profile.is_active:
        return None
    return profile


class IsActiveAdmin(permissions.BasePermission):
    """Django user with an active AdminProfile. Private content stays out of reach."""

    message = 'Admin access is required.'

    def has_permission(self, request, view):
        return _active_profile(request.user) is not None


class IsSuperAdmin(IsActiveAdmin):
    message = 'Super-admin access is required.'

    def has_permission(self, request, view):
        profile = _active_profile(request.user)
        return profile is not None and profile.role == 'SUPER_ADMIN'
