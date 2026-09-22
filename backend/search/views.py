from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import deterministic_answer, generate_grounded_answer, retrieve


class SearchView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        query = str(request.data.get('query', '')).strip()
        if not query:
            raise ValidationError({'query': 'Enter a search query.'})
        try:
            parsed, results = retrieve(request.user, query)
        except ValueError as error:
            raise ValidationError({'query': str(error)}) from error
        return Response({'query': query, 'mode': 'lexical', 'parsed': _serialize_parsed(parsed), 'results': results})


class SearchAnswerView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        query = str(request.data.get('query', '')).strip()
        if not query:
            raise ValidationError({'query': 'Enter a question.'})
        try:
            parsed, results = retrieve(request.user, query)
        except ValueError as error:
            raise ValidationError({'query': str(error)}) from error
        answer = deterministic_answer(request.user, parsed)
        if answer is None:
            try:
                answer = generate_grounded_answer(request.user, query, results)
            except Exception:
                answer = {'answer': "I couldn't produce a sufficiently grounded answer from your notes.", 'sources': [], 'mode': 'abstained'}
        return Response({'query': query, 'results': results, **answer})


def _serialize_parsed(parsed):
    return {key: value.isoformat() if hasattr(value, 'isoformat') else str(value) if hasattr(value, 'as_tuple') else value for key, value in parsed.items()}
