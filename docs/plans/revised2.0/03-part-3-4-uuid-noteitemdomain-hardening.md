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

# STEP 03 — PART 3.4 UUID + NOTEITEMDOMAIN HARDENING

## Goal

Safely complete remaining identifier migration and explicit Domain-through model.

Only implement what Step 02 proved is still missing.

---

# A. Identifier hardening

If Note and/or NoteItem are still integer PKs and the canonical plan requires UUIDs:

Use a **data-preserving migration strategy**.

Do not casually replace `id = ...` in-place without accounting for FKs.

Possible safe strategy:

```text
add UUID column
backfill UUIDs
create replacement FK columns
backfill child relationships
verify
switch application references
promote UUID
remove old columns only after validation
```

Exact migration depends on actual schema.

If current development DB is intentionally disposable, destructive rebuild still requires explicit owner approval.

---

# B. Domain policy

Use the final Step-01/02 decision.

Recommended:

```text
Domain keeps current PK
```

Do not convert it merely for cosmetic consistency.

---

# C. Explicit NoteItemDomain

Target fields:

```text
id
note_item FK
domain FK
is_primary
source
created_at
```

`source`:

```text
AI
USER
```

Constraints:

```text
UNIQUE(note_item, domain)
at most one is_primary=true per NoteItem
```

Migration:

```text
existing implicit M2M
→ explicit through table
→ copy every existing relationship
→ verify counts
→ switch ManyToMany through=
→ remove old implicit table only via migration
```

Do not lose existing categorizations.

---

# D. Primary Domain migration

Do not invent a primary Domain arbitrarily for every old row.

Policy options:

1. if current Part-3 extraction already had a clear primary domain, preserve it;
2. otherwise allow `is_primary=false` for legacy relationships and require future confirmed edits to choose when reporting needs it;
3. if deterministic legacy rule is chosen, document it and test it.

Finance reporting later gets its own transaction-owned primary Domain.

---

# E. API/frontend ID updates

If UUIDs change routes:

Update:
- serializers;
- router/path converters;
- frontend links;
- tests;
- fixture IDs.

Never use UUID obscurity as authorization.

---

# Required tests

## Identifier tests

- create Note;
- retrieve Note by UUID;
- PATCH Note by UUID;
- delete Note by UUID;
- create/retrieve/update NoteItem by UUID;
- foreign-user UUID returns safe `404`;
- invalid UUID returns safe client error/404, not 500.

## Domain-through tests

- old relations copied;
- multi-domain preserved;
- duplicate pair rejected;
- only one primary allowed;
- delete NoteItem cascades join rows;
- Domain remains protected/restricted while referenced;
- `source=AI|USER` validated.

## Regression

Existing:
- analyze;
- review;
- confirm;
- Tasks;
- Events;
- Shopping;
- Expenses context.

---

# Commands

```bash
python manage.py check
python manage.py makemigrations --check
python manage.py test --keepdb -v 1
```

Frontend:

```bash
npm test
npm run build
```

---

## Acceptance criteria

- [ ] required UUID migrations are complete.
- [ ] no live FK is broken.
- [ ] NoteItemDomain is explicit.
- [ ] all old Domain relations survive.
- [ ] primary-domain uniqueness is enforced.
- [ ] no user-isolation regression.
- [ ] frontend no longer assumes integer IDs where converted.

Wait for:

`IMPLEMENT STEP 04 — AI LOG SPLIT AND ADMIN HARDENING`
