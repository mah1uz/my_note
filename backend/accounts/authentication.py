import jwt
from django.conf import settings
from rest_framework import authentication, exceptions

from .services.provisioning import provision_from_claims


class SupabaseJWTAuthentication(authentication.BaseAuthentication):
    """Verify Supabase access JWTs using the project JWKS endpoint."""

    _jwks_client = None
    _jwks_url = None

    def authenticate_header(self, request):
        return 'Bearer'

    @classmethod
    def _client(cls):
        url = settings.SUPABASE_JWKS_URL
        if not url:
            raise exceptions.AuthenticationFailed('Supabase JWT verification is not configured.')
        if cls._jwks_client is None or cls._jwks_url != url:
            cls._jwks_client = jwt.PyJWKClient(url, cache_jwk_set=True, lifespan=600)
            cls._jwks_url = url
        return cls._jwks_client

    def authenticate(self, request):
        header = authentication.get_authorization_header(request).split()
        if not header:
            return None
        if len(header) != 2 or header[0].lower() != b'bearer':
            raise exceptions.AuthenticationFailed('Invalid Authorization header.')
        try:
            token = header[1].decode('utf-8')
            signing_key = self._client().get_signing_key_from_jwt(token).key
            claims = jwt.decode(
                token,
                signing_key,
                algorithms=['ES256', 'RS256'],
                audience=settings.SUPABASE_JWT_AUDIENCE,
                issuer=f'{settings.SUPABASE_URL}/auth/v1',
                options={'require': ['exp', 'iat', 'iss', 'sub', 'aud']},
            )
            user = provision_from_claims(claims)
        except (jwt.PyJWTError, UnicodeDecodeError) as error:
            raise exceptions.AuthenticationFailed('Invalid or expired Supabase access token.') from error
        except PermissionError as error:
            raise exceptions.AuthenticationFailed(str(error)) from error
        except ValueError as error:
            raise exceptions.AuthenticationFailed(str(error)) from error
        return user, claims
