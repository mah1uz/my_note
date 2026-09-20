from django.conf import settings
from django.db import models


class Note(models.Model):
    class ProcessingStatus(models.TextChoices):
        UNPROCESSED = 'UNPROCESSED', 'Unprocessed'
        PROCESSING = 'PROCESSING', 'Processing'
        PROCESSED = 'PROCESSED', 'Processed'
        FAILED = 'FAILED', 'Failed'
        REVIEW_REQUIRED = 'REVIEW_REQUIRED', 'Review required'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notes')
    raw_text = models.TextField()
    processing_status = models.CharField(max_length=20, choices=ProcessingStatus.choices, default=ProcessingStatus.UNPROCESSED)
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return self.raw_text[:60]
