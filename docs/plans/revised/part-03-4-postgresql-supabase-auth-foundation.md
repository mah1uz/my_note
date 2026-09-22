# PART 3.4 — POSTGRESQL, UUID OWNERSHIP & SUPABASE AUTH FOUNDATION

## Project
AI Context-Aware Note-Taking Web Application — My Notes

## Position

This is the bridge between completed Part 3 and Part 3.5.

Part 3.4 finishes the infrastructure/identity migration so later product work does
not depend on Django's legacy end-user identity or SQLite.

---

# 1. Goals

Complete:
- Supabase PostgreSQL cutover
- stable UUID AppUser ownership
- `UserAuthIdentity(issuer, subject)`
- AppUser-only Note ownership
- final UUID content migration needed by the approved DB plan
- AI run/artifact split
- explicit NoteItemDomain if not already complete
- privacy-safe admin boundary
- Supabase JWT authentication
- frontend Supabase session integration
- legacy public auth removal after verification
- full regression/user-isolation tests

Do not implement Part 3.5 Transactions yet.

Do not implement Part 4 vectors/search.

---

# 2. Target architecture

```text
React/Vite
  ↓ Supabase browser session
  ↓ Authorization: Bearer <access JWT>
Django REST
  ↓ verify JWKS + issuer + audience + expiry
  ↓ UserAuthIdentity(iss, sub)
  ↓ AppUser UUID
Supabase PostgreSQL
```

Django remains the authorization boundary.

---

# 3. Database migration rule

The current SQLite database is disposable development/reference data.

Do not copy demo data into Supabase PostgreSQL.

Do not delete the SQLite file merely to prove migration success.

Apply Django migrations to a clean Supabase PostgreSQL target.

Require SSL.

Use the connection mode appropriate for the environment:
- direct connection for migrations where network support allows;
- session pooler for persistent IPv4-only runtime where needed.

Do not use transaction-pooler assumptions for migrations without explicit validation.

---

# 4. Stable application identity

Canonical owner:

```text
app_users.id UUID
```

Supabase subject is external identity only.

```text
Supabase JWT iss + sub
      ↓
UserAuthIdentity
      ↓
AppUser UUID
```

Do not rewrite every user-owned FK to `auth.users`.

---

# 5. AppUser provisioning

First valid authenticated request:

```text
verify token
  ↓
lookup (issuer, subject)
  ↓
missing?
  -> create AppUser
  -> create UserAuthIdentity
  -> create UserPreference
  atomically
```

Rules:
- no arbitrary client AppUser UUID
- no silent merge by email
- non-ACTIVE AppUser rejected
- repeat login updates safe activity metadata

---

# 6. Supabase JWT verification

Django validates:
- signature using JWKS
- accepted asymmetric algorithm(s)
- issuer
- audience
- expiry
- required claims
- subject

Invalid/missing bearer authentication returns 401 for auth failure.

Do not trust decoded claims before signature/claim validation.

Cache JWKS reasonably.

---

# 7. Frontend session

React/Vite uses:
- Supabase project URL
- publishable key only

Environment:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_ENABLED
VITE_API_BASE_URL
```

Never put:
- database password
- service-role/secret key
- Django secret
- Groq server key

into Vite variables.

Supabase manages:
- access token
- refresh token/session refresh

Django API calls send current access token only.

---

# 8. Feature gating during migration

It is valid to keep:

```text
SUPABASE_AUTH_ENABLED=false
VITE_SUPABASE_ENABLED=false
```

while migration work is being verified.

Enable only after:
- PostgreSQL migrations pass
- AppUser ownership is complete
- auth tests pass
- frontend session integration is ready

Do not keep two public auth systems active permanently.

---

# 9. Legacy auth retirement

After Supabase path is verified:
- remove/disable public legacy Django/SimpleJWT register/login/refresh/logout
- remove stale frontend refresh-cookie assumptions
- keep Django session/staff auth for `/admin/`
- keep admin population separate from end users

Regression tests must prove old public endpoints are unavailable if retirement is complete.

---

# 10. Google OAuth

Google OAuth is mediated by Supabase.

Local development flow:

```text
React localhost
  ↓
Supabase Auth
  ↓
Google
  ↓
Supabase callback
  ↓
React callback
```

Google's authorized redirect URI uses the Supabase provider callback, not Django.

Production origins/redirect allow-list are finalized in Part 6 deployment.

If external Google Cloud verification/payment setup blocks local progress:
- email/password Supabase Auth + JWT cutover may proceed;
- Google OAuth remains an explicit external-completion item;
- it must be tested before final production acceptance.

Do not redesign Django auth around this external blocker.

---

# 11. Ownership migration

Before Part 3.5:
- Notes require `app_user`
- runtime querysets use AppUser only
- old end-user Django User FK removed only after verified migration
- child ownership resolves through Note/AppUser
- foreign UUID access returns safe 404 where appropriate

---

# 12. UUID/content cleanup

Complete the approved database plan:
- UUID Note/NoteItem where required
- explicit NoteItemDomain
- AIProcessingRun
- AIProcessingArtifact
- constraints/indexes
- safe cascades

Do not add NoteEmbedding yet.

---

# 13. Admin privacy

Django Admin remains staff-only.

Do not directly register:
- Notes
- NoteItems
- AI artifacts
- future Transactions
- embeddings
- precise Places

Admin may receive safe user/account metadata and counts through dedicated views later.

Audit privilege/account actions.

---

# 14. Environment verification

Verify without printing secrets:
- `DATABASE_URL` present
- SSL requirement
- Supabase URL
- JWKS URL
- audience
- frontend publishable key presence
- `.env` ignored by git
- no secret committed

Never echo full connection strings/tokens into logs or reports.

---

# 15. Regression tests

Backend:
- PostgreSQL migrations
- Notes CRUD
- AI analyze/review
- ownership
- AppUser provisioning
- repeated login
- suspended user
- invalid issuer
- invalid audience
- expired token
- invalid signature
- foreign Note access
- admin separation

Frontend:
- session restore
- login
- register
- callback
- logout
- protected route
- API bearer attachment
- auth error handling

No live provider secrets required in routine tests.

---

# 16. Acceptance criteria

Part 3.4 is complete when:

1. Supabase PostgreSQL is active.
2. SQLite demo data was not copied.
3. AppUser UUID is owner root.
4. UserAuthIdentity mapping works.
5. Notes use AppUser ownership only.
6. Supabase JWT verification works.
7. non-active users are rejected.
8. frontend Supabase session works.
9. no server secret exists in frontend.
10. Supabase email/password auth is the active public auth path and legacy public auth endpoints are disabled/retired.
11. Django admin remains staff-only.
12. private content is not exposed in admin.
13. all Parts 1–3 regressions pass on PostgreSQL.
14. user-isolation tests pass.
15. no pgvector/search/RAG exists yet.
16. Part 3.5 can add product-domain models without another identity migration.

Then proceed to:

`PART 3.5 — TRANSACTIONS, PERSONALIZATION, AI ENTITLEMENT & ONBOARDING`
