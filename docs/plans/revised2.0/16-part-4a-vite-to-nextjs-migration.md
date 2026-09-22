# My Notes — Sequential Execution Step

> Execute this file **only after all previous numbered step files have passed their acceptance gates**.
>
> Before changing code, read:
> 1. `architecture-consistency-roadmap.md`
> 2. `after_part_3_plan.md`
> 3. `future-proof-database-plan.md`
> 4. the relevant reconciled part plan
> 5. this step file
>
> Inspect the actual repository before assuming a planned model/file already exists.

# STEP 16 — PART 4A VITE → NEXT.JS MIGRATION ONLY

## Goal

Move the working product to Next.js App Router + TypeScript **without changing domain behavior**.

No pgvector/Search/RAG yet.

---

# Strategy

Keep Vite runnable during migration.

Sequence:

```text
1. create Next.js shell
2. configure TypeScript
3. configure Supabase browser auth
4. configure Django API client
5. migrate public auth
6. migrate protected shell
7. migrate Notes
8. migrate AI review
9. migrate Tasks/Events/Shopping
10. migrate Transactions
11. migrate preferences/onboarding
12. E2E parity
13. switch active frontend
14. archive Vite only after parity
```

---

# Stack

Use:
- Next.js App Router;
- TypeScript;
- TanStack Query;
- Motion/Framer Motion;
- accessible UI primitives;
- local/Zustand UI state only where useful.

Do not add Redux without a demonstrated need.

---

# Auth boundary

```text
Supabase JS browser session
↓
access JWT
↓
TanStack Query / client-side API client
↓
Django
```

Server Components for static shell where useful.

Do not duplicate Django authorization in Next.js route handlers.

---

# Temporary dev origins

During migration allow both:

```text
localhost:5173
localhost:3000
```

Update:
- Supabase redirect allow-list;
- OAuth redirect settings;
- Django CORS.

After cutover remove Vite origin/config.

---

# API type contracts

Strongly recommended:

```text
DRF OpenAPI
→ generated TypeScript types
```

Possible:
- `drf-spectacular`;
- `openapi-typescript`.

If not adopted, maintain explicit `api.ts` types and contract tests.

---

# Regression test matrix

Must preserve:
- login/register/Google;
- callback;
- password reset;
- protected routes;
- Notes CRUD;
- AI analyze/review/confirm;
- BYOK;
- trial;
- Transactions;
- finance summary;
- preferences;
- onboarding;
- Tasks;
- Events;
- Shopping;
- logout;
- user isolation.

No search work until parity is green.

---

# Acceptance criteria

- [ ] Next.js app reproduces all Part-3.5 behavior.
- [ ] TypeScript build passes.
- [ ] no auth/business logic duplicated incorrectly.
- [ ] no hydration errors.
- [ ] Supabase redirect/CORS works.
- [ ] old Vite frontend archived only after parity.
- [ ] no pgvector/Search/RAG introduced.

Wait for:

`IMPLEMENT STEP 17 — SEARCH FOUNDATION`
