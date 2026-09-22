from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AppUser


class MeView(APIView):
    """Return the application profile resolved from the Supabase JWT."""

    def get(self, request):
        user = request.user
        if not isinstance(user, AppUser):
            return Response({'detail': 'A Supabase-authenticated user is required.'}, status=status.HTTP_401_UNAUTHORIZED)
        return Response({
            'id': str(user.id),
            'name': user.display_name or user.email,
            'username': user.email,
            'email': user.email,
        })
