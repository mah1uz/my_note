import os
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv
from corsheaders.defaults import default_headers

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')


def env_bool(name, default=False):
    return os.getenv(name, str(default)).lower() in {'1', 'true', 'yes', 'on'}


def env_list(name, default=''):
    return [value.strip() for value in os.getenv(name, default).split(',') if value.strip()]


DEBUG = env_bool('DJANGO_DEBUG', True)
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY')
if not SECRET_KEY:
    if not DEBUG:
        raise RuntimeError('DJANGO_SECRET_KEY is required when DEBUG is false.')
    SECRET_KEY = 'development-only-change-before-production'

ALLOWED_HOSTS = env_list('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1,testserver')
SUPABASE_URL = os.getenv('SUPABASE_URL', '').rstrip('/')
SUPABASE_JWT_AUDIENCE = os.getenv('SUPABASE_JWT_AUDIENCE', 'authenticated')
SUPABASE_JWKS_URL = os.getenv(
    'SUPABASE_JWKS_URL',
    f'{SUPABASE_URL}/auth/v1/.well-known/jwks.json' if SUPABASE_URL else '',
)

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'rest_framework',
    'rest_framework.authtoken',
    'accounts',
    'notes',
    'finance',
    'notifications',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'
TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [],
    'APP_DIRS': True,
    'OPTIONS': {'context_processors': [
        'django.template.context_processors.request',
        'django.contrib.auth.context_processors.auth',
        'django.contrib.messages.context_processors.messages',
    ]},
}]
WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

DATABASE_URL = os.getenv('DATABASE_URL', '').strip()
if DATABASE_URL:
    DATABASES = {
        'default': dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=int(os.getenv('DATABASE_CONN_MAX_AGE', '60')),
            conn_health_checks=True,
        ),
    }
    if env_bool('DATABASE_SSL_REQUIRE', not DEBUG):
        DATABASES['default']['OPTIONS'] = {
            **DATABASES['default'].get('OPTIONS', {}),
            'sslmode': os.getenv('DATABASE_SSLMODE', 'require'),
        }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': os.getenv('DJANGO_DB_PATH', BASE_DIR / 'db.sqlite3'),
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 6}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Dhaka'
USE_I18N = True
USE_TZ = True
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
}
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

CORS_ALLOWED_ORIGINS = env_list(
    'CORS_ALLOWED_ORIGINS',
    'http://localhost:5173,http://127.0.0.1:5173',
)
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = (*default_headers, 'x-groq-api-key', 'x-groq-trial')
CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ('accounts.authentication.SupabaseJWTAuthentication',),
    'DEFAULT_PERMISSION_CLASSES': ('rest_framework.permissions.IsAuthenticated',),
    'DEFAULT_RENDERER_CLASSES': ('rest_framework.renderers.JSONRenderer',),
    'DEFAULT_PARSER_CLASSES': ('rest_framework.parsers.JSONParser',),
    'DEFAULT_THROTTLE_CLASSES': (
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ),
    'DEFAULT_THROTTLE_RATES': {'anon': '60/min', 'user': '300/min', 'analyze': '6/min', 'bulk': '30/hour', 'pro': '10/hour'},
}

EMAIL_BACKEND = os.getenv(
    'EMAIL_BACKEND',
    'django.core.mail.backends.console.EmailBackend' if DEBUG else 'django.core.mail.backends.smtp.EmailBackend',
)
DEFAULT_FROM_EMAIL = 'Rememberly <no-reply@rememberly.local>'

# AI is optional: ordinary Notes CRUD and manual organization need no key.
GROQ_API_KEY = os.getenv('GROQ_API_KEY', '')
# Groq retired llama-3.3-70b-versatile on 2026-08-16; gpt-oss-120b is their
# recommended replacement. Override per environment with GROQ_MODEL.
GROQ_MODEL = os.getenv('GROQ_MODEL', 'openai/gpt-oss-120b')
GROQ_TIMEOUT_SECONDS = float(os.getenv('GROQ_TIMEOUT_SECONDS', '20'))
AI_MAX_NOTE_CHARACTERS = 12000
AI_ANALYSIS_LEASE_SECONDS = 120
