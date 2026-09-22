# Rememberly

Rememberly is a React and Django note-taking application. It provides real
Notes CRUD, validated Groq-backed organization with user review, and confirmed
NoteItems (Tasks, Events, Shopping, Expenses). Authentication is Supabase Auth
(email/password and Google sign-in) backed by Supabase PostgreSQL, with notes
owned by an internal `AppUser` UUID. User preferences (notifications,
reminders, week start, currency, timezone) persist per account. Places, Search,
Daily Briefing content, and What Matters Now remain deferred/mock features.

## Local setup

Backend:

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
```

Edit ignored `backend/.env` with your Supabase values (see
`docs/database-migration.md` and `docs/authentication.md`):

- `DATABASE_URL` — Supabase session-pooler PostgreSQL URL on port `5432`
  (URL-encode special characters in the password), plus
  `DATABASE_SSL_REQUIRE=true`
- `SUPABASE_URL`, `SUPABASE_JWT_AUDIENCE=authenticated`, `SUPABASE_JWKS_URL`
- Optional `GROQ_API_KEY` — enables the in-app Free trial; keep it
  backend-only and never put it in frontend environment variables

Then:

```bash
.venv/bin/python manage.py migrate
.venv/bin/python manage.py runserver
```

Frontend, in another terminal:

```bash
cd frontend
npm install
cp .env.example .env
```

Edit ignored `frontend/.env` with `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`,
and `VITE_SUPABASE_PUBLISHABLE_KEY` (publishable key only — never secret or
service-role keys), then:

```bash
npm run dev
```

Open `http://localhost:5173`. Google sign-in requires the Google provider to
be enabled in Supabase with the redirect allow-listed
(`http://localhost:5173/auth/callback` locally). Django Admin is available at
`http://localhost:8000/admin/` after creating a superuser with
`backend/.venv/bin/python backend/manage.py createsuperuser` from the
repository root.

For AI organization, users either start the **Free trial** (uses the
server-owned key when configured) or paste their own key in the AI Provider
card on the Settings page. Any personal key is held only in browser memory for
the current session, sent only to Django for AI analysis, and is never saved
by this application — logout, account switch, or refresh clears it. The
selected model and timeout are configurable with `GROQ_MODEL` and
`GROQ_TIMEOUT_SECONDS`.

## Verification

```bash
cd backend
.venv/bin/python manage.py check
.venv/bin/python manage.py makemigrations --check
.venv/bin/python manage.py test --keepdb -v 1

cd ../frontend
npm test
npm run build
```

`--keepdb` is required because Django cannot drop the temporary test database
through the Supabase session pooler; drop the leftover `test_postgres`
database afterwards if desired. `npm run test:coverage` and
`npm run test:e2e` are also available; the E2E runner creates a fresh ignored
`backend/.e2e.sqlite3` database. On Windows, create `backend/.venv-win` or
set `BACKEND_PYTHON` to the Python executable for an environment containing
`backend/requirements.txt`.

See `docs/architecture.md`, `docs/erd.md`, `docs/api.md`, `docs/admin.md`,
`docs/authentication.md`, and `docs/plans/after_part_3_plan.md` for
implementation and verification details.
