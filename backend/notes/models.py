from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from .constants import IMPORTANCES, ITEM_STATUSES, ITEM_TYPES


class Note(models.Model):
    class ProcessingStatus(models.TextChoices):
        UNPROCESSED = 'UNPROCESSED', 'Unprocessed'
        PROCESSING = 'PROCESSING', 'Processing'
        PROCESSED = 'PROCESSED', 'Processed'
        FAILED = 'FAILED', 'Failed'
        REVIEW_REQUIRED = 'REVIEW_REQUIRED', 'Review required'

    app_user = models.ForeignKey(
        'accounts.AppUser', on_delete=models.CASCADE,
        related_name='notes', db_index=True,
    )
    raw_text = models.TextField()
    processing_status = models.CharField(max_length=20, choices=ProcessingStatus.choices, default=ProcessingStatus.UNPROCESSED)
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # Optimistic concurrency protects reviews and late provider responses.
    revision = models.PositiveIntegerField(default=0)
    analysis_started_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ('-created_at',)
        # Measured: notes-list filters by app_user and orders by created_at;
        # EXPLAIN showed TEMP B-TREE FOR ORDER BY without this composite index.
        indexes = [models.Index(fields=('app_user', '-created_at'), name='note_owner_created_idx')]

    def __str__(self):
        return self.raw_text[:60]


class Domain(models.Model):
    name = models.CharField(max_length=60, unique=True)
    slug = models.SlugField(max_length=60, unique=True)

    class Meta:
        ordering = ('name',)

    def __str__(self):
        return self.name


class AIProcessingLog(models.Model):
    class Operation(models.TextChoices):
        ANALYZE = 'ANALYZE', 'Analyze'
        CONFIRM = 'CONFIRM', 'Confirm / manual organization'
        EDIT = 'EDIT', 'Edit confirmed item'

    class Status(models.TextChoices):
        STARTED = 'STARTED', 'Started'
        SUCCESS = 'SUCCESS', 'Success'
        EMPTY = 'EMPTY', 'No items'
        FAILED = 'FAILED', 'Failed'
        SUPERSEDED = 'SUPERSEDED', 'Superseded by a newer revision'

    note = models.ForeignKey(Note, on_delete=models.CASCADE, related_name='ai_logs')
    source_log = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True)
    operation = models.CharField(max_length=10, choices=Operation.choices, default=Operation.ANALYZE)
    model_name = models.CharField(max_length=100, blank=True)
    prompt_version = models.CharField(max_length=20, blank=True)
    note_revision = models.PositiveIntegerField()
    input_text = models.TextField()
    raw_response = models.TextField(blank=True)
    parsed_response = models.JSONField(null=True, blank=True)
    confirmed_response = models.JSONField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices)
    error_code = models.CharField(max_length=40, blank=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ('-created_at', '-id')
        indexes = [models.Index(fields=['note', '-created_at'], name='log_note_created_idx')]

    def __str__(self):
        return f'{self.operation} {self.status} — Note {self.note_id}'


class NoteItem(models.Model):
    note = models.ForeignKey(Note, on_delete=models.CASCADE, related_name='items')
    analysis_log = models.ForeignKey(AIProcessingLog, on_delete=models.SET_NULL, null=True, blank=True)
    item_type = models.CharField(max_length=20, choices=[(v, v.title()) for v in ITEM_TYPES])
    title = models.CharField(max_length=200)
    summary = models.TextField(blank=True, default='')
    normalized_text = models.TextField(blank=True, default='')
    domains = models.ManyToManyField(Domain, related_name='items', blank=True)
    # Date-only facts are separate: midnight must never stand for an unknown time.
    start_date = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    start_datetime = models.DateTimeField(null=True, blank=True)
    due_datetime = models.DateTimeField(null=True, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)])
    currency = models.CharField(max_length=3, null=True, blank=True)
    quantity = models.DecimalField(max_digits=12, decimal_places=3, null=True, blank=True, validators=[MinValueValidator(0)])
    unit = models.CharField(max_length=20, null=True, blank=True)
    place_hint = models.CharField(max_length=120, null=True, blank=True)
    status = models.CharField(max_length=20, choices=[(v, v.title()) for v in ITEM_STATUSES], default='PENDING')
    importance = models.CharField(max_length=10, choices=[(v, v.title()) for v in IMPORTANCES], default='NORMAL')
    confidence = models.FloatField(null=True, blank=True, validators=[MinValueValidator(0), MaxValueValidator(1)])
    is_confirmed = models.BooleanField(default=False)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('created_at', 'id')
        indexes = [models.Index(fields=['note', 'is_confirmed'], name='item_note_confirmed_idx')]
        constraints = [
            models.CheckConstraint(condition=models.Q(amount__gte=0) | models.Q(amount__isnull=True), name='item_nonnegative_amount'),
            models.CheckConstraint(condition=models.Q(quantity__gte=0) | models.Q(quantity__isnull=True), name='item_nonnegative_quantity'),
            models.CheckConstraint(condition=models.Q(confidence__range=(0, 1)) | models.Q(confidence__isnull=True), name='item_confidence_range'),
            models.CheckConstraint(condition=models.Q(item_type__in=ITEM_TYPES), name='item_valid_type'),
            models.CheckConstraint(condition=models.Q(status__in=ITEM_STATUSES), name='item_valid_status'),
            models.CheckConstraint(condition=models.Q(importance__in=IMPORTANCES), name='item_valid_importance'),
        ]

    def __str__(self):
        return self.title
