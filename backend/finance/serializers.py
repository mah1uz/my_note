from rest_framework import serializers

from notes.models import Domain, NoteItem
from .models import FinanceTransaction


class FinanceTransactionSerializer(serializers.ModelSerializer):
    note_item = serializers.PrimaryKeyRelatedField(
        queryset=NoteItem.objects.filter(is_confirmed=True), allow_null=True, required=False,
    )
    primary_domain = serializers.SlugRelatedField(
        slug_field='slug', queryset=Domain.objects.all(), allow_null=True, required=False,
    )
    currency = serializers.RegexField(r'^[A-Z]{3}$')
    source_kind = serializers.ChoiceField(
        choices=(FinanceTransaction.SourceKind.MANUAL, FinanceTransaction.SourceKind.OPENING_BALANCE),
        required=False,
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Scope the linkable items to the caller: foreign or missing ids
        # then fail identically ("does not exist"), leaking no existence.
        request = self.context.get('request')
        user_id = getattr(getattr(request, 'user', None), 'id', None)
        if user_id is not None:
            self.fields['note_item'].queryset = NoteItem.objects.filter(
                note__app_user_id=user_id, is_confirmed=True,
            )

    class Meta:
        model = FinanceTransaction
        fields = (
            'id', 'note_item', 'primary_domain', 'direction', 'amount', 'currency',
            'label', 'transaction_at', 'source_kind', 'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'created_at', 'updated_at')

    def validate_label(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('A transaction label is required.')
        return value

    def validate(self, attrs):
        request = self.context.get('request')
        if self.instance is not None:
            # Source linkage is immutable after creation.
            attrs.pop('note_item', None)
            attrs.pop('source_kind', None)
            return attrs
        note_item = attrs.get('note_item')
        if note_item is not None:
            if note_item.note.app_user_id != request.user.id:
                raise serializers.ValidationError({'note_item': 'This item does not belong to your account.'})
            attrs['source_kind'] = FinanceTransaction.SourceKind.AI_NOTE
        else:
            attrs.setdefault('source_kind', FinanceTransaction.SourceKind.MANUAL)
        return attrs
