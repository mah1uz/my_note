from rest_framework import serializers

from .models import Note


class NoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Note
        fields = ('id', 'raw_text', 'processing_status', 'is_archived', 'created_at', 'updated_at', 'revision')
        read_only_fields = ('id', 'processing_status', 'created_at', 'updated_at', 'revision')

    def validate_raw_text(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('A note cannot be empty.')
        if len(value.split()) > 300:
            raise serializers.ValidationError('Keep notes to 300 words or fewer.')
        return value
