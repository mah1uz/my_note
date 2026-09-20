# Rememberly

Rememberly is a React and Django note-taking prototype. Part 2 provides real authentication and user-owned Notes CRUD backed by SQLite. Tasks, Events, Shopping, Expenses, Places, Search, Daily Briefing, and What Matters Now still use frontend mock data.

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

The checked-in `.env.example` files document optional configuration. Development defaults use SQLite, `http://localhost:5173`, and `http://localhost:8000/api/v1`.

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

See `docs/architecture.md`, `docs/erd.md`, `docs/api.md`, `docs/admin.md`, and `docs/testing/part-02-django-fullstack.md` for implementation and verification details.
