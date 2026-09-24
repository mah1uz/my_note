from datetime import date

from django.db import IntegrityError, transaction
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from .models import FinanceTransaction
from .serializers import FinanceTransactionSerializer
from .services import summarize
from config.pagination import StandardPagination


class FinanceTransactionViewSet(viewsets.ModelViewSet):
    serializer_class = FinanceTransactionSerializer
    pagination_class = StandardPagination

    def get_queryset(self):
        queryset = FinanceTransaction.objects.filter(user=self.request.user).select_related(
            'note_item', 'primary_domain',
        )
        direction = self.request.query_params.get('direction')
        if direction:
            queryset = queryset.filter(direction=direction.upper())
        currency = self.request.query_params.get('currency')
        if currency:
            queryset = queryset.filter(currency=currency.upper())
        domain = self.request.query_params.get('primary_domain')
        if domain:
            queryset = queryset.filter(primary_domain__slug=domain)
        note_item = self.request.query_params.get('note_item')
        if note_item:
            # Lets task cards discover the ledger row recorded for one item.
            try:
                queryset = queryset.filter(note_item_id=int(note_item))
            except (TypeError, ValueError):
                queryset = queryset.none()
        return queryset

    def perform_create(self, serializer):
        try:
            with transaction.atomic():
                serializer.save(user=self.request.user)
        except IntegrityError as error:
            # Duplicate note_item linkage or second opening balance.
            raise ValidationError({'detail': 'This transaction conflicts with an existing ledger record.'}) from error

    def perform_update(self, serializer):
        serializer.save()

    @action(detail=False, methods=['get'], url_path='linked')
    def linked(self, request):
        """Batch linkage lookup: {note_item_id: transaction_id} for up to 100 ids.

        One query replaces the per-row ?note_item= lookup tickable rows used
        to fire on mount (N+1 fan-out). Owner-scoped like everything else.
        """
        raw = request.query_params.get('ids') or ''
        try:
            ids = [int(part) for part in raw.split(',') if part.strip()][:100]
        except (TypeError, ValueError):
            return Response({})
        if not ids:
            return Response({})
        rows = FinanceTransaction.objects.filter(
            user=request.user, note_item_id__in=ids,
        ).values('id', 'note_item_id')
        return Response({str(row['note_item_id']): str(row['id']) for row in rows})

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        def parse(name):
            value = request.query_params.get(name)
            if not value:
                return None
            try:
                return date.fromisoformat(value)
            except ValueError as error:
                raise ValidationError({name: 'Use YYYY-MM-DD.'}) from error

        return Response({'currencies': summarize(
            request.user,
            self.get_queryset(),
            date_from=parse('date_from'),
            date_to=parse('date_to'),
        )})
