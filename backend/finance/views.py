from datetime import date

from django.db import IntegrityError, transaction
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from .models import FinanceTransaction
from .serializers import FinanceTransactionSerializer
from .services import summarize


class FinanceTransactionViewSet(viewsets.ModelViewSet):
    serializer_class = FinanceTransactionSerializer

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
