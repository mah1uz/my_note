# Database Migration Status

Rememberly is moving from local SQLite to Supabase PostgreSQL before Part 4.
The target uses a stable internal UUID `AppUser` as the owner root. Supabase
Auth identities map through `(issuer, subject)` and are not copied as foreign
keys into every content table.

Implemented foundation:

- PostgreSQL configuration through `DATABASE_URL`
- psycopg and `dj-database-url`
- SSL configuration for hosted PostgreSQL
- UUID `AppUser`, `UserAuthIdentity`, and `UserPreference`
- transitional nullable `Note.app_user`
- Supabase JWT verification and first-login provisioning
- private Note, NoteItem, and AI log models removed from Django Admin

The current SQLite data is disposable development data and will not be copied
to Supabase. The existing SQLite file remains only as a local reference. The
target database receives a clean migration and seeded Domain vocabulary.

Use a direct Supabase PostgreSQL connection for migrations when available and
session pooling for an IPv4-only persistent Django runtime. Require SSL. Keep
application data behind Django rather than exposing an uncontrolled second
frontend Data API path. Enable the `vector` extension during Part 4.

Remaining gates are final AppUser-only ownership, UUID content tables, the AI
run/artifact split, explicit NoteItemDomain, safe admin projections/audits,
Supabase Auth cutover, and full PostgreSQL regression/user-isolation tests.

## Supabase Data API lockdown

Supabase exposes every `public` table to the `anon` and `authenticated` roles
through its REST Data API. Rememberly never uses that path: the frontend uses
Supabase only for Auth, and Django (connecting as the table owner, which
bypasses RLS) is the sole data path. `accounts.apps.lock_down_data_api` runs
after every `migrate` on PostgreSQL and (re)enables Row Level Security on every
`public` table, with no policies, and revokes all table, sequence and function
grants from `anon` and `authenticated`, including default privileges for future
tables. This closes the `rls_disabled_in_public` and
`sensitive_columns_exposed` advisories. Do not add RLS policies for those roles
unless the frontend is deliberately changed to query tables directly.
