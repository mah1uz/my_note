# DOCUMENTATION CONSISTENCY AUDIT

## Purpose

This audit records mismatches found between the current implementation-era docs
and the reconciled roadmap.

Do not "fix" historical implementation records merely to make them look modern.
Instead:
- keep historical Part 1–3 records as evidence of what was implemented then;
- update current architecture/API/ERD docs when the corresponding migration is completed;
- use the reconciled roadmap files for future work.

---

# 1. `architecture.md`

## Current mismatch

The file correctly shows the intended Supabase/Auth/AppUser/PostgreSQL direction,
but later paragraphs still describe the older SimpleJWT architecture:

```text
access token in React memory
refresh token in HttpOnly cookie
refresh endpoint
rotating tokens / blacklist
```

That conflicts with the target Supabase-managed browser session.

## Required update after Part 3.4

Replace the old refresh-cookie description with:

```text
Supabase JS manages the browser session and refresh token.
Django receives the current Supabase access JWT as Bearer authentication.
Django verifies JWKS/iss/aud/exp and maps iss+sub to AppUser.
```

Also replace:
- `Expenses` as finance authority
with:
- `Transactions` after Part 3.5.

The current architecture text also says AI logs are visible as read-only Django Admin records.
That must be narrowed after the AI run/artifact split: only privacy-safe operational metadata
may be exposed through a dedicated admin projection; sensitive AI artifacts must not be
directly registered or readable in normal admin UI.

---

# 2. `api.md`

## Current mismatch

The current API doc still lists legacy Django public auth endpoints:

```text
/auth/register/
/auth/login/
/auth/refresh/
/auth/logout/
/auth/password-reset/
```

This is a valid historical Part 3 record but becomes stale after Supabase cutover.

## Required update after Part 3.4

Document:
- Supabase owns signup/login/password recovery
- Django verifies Bearer JWT
- keep `/api/v1/auth/me/` if the application exposes it
- remove/mark legacy public auth endpoints retired

## Required update after Part 3.5

Add:
- `/transactions/`
- `/finance/summary/`
- `/preferences/`
- `/ai/entitlement/`

## Required update after Part 4

Add split search API:
- `POST /search/`
- `POST /search/answer/`

## Required update after Part 5

Add:
- `/places/`
- `/reminders/`

---

# 3. `erd.md`

## Current mismatch

The current ERD still has:

```text
Django User -> Note
integer IDs
AIProcessingLog
```

It does not represent:
- AppUser
- UserAuthIdentity
- UserPreferences
- AI run/artifact split
- explicit NoteItemDomain
- Transactions
- AI entitlement

## Required update

After Part 3.5, regenerate ERD from the reconciled database plan.

Do not leave the old ERD labelled as the current target.

It may be retained as:

```text
Historical ERD through original Part 3
```

if useful for capstone migration documentation.

---

# 4. `ai-design.md`

## Current mismatch

The file says:
- Part 2 authentication/SQLite architecture is unchanged
- server fallback key behavior from the old stage
- no deterministic pre-parser/trial entitlement

That is historically correct for Part 3 but not future-current after Part 3.5.

## Required update after Part 3.5

Add:
- deterministic Note pre-parser
- explicit-facts-win merge rules
- Transaction suggestion state machine
- trial entitlement
- `credential_source`
- confirmed Transaction cannot be silently overwritten by re-analysis

Keep:
- raw Note source of truth
- schema validation
- BYOK memory-only
- provider output untrusted
- graceful failure

Also remove the older assumption that full AI processing logs can be browsed in Django Admin.
The reconciled privacy model permits only sanitized operational run metadata; raw/parsed/confirmed
AI artifacts remain private.

---

# 5. `authentication.md`

## Status

Mostly aligned with the target Part 3.4 architecture.

Current environment names are Vite-specific, which is correct before Part 4.

## Required update in Part 4

Document Next.js equivalents:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_API_BASE_URL
```

Also document the chosen boundary:

```text
Supabase browser session
-> Client Components/TanStack Query
-> Django Bearer JWT API
```

Do not imply every authenticated data request must be a Server Component.

---

# 6. `database-migration.md`

## Status

Largely aligned with Part 3.4.

## Required wording change

The old phrase:

```text
moving to PostgreSQL before Part 4
```

should be interpreted as:

```text
Part 3.4 performs the PostgreSQL/Auth foundation before Part 3.5/Part 4.
```

The vector extension still belongs to Part 4.

---

# 7. Original `future-proof-database-plan.md`

## Mismatch

The original plan:
- treats confirmed EXPENSE NoteItems as finance aggregation source;
- does not contain the authoritative Transaction ledger;
- does not include AI trial entitlement;
- uses the old Part 3.4/3.5 numbering;
- contains older provider/deployment assumptions.

## Resolution

Use the reconciled edition in this plan pack as the new database source of truth.

Important preserved ideas:
- AppUser root
- Supabase identity mapping
- raw Note source
- UUID entities
- admin privacy
- BYOK non-persistence
- pgvector lifecycle
- Places/reminder privacy

---

# 8. Old Part 4 plan

`part-04-semantic-search-rag.md` is historical.

Problems relative to the new roadmap:
- still includes SQLite -> PostgreSQL migration in Part 4;
- assumes old frontend;
- uses Expenses/NoteItems as finance source;
- lacks Next.js migration and the final navigation;
- does not include split search/retrieval vs RAG endpoints.

Do not use it for implementation after the reconciled Part 4 exists.

---

# 9. Old Part 5 plan

`part-05-reminders-location.md` is historical.

Useful technical ideas may remain:
- Place CRUD
- Leaflet
- notification permission
- centralized reminder runtime
- active geolocation
- Haversine
- no movement history

But implementation should follow the reconciled Next.js Part 5.

---

# 10. Old Part 6 plan

The older React/Vite `part-06-final-production.md` is historical.

Conflicts:
- React deployment language
- Vite env variables
- Neon assumption
- Expenses/Expense Dashboard
- old navigation

Use the reconciled Next.js Part 6.

---

# 11. Old `part-04-5-transactions-personalization-onboarding.md`

This is the conceptual source for the new Part 3.5, but its old placement created
several dependency errors:
- assumed Next.js already existed;
- assumed Universal Search already existed;
- depended on Part 4 motion/components;
- was placed after the feature that should consume its finance model.

The reconciled Part 3.5 fixes this by:
- running on React/Vite;
- creating Transactions before search;
- defining search contracts only;
- moving Next.js work back to Part 4.

---

# 12. Motion guide

Old motion guide referred to:
- `Your Space`
- Expenses cards

The reconciled guide uses:
- Dashboard Categorized Summary
- Transactions
- calm backgrounds / dynamic elements

No architecture change should be driven purely by animation.

---

# 13. Search architecture issue fixed

The old Part 4 concept could return retrieval and Groq answer in one response.

This makes provider latency/failure capable of delaying Search Notes.

Reconciled design:

```text
POST /search/
POST /search/answer/
```

Retrieval remains independently useful.

---

# 14. Finance authority issue fixed

Old plans had two possible financial truths:

```text
NoteItem.amount/currency
finance_transactions
```

Reconciled rule:

```text
NoteItem = source/context
Transaction = financial truth
```

This applies to:
- Dashboard
- Search
- Daily Briefing
- aggregates
- balance

---

# 15. Transaction Domain issue fixed

The original Transaction proposal mentioned category/domain in UI but omitted an
authoritative reporting field in the schema.

Reconciled schema adds:

```text
primary_domain_id
```

This provides stable category reporting, especially for manual Transactions.

---

# 16. Suggestion-vs-ledger ambiguity fixed

Original wording said "only confirmed Transactions affect totals", which could
imply unconfirmed Transactions live in the same table.

Reconciled rule:

> Every `finance_transactions` row is confirmed. Suggestions live outside the ledger.

This simplifies constraints, totals and user expectations.

---

# 17. Opening-balance ambiguity fixed

Reconciled V1 rule:
- one opening-balance row per user/currency
- direction represents positive/negative starting position
- no mutable balance column

---

# 18. Timezone finance ambiguity fixed

All period queries use `AppUser.timezone`.

This affects:
- today
- this week
- this month
- last month
- transaction search
- dashboard finance totals

---

# 19. Query-parser maintainability issue fixed

Do not create one giant regex file.

Use modular parsers for:
- money
- dates
- type
- status
- domain
- aggregation
- phrases

The same modularity applies to the Note pre-parser.

---

# 20. Next.js auth boundary fixed

Reconciled rule:

```text
Server Components where useful for shell/static structure
Client Components + TanStack Query for authenticated Django data
```

This avoids inventing a second auth/proxy architecture simply to use Server Components.

---

# 21. Location/priority mismatch fixed

Old Part 6 could imply the backend What Matters engine receives current location.

Reconciled design:
- backend returns base priority;
- browser computes nearby saved Place;
- frontend applies small local Shopping boost;
- no live coordinates sent to priority API.

---

# 22. Deployment mismatch fixed

Canonical target:

```text
Frontend  Next.js / Vercel or comparable
Backend   Django / Render/Fly or comparable
Database  Supabase PostgreSQL
Auth      Supabase Auth
```

Do not keep Neon as an assumed database while the project is actively using Supabase PostgreSQL.

---

# 23. Google OAuth timing clarified

Architecture can be implemented/tested locally before deployment.

Production deployment must update:
- Google authorized frontend origin where applicable
- Supabase redirect allow-list
- Supabase Site URL

Google callback remains Supabase-mediated.

External Google setup should not cause a Django auth redesign.

---

# 24. Reminder limitation clarified

V1 is active-session/browser reminders.

Do not claim background notification while browser is closed.

This limitation belongs in:
- UI
- README
- demo explanation
- Part 6 known limitations

---

# 25. Files to update as implementation progresses

## At Part 3.4 completion
Update:
- `architecture.md`
- `authentication.md`
- `api.md`
- `erd.md`
- `database-migration.md`

## At Part 3.5 completion
Update:
- `architecture.md`
- `api.md`
- `erd.md`
- `ai-design.md`
- add finance design doc if desired

## At Part 4 completion
Update:
- frontend architecture
- auth env names
- API search docs
- search/RAG doc
- architecture diagram

## At Part 5 completion
Update:
- ERD
- API
- location/reminder doc
- privacy docs

## At Part 6 completion
Perform a complete documentation consistency pass and remove/label stale active docs.

---

# Final rule

Historical plans may remain in the repository for capstone traceability, but they
must be clearly labelled `historical/superseded` or placed under an archive
directory so implementation agents do not treat them as active instructions.
