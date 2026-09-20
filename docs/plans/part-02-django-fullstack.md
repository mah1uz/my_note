# PART 2 OF 6 — DATABASE, DJANGO & FULL-STACK CONNECTION

## Project
AI Context-Aware Note-Taking Web Application

## Starting point
Part 1 produced a React frontend prototype using mock/local data.

Part 2 converts the core app into a real full-stack application:

```text
React
  ↕ REST API
Django + Django REST Framework
  ↕
SQLite
```

AI is **not** part of Part 2.

---

## Role and working rules
Act as a senior full-stack developer and pair programmer.

Before modifying files:
1. Inspect the Part 1 repository.
2. Summarize the relevant frontend architecture.
3. Propose the Part 2 implementation plan.
4. Present the ERD.
5. List backend/frontend files to create/modify.
6. Explain React → API → Django → database flow.
7. Wait for explicit implementation commands.

Do not implement later parts early.

---

## Goal
At the end of Part 2, users can:
- register
- log in
- log out
- access protected pages
- create notes
- view notes
- view one note
- edit notes
- delete notes

Notes must persist in SQLite.

User A must never be able to access User B's notes.

Authentication and Notes become real. Other feature pages may remain mocked.

---

## Do not implement in Part 2
- Groq
- AI classification/extraction
- AI confidence/review
- RAG
- embeddings
- PostgreSQL
- pgvector
- semantic search
- maps/geolocation
- notifications/reminders
- Daily Briefing
- What Matters Now logic
- expense intelligence

---

## Implementation order
### Step A — Inspect Part 1 and design ERD
### Step B — Django backend foundation
### Step C — Core database models
### Step D — Authentication API
### Step E — Notes REST API
### Step F — Connect React to Django
### Step G — Full-stack manual testing

Stop for review between steps.

---

# STEP A — ERD AND DATABASE DESIGN

## Long-term entities
The final system will eventually include:
- User
- Note
- NoteItem
- Domain
- AIProcessingLog
- Place
- Reminder
- NoteEmbedding

Part 2 should implement only what is needed now or foundational for Part 3.

### User
Use Django's built-in user/authentication system.

Relationship:
```text
User 1 ─── many Note
```

### Note
Suggested fields:
- id
- user
- raw_text
- created_at
- updated_at
- processing_status
- is_archived

Suggested processing statuses:
- UNPROCESSED
- PROCESSING
- PROCESSED
- FAILED
- REVIEW_REQUIRED

In Part 2, new notes normally begin as `UNPROCESSED`.

### NoteItem
Design now because Part 3 needs one Note → many structured items.

Example:
```text
Note
  ├── Event
  ├── Task
  └── Expense
```

Before implementing, explain whether NoteItem should be created now or in Part 3. Prefer avoiding unused complexity. If created now, it should not pretend AI exists.

### Domain
Future many-to-many relationship:
```text
NoteItem many ↔ many Domain
```

Plan now. Implement only if justified.

### Future-only tables
Document but do not implement yet:
- AIProcessingLog
- Place
- Reminder
- NoteEmbedding

### ERD deliverable
Show:
- PKs
- FKs
- many-to-many relations
- nullable fields
- cascade behavior
- user ownership

Do not code models until ERD is approved.

---

# STEP B — DJANGO FOUNDATION

## Suggested backend structure
```text
backend/
  manage.py
  config/
    settings.py
    urls.py
    wsgi.py
    asgi.py
  accounts/
  notes/
  requirements.txt
  .env
  .env.example
```

Prefer only `accounts` and `notes` apps in this part unless another app is clearly necessary.

## Python environment
Create a virtual environment and install only necessary packages, likely:
- Django
- djangorestframework
- django-cors-headers
- djangorestframework-simplejwt
- lightweight env handling if needed

Do not install AI/vector packages.

## Settings
Configure:
- DRF
- CORS
- JWT authentication
- SQLite
- environment variables
- timezone `Asia/Dhaka`

Keep secrets out of source control.

## CORS
Allow the Vite dev origin only during development. Do not configure unrestricted production CORS.

## Database
Use SQLite for Part 2.

## Django Admin
Enable `/admin/` and register implemented models. Explain how Admin helps debugging.

---

# STEP C — CORE MODELS

At minimum implement `Note`.

Implement `NoteItem` and `Domain` only if the approved ERD says they should exist now.

### Ownership
Every Note must belong to a user.

Do not allow the client to choose arbitrary user IDs.

Explain `on_delete=models.CASCADE` before using it.

### Migrations
Run and explain:
- `makemigrations`
- `migrate`

### Model testing
Before API work, verify models through Django Admin or shell.

### Automated testing stack
Use Django `TestCase`/`APITestCase` with DRF API tests as the consistent backend test approach. Do not add a second backend test framework without a clear reason. Continue using the Part 1 Vitest/React Testing Library stack for frontend tests.

Required automated coverage:
- model constraints, relationships, and migrations
- registration, login, refresh, logout, and protected routes
- serializer validation and HTTP status codes
- Notes create, list, detail, update, and delete
- SQLite persistence after requests and browser refresh
- unauthenticated access rejection
- mandatory User A/User B ownership and authorization isolation
- React loading, success, and API error states using mocked responses

No test may depend on production data, real external services, or committed secrets.

---

# STEP D — AUTHENTICATION API

Use Django auth + DRF + SimpleJWT.

Suggested endpoints:
- `POST /api/v1/auth/register/`
- `POST /api/v1/auth/login/`
- `POST /api/v1/auth/refresh/`
- `POST /api/v1/auth/logout/`
- `GET /api/v1/auth/me/`

### Registration
Validate required fields, duplicate identities, and passwords. Never store plaintext passwords.

### Login
Explain:
- access token
- refresh token
- expiration
- authenticated requests

### Current user
Return limited profile information only.

### Logout
Use a sensible JWT strategy and explain any limitation.

### Security
Authentication = who the user is.
Authorization = what they may access.

Server-side ownership checks are mandatory.

---

# STEP E — NOTES REST API

Suggested endpoints:
- `GET /api/v1/notes/`
- `POST /api/v1/notes/`
- `GET /api/v1/notes/:id/`
- `PATCH /api/v1/notes/:id/`
- `DELETE /api/v1/notes/:id/`

Behavior:
- list only current user's notes
- create note for `request.user`
- retrieve/update/delete only if owned by current user
- newest notes first

### DRF concepts to explain
- Model
- Serializer
- View
- URL
- Request/Response
- HTTP methods/status codes

Flow:
```text
HTTP request
  ↓ URL
  ↓ View
  ↓ Serializer
  ↓ Model
  ↓ Database
```

### Status codes
Use appropriate 200/201/204/400/401/403/404 responses.

---

# STEP F — CONNECT REACT TO DJANGO

## Frontend env
Use:
`VITE_API_BASE_URL`

Do not scatter server URLs through components.

## API layer
Create approximately:
```text
src/api/http.js
src/api/authApi.js
src/api/notesApi.js
```

Use Browser Fetch API.

Shared HTTP behavior should handle:
- base URL
- JSON headers
- Authorization header
- basic errors
- token refresh strategy

Do not overbuild an Axios clone.

## AuthContext
Replace mock auth with real:
- `currentUser`
- `isAuthenticated`
- `loading`
- `login()`
- `register()`
- `logout()`

## Protected routes
Unauthenticated `/app/*` access should redirect to `/login`.

## Notes integration
Replace mock Notes with real API data:
- list
- create
- detail
- edit
- delete

Keep loading/error/empty states.

### Raw note create payload
Conceptually:
```json
{ "raw_text": "Buy eggs from Agora" }
```

Django sets user, timestamps, and `UNPROCESSED`.

### Mock-data transition
By end of Part 2:

REAL:
- Authentication
- Notes

STILL MOCKED:
- Tasks
- Events
- Shopping
- Expenses
- Places
- Search
- Daily Briefing
- What Matters Now

Do not fake AI results for newly persisted real notes.

---

# STEP G — MANUAL TESTING

## Registration/login
Create User A and User B.
Verify valid/invalid login and route protection.

## Create note
User A creates `Buy eggs.`
Confirm:
- React request succeeds
- Django creates Note
- SQLite stores it
- owner is User A
- React displays it

## Persistence
Refresh browser. Note must remain.

## Update
Change to `Buy eggs from Agora.` and confirm persistence.

## Delete
Delete and confirm removal from UI/API/database.

## Mandatory user-isolation test
User A creates note.
Login as User B.
Attempt to retrieve/update/delete User A's note by ID.
User B must never receive or modify it.

## Automated verification gate
Run backend unit/API tests, frontend tests, and the end-to-end authentication/Notes CRUD flow before accepting Part 2. A failure in authorization, persistence, migration, or user isolation blocks completion even if the manual happy path works.

---

## Concepts the developer must understand
### Django
- project vs app
- model
- migration
- ORM
- serializer
- view
- URL routing
- ForeignKey
- `request.user`
- authentication vs authorization
- JWT access/refresh
- CORS
- HTTP methods/status codes

### React
- `useState`
- `useEffect`
- Context
- Router
- forms
- `async/await`
- fetch
- loading/error states
- env variables

---

## Documentation
Update:
- `README.md`
- `docs/architecture.md`
- `docs/erd.md`
- `docs/api.md`

Document only implemented behavior as implemented.

---

## Acceptance criteria
Part 2 is complete only when:
1. Django runs.
2. SQLite works.
3. Admin works.
4. Register/login/logout work.
5. Protected routes work.
6. React knows the authenticated user.
7. Notes CRUD works and persists.
8. User ownership is enforced.
9. User A cannot access User B data.
10. React Notes no longer use mock data.
11. React auth no longer uses fake auth.
12. Later features remain mocked.
13. No Groq/vector/location code exists.
14. Backend model and API tests pass.
15. Frontend component and integration tests pass.
16. User-isolation tests pass for read, update, and delete operations.
17. The end-to-end registration/login/Notes CRUD flow passes.

---

## Deliverable before implementation
Before changing files, provide:
1. Part 1 architecture summary
2. ERD
3. which models to implement now vs later
4. Django app structure
5. package list
6. auth flow
7. endpoint table
8. React ↔ Django data flow
9. frontend files to change
10. backend files to create
11. exact step order
12. risks/decisions

Then wait for:

`IMPLEMENT PART 2 — STEP A`
