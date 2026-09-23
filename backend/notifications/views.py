import logging

from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Notification
from .serializers import NotificationSerializer
from .services import evaluate_for_user

logger = logging.getLogger(__name__)


class NotificationViewSet(viewsets.GenericViewSet):
    serializer_class = NotificationSerializer

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

    def list(self, request):
        # Poll-evaluated: each list call refreshes due/expense eligibility
        # first. Evaluation failures never break the list itself.
        try:
            evaluate_for_user(request.user)
        except Exception:
            logger.exception('Notification poll evaluation failed for user %s', request.user.pk)
        queryset = self.get_queryset().order_by('-created_at', '-id')[:100]
        return Response(self.get_serializer(queryset, many=True).data)

    @action(detail=True, methods=['post'], url_path='read')
    def mark_read(self, request, pk=None):
        try:
            notification = self.get_queryset().get(pk=pk)
        except (Notification.DoesNotExist, ValueError, TypeError):
            return Response({'detail': 'Notification not found.'}, status=status.HTTP_404_NOT_FOUND)
        if notification.read_at is None:
            notification.read_at = timezone.now()
            notification.save(update_fields=('read_at',))
        return Response(self.get_serializer(notification).data)

    @action(detail=False, methods=['post'], url_path='read-all')
    def mark_all_read(self, request):
        updated = self.get_queryset().filter(read_at__isnull=True).update(read_at=timezone.now())
        return Response({'marked_read': updated})
