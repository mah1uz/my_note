# Rememberly

Rememberly is a React and Django note-taking application. Part 3 provides real Notes CRUD, validated Groq-backed organization with user review, and confirmed NoteItems. The project is transitioning to Supabase PostgreSQL and Supabase Auth for email/password and Google sign-in before Part 4. Places, Search, Daily Briefing, and What Matters Now remain deferred/mock features.

## Local setup

Backend:

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python manage.py migrate
.venv/bin/python manage.py runserver
```

Frontend, in another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Django Admin is available at `http://localhost:8000/admin/` after creating a superuser with `backend/.venv/bin/python backend/manage.py createsuperuser` from the repository root.

The checked-in `.env.example` files document configuration. Local fallback defaults use SQLite, `http://localhost:5173`, and `http://localhost:8000/api/v1`; the target deployment uses Supabase PostgreSQL and Supabase Auth. See `docs/database-migration.md` and `docs/authentication.md`.

For AI organization, the server-owned `GROQ_API_KEY` is optional. If configured,
copy the backend environment example to ignored `backend/.env`; keep the key
backend-only and never put it in frontend environment variables. Authenticated
users may instead enter their own Groq key in the Dashboard. That personal key
is held only in browser memory for the current session, sent only to Django for
AI analysis, and is never saved by this application. A hard refresh requires
entering it again. The selected model and timeout are configurable with
`GROQ_MODEL` and `GROQ_TIMEOUT_SECONDS`.

## Verification

```bash
cd backend
.venv/bin/python manage.py check
.venv/bin/python manage.py makemigrations --check --dry-run
.venv/bin/python manage.py test

cd ../frontend
npm test
npm run test:coverage
npm run build
npm run test:e2e
```

The E2E runner creates a fresh ignored `backend/.e2e.sqlite3` database. On Windows, create `backend/.venv-win` or set `BACKEND_PYTHON` to the Python executable for an environment containing `backend/requirements.txt`.

See `docs/architecture.md`, `docs/erd.md`, `docs/api.md`, `docs/admin.md`, and `docs/testing/part-02-django-fullstack.md` for implementation and verification details.
