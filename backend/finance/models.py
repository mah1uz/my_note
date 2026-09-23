import uuid
from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models


class FinanceTransaction(models.Model):
    """Authoritative confirmed financial ledger. Every row is confirmed truth."""

    class Direction(models.TextChoices):
        CREDIT = 'CREDIT', 'Credit'
        DEBIT = 'DEBIT', 'Debit'

    class SourceKind(models.TextChoices):
        AI_NOTE = 'AI_NOTE', 'AI note'
        MANUAL = 'MANUAL', 'Manual'
        OPENING_BALANCE = 'OPENING_BALANCE', 'Opening balance'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey('accounts.AppUser', on_delete=models.CASCADE, related_name='transactions')
    note_item = models.OneToOneField(
        'notes.NoteItem', on_delete=models.CASCADE, null=True, blank=True,
        related_name='finance_transaction',
    )
    primary_domain = models.ForeignKey(
        'notes.Domain', on_delete=models.PROTECT, null=True, blank=True,
        related_name='finance_transactions',
    )
    direction = models.CharField(max_length=8, choices=Direction.choices)
    amount = models.DecimalField(max_digits=18, decimal_places=4, validators=[MinValueValidator(Decimal('0.0001'))])
    currency = models.CharField(max_length=3)
    label = models.CharField(max_length=255)
    transaction_at = models.DateTimeField()
    source_kind = models.CharField(max_length=24, choices=SourceKind.choices, default=SourceKind.MANUAL)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'finance_transactions'
        ordering = ('-transaction_at', '-created_at', '-id')
        constraints = [
            models.CheckConstraint(
                condition=models.Q(direction__in=['CREDIT', 'DEBIT']),
                name='finance_transaction_valid_direction',
            ),
            models.CheckConstraint(
                condition=models.Q(amount__gt=0),
                name='finance_transaction_positive_amount',
            ),
            models.CheckConstraint(
                condition=models.Q(currency__regex=r'^[A-Z]{3}$'),
                name='finance_transaction_currency_code',
            ),
            models.UniqueConstraint(
                fields=('user', 'currency'),
                condition=models.Q(source_kind='OPENING_BALANCE'),
                name='finance_one_opening_balance_per_currency',
            ),
        ]
        indexes = [
            models.Index(fields=('user', '-transaction_at'), name='finance_user_at_idx'),
            models.Index(fields=('user', 'direction', '-transaction_at'), name='finance_user_direction_at_idx'),
            models.Index(fields=('user', 'currency', '-transaction_at'), name='finance_user_currency_at_idx'),
            models.Index(fields=('user', 'primary_domain', '-transaction_at'), name='finance_user_domain_at_idx'),
        ]

    def __str__(self):
        return f'{self.direction} {self.currency} {self.amount} - {self.label}'
