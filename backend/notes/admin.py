from django.contrib import admin

from .models import Note


@admin.register(Note)
class NoteAdmin(admin.ModelAdmin):
    list_display = ('id', 'short_text', 'user', 'processing_status', 'is_archived', 'created_at')
    list_filter = ('processing_status', 'is_archived', 'created_at')
    search_fields = ('raw_text', 'user__username', 'user__email')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-created_at',)

    @admin.display(description='Note')
    def short_text(self, note):
        return str(note)
