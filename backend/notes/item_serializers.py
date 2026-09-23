from datetime import datetime

from django.utils import timezone
from rest_framework import serializers

from .constants import DOMAINS, IMPORTANCES, ITEM_STATUSES, ITEM_TYPES, MAX_ITEMS
from .models import Domain, NoteItem


class StrictFieldsMixin:
    """DRF normally ignores unknown/read-only input. Mutation contracts do not."""
    def to_internal_value(self, data):
        if isinstance(data, dict):
            allowed = {name for name, field in self.fields.items() if not field.read_only}
            if set(data) - allowed:
                raise serializers.ValidationError('Unexpected or read-only fields were submitted.')
        return super().to_internal_value(data)


class ItemInputSerializer(StrictFieldsMixin, serializers.Serializer):
    item_type = serializers.ChoiceField(choices=ITEM_TYPES)
    title = serializers.CharField(max_length=200)
    summary = serializers.CharField(max_length=500, allow_blank=True, default='')
    normalized_text = serializers.CharField(max_length=1000, allow_blank=True, default='')
    domains = serializers.SlugRelatedField(
        slug_field='slug', many=True,
        queryset=Domain.objects.filter(slug__in=[slug for slug, _ in DOMAINS]),
        required=False, default=list,
    )
    start_date = serializers.DateField(allow_null=True, default=None)
    due_date = serializers.DateField(allow_null=True, default=None)
    start_datetime = serializers.DateTimeField(allow_null=True, default=None)
    due_datetime = serializers.DateTimeField(allow_null=True, default=None)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0, allow_null=True, default=None)
    currency = serializers.RegexField(r'^[A-Z]{3}$', allow_null=True, default=None)
    quantity = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=0, allow_null=True, default=None)
    unit = serializers.CharField(max_length=20, allow_null=True, default=None)
    place_hint = serializers.CharField(max_length=120, allow_null=True, default=None)
    status = serializers.ChoiceField(choices=ITEM_STATUSES, default='PENDING')
    importance = serializers.ChoiceField(choices=IMPORTANCES, default='NORMAL')
    metadata = serializers.JSONField(required=False, default=dict)

    def validate_domains(self, domains):
        if len(domains) > len(DOMAINS) or len({domain.pk for domain in domains}) != len(domains):
            raise serializers.ValidationError('Use distinct supported domains.')
        return domains

    def validate(self, attrs):
        def value(name):
            return attrs.get(name, getattr(self.instance, name, None))
        for prefix in ('start', 'due'):
            if value(f'{prefix}_date') and value(f'{prefix}_datetime'):
                raise serializers.ValidationError({f'{prefix}_date': 'Use either a date or a timed date, not both.'})
        start = value('start_datetime') or value('start_date')
        due = value('due_datetime') or value('due_date')
        if start and due:
            if not (isinstance(start, datetime) and isinstance(due, datetime)):
                start = timezone.localtime(start).date() if isinstance(start, datetime) else start
                due = timezone.localtime(due).date() if isinstance(due, datetime) else due
            if due < start:
                raise serializers.ValidationError({'due_datetime': 'The due date must not precede the start.'})
        return attrs


class DraftInputSerializer(ItemInputSerializer):
    id = serializers.IntegerField(min_value=1, required=False)


class RevisionSerializer(StrictFieldsMixin, serializers.Serializer):
    revision = serializers.IntegerField(min_value=0)


class ConfirmationSerializer(RevisionSerializer):
    items = DraftInputSerializer(many=True, max_length=MAX_ITEMS, allow_empty=True)


class ItemUpdateSerializer(ItemInputSerializer):
    revision = serializers.IntegerField(min_value=0)


class NoteItemSerializer(serializers.ModelSerializer):
    domains = serializers.SlugRelatedField(slug_field='slug', many=True, read_only=True)
    revision = serializers.IntegerField(source='note.revision', read_only=True)

    class Meta:
        model = NoteItem
        fields = (
            'id', 'note', 'revision', 'item_type', 'title', 'summary', 'normalized_text',
            'domains', 'start_date', 'due_date', 'start_datetime', 'due_datetime',
            'amount', 'currency', 'quantity', 'unit', 'place_hint', 'status',
            'importance', 'confidence', 'is_confirmed', 'created_at', 'updated_at',
            'metadata',
        )
        read_only_fields = fields
