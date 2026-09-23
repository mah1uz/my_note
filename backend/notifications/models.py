import uuid

from django.db import models


class Notification(models.Model):
    """In-app notification owned by one user.

    Rows are created by explicit product events (task transitions, evaluated
    triggers) and never by fetches or page views. Admin records live in
    AdminAuditEvent; they never appear here.
    """

    class Type(models.TextChoices):
        TASK_DUE_SOON = 'TASK_DUE_SOON', 'Task due soon'
        TASK_COMPLETED = 'TASK_COMPLETED', 'Task completed'
        EXPENSE_INCREASED = 'EXPENSE_INCREASED', 'Expense increased'
        SYSTEM = 'SYSTEM', 'System'
        PRO_REQUEST_UPDATE = 'PRO_REQUEST_UPDATE', 'Pro request update'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey('accounts.AppUser', on_delete=models.CASCADE, related_name='notifications')
    type = models.CharField(max_length=24, choices=Type.choices)
    title = models.CharField(max_length=200)
    message = models.CharField(max_length=500, blank=True, default='')
    payload = models.JSONField(default=dict, blank=True)
    dedup_key = models.CharField(max_length=128, null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'notifications'
        ordering = ('-created_at', '-id')
        constraints = [
            models.CheckConstraint(
                condition=models.Q(type__in=[
                    'TASK_DUE_SOON', 'TASK_COMPLETED', 'EXPENSE_INCREASED',
                    'SYSTEM', 'PRO_REQUEST_UPDATE',
                ]),
                name='notification_valid_type',
            ),
            models.UniqueConstraint(
                fields=('user', 'dedup_key'),
                name='notification_user_dedup_unique',
            ),
        ]
        indexes = [
            models.Index(fields=('user', '-created_at'), name='notification_user_created_idx'),
            models.Index(fields=('user', 'read_at'), name='notification_user_read_idx'),
        ]

    def __str__(self):
        return f'{self.type} for {self.user_id}'
