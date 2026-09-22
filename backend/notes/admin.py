from django.contrib import admin

from .models import Domain


@admin.register(Domain)
class DomainAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug')
    search_fields = ('name', 'slug')

    # A fixed vocabulary, installed by migration; do not silently break AI contracts.
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


# Notes, NoteItems, and AI logs contain private user content and are intentionally
# not registered in Django Admin. Operational projections will be added separately.
