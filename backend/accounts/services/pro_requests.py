import secrets

from django.db import IntegrityError

from accounts.models import ProAccessRequest

# Unambiguous alphabet: no 0/O, 1/I/l. 8 chars ≈ 41 bits of entropy.
CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
CODE_LENGTH = 8
CODE_ATTEMPTS = 5


def generate_pro_code():
    for _ in range(CODE_ATTEMPTS):
        yield ''.join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
    raise IntegrityError('Could not generate a unique Pro request code.')


def create_pro_request(user, reason=''):
    """Create a pending request, or return the open one (spam guard).

    Returns (request, created). The code is the opaque token: random,
    unique, and meaningless outside this table.
    """
    pending = ProAccessRequest.objects.filter(user=user, status=ProAccessRequest.Status.PENDING).first()
    if pending is not None:
        return pending, False
    last_error = None
    for code in generate_pro_code():
        try:
            return ProAccessRequest.objects.create(user=user, code=code, reason=reason), True
        except IntegrityError as error:
            last_error = error
    raise last_error
