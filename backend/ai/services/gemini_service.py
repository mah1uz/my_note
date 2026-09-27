"""Gemini provider call over the REST generateContent API (stdlib only, no SDK).

Same contract as groq_service: one bounded call returning the raw JSON text,
which the shared schema validator parses. Error mapping mirrors Groq's
ProviderFailure codes so callers stay provider-agnostic.
"""
import json
import socket
import urllib.error
import urllib.request

from ai.services.groq_service import SYSTEM_PROMPT
from ai.services.providers import ProviderFailure, redact, timeout_seconds
from ai.schema import ANALYSIS_SCHEMA

PROMPT_VERSION = 'v1'

API_HOST = 'https://generativelanguage.googleapis.com'


def _model():
    from django.conf import settings

    return (getattr(settings, 'GEMINI_MODEL', '') or '').strip()


def _request_body(raw_text, now, tz_name):
    from django.conf import settings

    return {
        'system_instruction': {'parts': [
            {'text': SYSTEM_PROMPT + '\nJSON schema:\n' + json.dumps(ANALYSIS_SCHEMA)},
        ]},
        'contents': [{'role': 'user', 'parts': [{'text': json.dumps({
            'current_datetime': now.isoformat(),
            'timezone': tz_name or settings.TIME_ZONE,
            'note': raw_text,
        }, ensure_ascii=False)}]}],
        'generationConfig': {
            'responseMimeType': 'application/json',
            'temperature': 0,
            'maxOutputTokens': 6000,
        },
    }


def _error_body(error):
    try:
        return error.read().decode('utf-8', 'replace')[:2000]
    except Exception:
        return ''


def _call_provider(raw_text, now, candidate_key, tz_name=None):
    model = _model()
    if not model:
        raise ProviderFailure('not_configured', 'A Gemini model is not configured.', 503)
    url = f'{API_HOST}/v1beta/models/{model}:generateContent'
    payload = json.dumps(_request_body(raw_text, now, tz_name)).encode('utf-8')
    request = urllib.request.Request(
        url, data=payload, method='POST',
        headers={'Content-Type': 'application/json', 'x-goog-api-key': candidate_key},
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout_seconds('gemini')) as response:
            envelope = json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as error:
        body = _error_body(error)
        detail = redact(body)[:200]
        if error.code in (401, 403) or (error.code == 400 and 'api key' in body.lower()):
            raise ProviderFailure(
                'invalid_key', 'The Gemini API key was rejected. Enter a valid key and try again.', 502) from error
        if error.code == 429:
            raise ProviderFailure('rate_limit', 'The AI provider is rate-limited. Try again later.', 503) from error
        raise ProviderFailure(
            'provider',
            f'The AI provider could not complete the request (status {error.code}). {detail}',
        ) from error
    except (socket.timeout, TimeoutError) as error:
        raise ProviderFailure('timeout', 'The AI request timed out.', 504) from error
    except urllib.error.URLError as error:
        raise ProviderFailure('network', 'The AI provider could not be reached.', 503) from error
    except (ValueError, OSError) as error:
        raise ProviderFailure('unexpected', 'AI processing could not be completed.') from error
    try:
        candidate = (envelope.get('candidates') or [None])[0] or {}
        parts = ((candidate.get('content') or {}).get('parts') or [])
        text = ''.join(str(part.get('text') or '') for part in parts if isinstance(part, dict))
        finish = candidate.get('finishReason')
    except (AttributeError, TypeError) as error:
        raise ProviderFailure('invalid_output', 'The AI response failed validation.') from error
    if not text:
        raise ProviderFailure('incomplete', 'The AI response was incomplete. Try a shorter note.')
    if finish not in ('STOP', None):
        # An explicit non-STOP reason (e.g. MAX_TOKENS, SAFETY) means the
        # JSON is likely truncated or refused. Absent finishReason is fine.
        raise ProviderFailure('incomplete', 'The AI response was incomplete. Try a shorter note.')
    return text


def analyze_note(raw_text, now, api_key=None, tz_name=None):
    if not api_key:
        raise ProviderFailure('not_configured', 'A Gemini API key is required to use AI organization.', 503)
    return _call_provider(raw_text, now, api_key, tz_name)
