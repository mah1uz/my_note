"""Multi-provider LLM abstraction: Groq and Gemini behind one contract.

Both providers share the system prompt, the JSON schema contract, and the
ProviderFailure error shape, so analysis, validation, and review code stays
provider-agnostic. Provider-specific code lives in groq_service.py and
gemini_service.py (transport + error mapping only).
"""
import re

from django.conf import settings

PROVIDERS = ('groq', 'gemini')
DEFAULT_PROVIDER = 'groq'

PROVIDER_LABELS = {'groq': 'Groq', 'gemini': 'Gemini'}


class ProviderFailure(Exception):
    def __init__(self, code, message, status_code=502):
        super().__init__(message)
        self.code = code
        self.status_code = status_code


def normalize_provider(value):
    """Return 'groq' or 'gemini'; blank/None means the default. Raises ValueError."""
    provider = str(value or '').strip().lower() or DEFAULT_PROVIDER
    if provider not in PROVIDERS:
        raise ValueError(f"Unknown AI provider '{value}'. Use 'groq' or 'gemini'.")
    return provider


def provider_label(provider):
    return PROVIDER_LABELS.get(provider, provider)


def validate_key_format(raw, provider=None):
    """Cheap shape check only — no provider call, no quota spent.

    Deliberately generic: any 20–200 character key is accepted for either
    provider. The Settings UI tells users which prefix to expect (Groq keys
    start with gsk_, Gemini keys with AIza), but the backend does not
    hard-block on prefixes so future key shapes keep working. A wrong key
    for the selected provider surfaces as invalid_key from the provider.
    """
    value = str(raw or '').strip()
    return 20 <= len(value) <= 200


def model_name(provider):
    provider = normalize_provider(provider)
    if provider == 'gemini':
        return getattr(settings, 'GEMINI_MODEL', '')
    return getattr(settings, 'GROQ_MODEL', '')


def timeout_seconds(provider):
    provider = normalize_provider(provider)
    if provider == 'gemini':
        return float(getattr(settings, 'GEMINI_TIMEOUT_SECONDS', 20))
    return float(getattr(settings, 'GROQ_TIMEOUT_SECONDS', 20))


def prompt_version(provider):
    from ai.services import gemini_service, groq_service

    provider = normalize_provider(provider)
    if provider == 'gemini':
        return gemini_service.PROMPT_VERSION
    return groq_service.PROMPT_VERSION


def redact(text, extra_key=''):
    text = str(text)
    for secret in (getattr(settings, 'GROQ_API_KEY', ''), getattr(settings, 'GEMINI_API_KEY', ''), extra_key):
        if secret:
            text = text.replace(secret, '[REDACTED]')
    text = re.sub(r'gsk_[A-Za-z0-9_-]+', '[REDACTED]', text)
    text = re.sub(r'AIza[A-Za-z0-9_-]{35}', '[REDACTED]', text)
    return text


def _gemini_pool_candidates():
    """Decrypted active Gemini pool keys in round-robin order.

    A missing/invalid SERVER_KEY_SECRET simply yields no pool keys; the
    GEMINI_API_KEY .env fallback below keeps working. Corrupt rows are skipped.
    """
    from accounts.services import trial_keys

    try:
        pool = trial_keys.active_keys('gemini')
    except trial_keys.KeyMisconfigured:
        return []
    candidates = []
    for key in pool:
        try:
            candidates.append((key, trial_keys.decrypt_key(key)))
        except trial_keys.KeyMisconfigured:
            continue
    return candidates


def analyze_note(raw_text, now, api_key=None, provider=DEFAULT_PROVIDER, tz_name=None):
    """Dispatch one bounded provider call.

    Groq trial-key rotation lives inside groq_service (unchanged, heavily
    tested). Gemini rotation lives here: pool keys first, GEMINI_API_KEY
    .env fallback last, rotating only on key-attributable failures.
    """
    from django.conf import settings as django_settings

    from ai.services import gemini_service, groq_service

    provider = normalize_provider(provider)
    if provider == 'groq':
        return groq_service.analyze_note(raw_text, now, api_key=api_key, tz_name=tz_name)
    if api_key:
        return gemini_service.analyze_note(raw_text, now, api_key=api_key, tz_name=tz_name)
    from accounts.services import trial_keys

    candidates = _gemini_pool_candidates()
    if django_settings.GEMINI_API_KEY:
        candidates.append((None, django_settings.GEMINI_API_KEY))
    if not candidates:
        raise gemini_service.ProviderFailure(
            'not_configured', 'A Gemini API key is required to use AI organization.', 503)
    last_error = None
    for key, candidate in candidates:
        try:
            content = gemini_service._call_provider(raw_text, now, candidate, tz_name)
        except gemini_service.ProviderFailure as error:
            if error.code in ('rate_limit', 'invalid_key') and key is not None:
                trial_keys.record_failure(key, error.code)
                last_error = last_error or error
                continue
            raise
        if key is not None:
            trial_keys.record_use(key)
            trial_keys.record_success(key)
        return content
    raise last_error or gemini_service.ProviderFailure(
        'not_configured', 'A Gemini API key is required to use AI organization.', 503)
