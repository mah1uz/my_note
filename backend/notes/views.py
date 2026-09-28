from django.db import transaction
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from ai.services.groq_service import ProviderFailure
from ai.services.providers import normalize_provider, provider_label
from . import services
from .constants import DOMAINS, ITEM_STATUSES, ITEM_TYPES
from .item_serializers import ConfirmationSerializer, ItemInputSerializer, ItemUpdateSerializer, NoteItemSerializer, RevisionSerializer
from .models import Domain, Note, NoteItem
from .serializers import NoteSerializer


def _resolve_ai_credentials(request):
    """Provider + personal key + trial flag for analyze endpoints.

    New headers (X-AI-Provider / X-AI-Api-Key / X-AI-Trial) win; legacy
    X-Groq-* headers are accepted as Groq aliases. Returns
    (provider, user_api_key, trial) or a DRF Response on invalid input.
    """
    headers = request.headers
    raw_provider = headers.get('X-AI-Provider', '').strip()
    legacy_key = headers.get('X-Groq-Api-Key', '').strip()
    if not raw_provider and legacy_key:
        raw_provider = 'groq'
    try:
        provider = normalize_provider(raw_provider or 'groq')
    except ValueError as error:
        return Response({'detail': str(error), 'code': 'invalid_provider'}, status=400)
    user_api_key = headers.get('X-AI-Api-Key', '').strip() or legacy_key or None
    if user_api_key and len(user_api_key) > 200:
        return Response({
            'detail': f'The {provider_label(provider)} API key is invalid. Enter a valid key and try again.',
            'code': 'invalid_key',
        }, status=400)
    trial = (
        headers.get('X-AI-Trial', '').strip().lower()
        or headers.get('X-Groq-Trial', '').strip().lower()
    ) in ('1', 'true', 'yes', 'on')
    return provider, user_api_key, trial


class AnalyzeThrottle(UserRateThrottle):
    scope = 'analyze'


class BulkThrottle(UserRateThrottle):
    scope = 'bulk'


def review_data(note):
    return {
        'note': NoteSerializer(note).data,
        'items': NoteItemSerializer(note.items.select_related('note').prefetch_related('domains'), many=True).data,
        'domains': list(Domain.objects.filter(slug__in=[slug for slug, _ in DOMAINS]).values('slug', 'name')),
        'analysis_running': services.analysis_is_running(note),
    }


class NoteViewSet(viewsets.ModelViewSet):
    serializer_class = NoteSerializer

    def get_queryset(self):
        return Note.objects.filter(app_user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(app_user=self.request.user)

    def perform_update(self, serializer):
        note = serializer.instance
        text_changed = serializer.validated_data.get('raw_text', note.raw_text) != note.raw_text
        # Optional optimistic concurrency: clients that send the revision they
        # edited get a 409 on conflict instead of silent last-writer-wins.
        # Absent revision keeps the legacy behavior.
        raw_revision = self.request.data.get('revision', None)
        try:
            expected = note.revision if raw_revision is None else int(raw_revision)
        except (TypeError, ValueError):
            raise ValidationError({'revision': 'Revision must be an integer.'})
        with transaction.atomic():
            changes = {'processing_status': 'UNPROCESSED', 'analysis_started_at': None, 'ai_title': ''} if text_changed else {}
            services.claim_revision(note, expected, **changes)
            if text_changed:
                note.items.filter(is_confirmed=False).delete()
            serializer.save()

    @action(detail=True, methods=['get'])
    def review(self, request, pk=None):
        return Response(review_data(self.get_object()))

    @action(detail=True, methods=['post'], throttle_classes=[AnalyzeThrottle])
    def analyze(self, request, pk=None):
        note = self.get_object()
        serializer = RevisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        credentials = _resolve_ai_credentials(request)
        if isinstance(credentials, Response):
            return credentials
        provider, user_api_key, trial = credentials
        try:
            services.analyze(note, serializer.validated_data['revision'], user_api_key=user_api_key, trial=trial, provider=provider)
        except ProviderFailure as error:
            return Response({
                'detail': f'AI organization failed. Your note is saved. {error}',
                'code': error.code,
            }, status=error.status_code)
        return Response(review_data(note))

    @action(detail=True, methods=['post'], url_path='confirm-analysis')
    def confirm_analysis(self, request, pk=None):
        note = self.get_object()
        serializer = ConfirmationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.confirm(note, **serializer.validated_data)
        return Response(review_data(note))

    @action(detail=False, methods=['post'], url_path='process-all', throttle_classes=[BulkThrottle])
    def process_all(self, request):
        """Sequentially process the owned backlog (UNPROCESSED + FAILED).

        Mode 'analyze' is fully automatic: it analyzes and confirms every
        note with no per-note review step. Mode 'verify' analyzes only and
        leaves drafts for manual per-note review. Same credential contract
        as single-note analysis: personal key or trial, never stored.
        """
        mode = str(request.data.get('mode') or 'analyze').strip().lower()
        credentials = _resolve_ai_credentials(request)
        if isinstance(credentials, Response):
            return credentials
        provider, user_api_key, trial = credentials
        try:
            return Response(services.process_backlog(request.user, mode, user_api_key=user_api_key, trial=trial, provider=provider))
        except ProviderFailure as error:
            detail = 'Bulk processing could not start. ' if mode in ('analyze', 'verify') else 'Bulk processing failed. '
            return Response({
                'detail': f'{detail}{error}',
                'code': error.code,
            }, status=error.status_code)


class NoteItemViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    serializer_class = NoteItemSerializer

    def get_queryset(self):
        # Drafts are available only through their owned Note's review endpoint.
        queryset = NoteItem.objects.filter(note__app_user=self.request.user, is_confirmed=True).select_related('note').prefetch_related('domains')
        if self.action == 'list':
            queryset = queryset.filter(note__is_archived=False).exclude(status='ARCHIVED')
            for param, field, allowed in (
                ('type', 'item_type', ITEM_TYPES), ('status', 'status', ITEM_STATUSES),
                ('domain', 'domains__slug', [slug for slug, _ in DOMAINS]),
            ):
                value = self.request.query_params.get(param)
                if value:
                    if value not in allowed:
                        raise ValidationError({param: 'Unsupported filter value.'})
                    queryset = queryset.filter(**{field: value})
        return queryset.order_by('-created_at', '-id')

    def create(self, request, *args, **kwargs):
        # Manual category entry: validated standalone input, never trusts owner/confirmed flags.
        serializer = ItemInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item = services.create_standalone_item(request.user, serializer.validated_data)
        return Response(NoteItemSerializer(item).data, status=201)

    def partial_update(self, request, pk=None):
        item = self.get_object()
        # revision remains mandatory even for PATCH.
        revision = RevisionSerializer(data={'revision': request.data.get('revision')})
        revision.is_valid(raise_exception=True)
        serializer = ItemUpdateSerializer(item, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        changes = dict(serializer.validated_data)
        changes.pop('revision', None)
        services.edit_confirmed(item, revision.validated_data['revision'], changes)
        return Response(NoteItemSerializer(item).data)
