from django.apps import AppConfig
from django.db import DEFAULT_DB_ALIAS, connections
from django.db.models.signals import post_migrate

# Supabase exposes every table in the ``public`` schema through its Data API
# (PostgREST) to the ``anon`` and ``authenticated`` roles. Rememberly keeps all
# application data behind Django, which connects as the table owner and bypasses
# Row Level Security, so those two roles must never be able to touch any table.
# Enabling RLS with no policies denies them everything; revoking the grants
# removes them from the API schema entirely. Re-run after every migrate so
# tables created by future migrations are covered automatically.
LOCK_DOWN_DATA_API_SQL = """
DO $lockdown$
DECLARE
    t record;
    api_role text;
BEGIN
    FOR t IN
        SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
    END LOOP;

    FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
            EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', api_role);
            EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', api_role);
            EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', api_role);
            EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', api_role);
            EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', api_role);
            EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', api_role);
        END IF;
    END LOOP;
END
$lockdown$;
"""


def lock_down_data_api(using=DEFAULT_DB_ALIAS, **kwargs):
    connection = connections[using]
    if connection.vendor != 'postgresql':
        return
    with connection.cursor() as cursor:
        cursor.execute(LOCK_DOWN_DATA_API_SQL)


class AccountsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'accounts'

    def ready(self):
        post_migrate.connect(
            lock_down_data_api,
            sender=self,
            dispatch_uid='accounts.lock_down_data_api',
        )
