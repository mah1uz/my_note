from django.contrib import admin

from .models import AdminAuditEvent, AdminProfile, AppUser


@admin.register(AppUser)
class AppUserAdmin(admin.ModelAdmin):
    list_display = ('id', 'email', 'display_name', 'status', 'created_at', 'last_seen_at')
    list_filter = ('status', 'timezone', 'locale')
    search_fields = ('id', 'email', 'display_name')
    readonly_fields = (
        'id', 'email', 'display_name', 'status', 'timezone', 'locale', 'default_currency',
        'email_verified_at', 'last_seen_at', 'suspended_at', 'deletion_requested_at',
        'created_at', 'updated_at', 'deleted_at',
    )
    ordering = ('-created_at',)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(AdminProfile)
class AdminProfileAdmin(admin.ModelAdmin):
    list_display = ('id', 'django_user', 'role', 'is_active', 'created_at')
    list_filter = ('role', 'is_active')
    search_fields = ('django_user__username', 'django_user__email')
    readonly_fields = tuple(field.name for field in AdminProfile._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(AdminAuditEvent)
class AdminAuditEventAdmin(admin.ModelAdmin):
    list_display = ('id', 'action', 'actor_admin', 'target_user', 'created_at')
    list_filter = ('action', 'created_at')
    readonly_fields = tuple(field.name for field in AdminAuditEvent._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
