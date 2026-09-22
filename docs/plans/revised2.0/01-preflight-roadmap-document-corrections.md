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

# STEP 01 — PRE-FLIGHT ROADMAP & DOCUMENT CORRECTIONS

## Goal

Remove remaining roadmap ambiguity before any schema migration.

No product feature is implemented in this step.

---

## Required corrections

### 1. Reframe Part 3.4

Part 3.4 is now:

```text
POST-CUTOVER SCHEMA HARDENING
```

It is **not** a fresh PostgreSQL/Supabase/Auth migration.

Remove or clearly supersede instructions that would:

- recreate `AppUser`;
- reset Supabase PostgreSQL;
- restore `SUPABASE_AUTH_ENABLED`;
- restore `VITE_SUPABASE_ENABLED`;
- reintroduce SimpleJWT;
- re-run legacy auth retirement;
- treat Google login as not yet integrated if the current repo proves it is active.

### 2. Fix forward roadmap in current-state docs

The sequence after current Part 3 becomes:

```text
Part 3.4
Part 3.5
Part 4
Part 5
Part 6
```

The old Part 4.5 numbering is retired.

### 3. Fix source-of-truth precedence

Ensure active Part 3.4 appears in the precedence list.

Recommended interpretation:

```text
architecture-consistency-roadmap.md
    = conflict-resolution authority

after_part_3_plan.md
    = implemented-current-state evidence

future-proof-database-plan.md
    = target DB architecture

part-03-4...
part-03-5...
part-04...
part-05...
part-06...
```

### 4. Resolve Domain PK policy

Inspect the actual Domain model.

Recommended:

```text
Domain keeps current PK type
```

unless a concrete requirement forces conversion.

Update all target docs so `FinanceTransaction.primary_domain_id` and `NoteItemDomain.domain_id` match the real Domain PK type.

### 5. Rename transaction source kind

Preferred:

```text
NOTE_DERIVED
MANUAL
OPENING_BALANCE
```

Replace `AI_NOTE` in active future plans.

### 6. Clarify server Groq key

Public execution policy:

```text
session BYOK
→ else trial using backend server key
→ else no AI
```

Do not allow an unlimited automatic `SERVER` fallback after trial exhaustion.

---

## Files to inspect/update

At minimum:

```text
after_part_3_plan.md
architecture-consistency-roadmap.md
future-proof-database-plan.md
part-03-4-postgresql-supabase-auth-foundation.md
part-03-5-transactions-personalization-onboarding.md
documentation-consistency-audit.md
```

---

## Tests

No migrations.

Run:

```bash
git diff --check
```

Manually verify:

- no active plan says Part 4.5 is still next;
- no active Part 3.4 says to reset the already-active Supabase DB;
- Domain PK type is consistent in active docs;
- transaction source-kind terminology is consistent;
- trial/server-key precedence is unambiguous.

---

## Acceptance criteria

- [ ] Part 3.4 is explicitly post-cutover hardening.
- [ ] current roadmap is 3.4 → 3.5 → 4 → 5 → 6.
- [ ] Part 3.4 appears in source precedence.
- [ ] Domain PK policy is explicit.
- [ ] `NOTE_DERIVED` is the active source-kind name if accepted.
- [ ] server-key/trial policy is explicit.
- [ ] old conflicting plans are archived or marked superseded.

---

## Stop condition

Do not create migrations in this step.

Stop after documentation is internally consistent.

Wait for:

`IMPLEMENT STEP 02 — ACTUAL SCHEMA AUDIT`
