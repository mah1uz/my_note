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

# STEP 02 — PART 3.4 ACTUAL-SCHEMA AUDIT

## Goal

Produce a repository-grounded **actual → target schema gap analysis** before changing any model.

This step is analysis only.

---

## Inspect

### Accounts

- `AppUser`
- `UserAuthIdentity`
- `UserPreference`
- admin models
- PK types
- indexes/constraints

### Notes

- `Note`
- `NoteItem`
- `Domain`
- current M2M implementation
- `AIProcessingLog`
- ownership path
- revision fields
- PK/FK types

### APIs

- serializers
- URL converters
- views
- tests
- fixtures

### Frontend assumptions

Search for code assuming numeric IDs:

```text
parseInt(id)
Number(id)
:id routes
test fixtures with fixed numeric PKs
```

---

## Required output

Create a gap table:

| Area | Actual | Target | Migration needed? | Risk |
|---|---|---|---|---|

Specifically answer:

1. Are Note PKs UUID already?
2. Are NoteItem PKs UUID already?
3. What is Domain PK type?
4. What implicit M2M table exists?
5. Which fields exist in `AIProcessingLog`?
6. Does NoteItem point to AI log?
7. Which admin registrations expose data?
8. Which API/frontend tests assume integers?
9. Which migrations currently exist?
10. Is any current data non-disposable?

---

## Do not

- create migrations;
- edit models;
- reset the DB;
- delete migrations;
- touch Part 3.5 finance;
- touch Next.js;
- add pgvector.

---

## Verification commands

```bash
cd /mnt/d/A1/my_note/backend
source .venv/bin/activate

python manage.py check
python manage.py showmigrations accounts notes
python manage.py makemigrations --check
```

If useful:

```bash
python manage.py shell
```

for safe model metadata inspection only.

---

## Acceptance criteria

- [ ] every target model difference is identified.
- [ ] PK conversion scope is known.
- [ ] Domain PK decision matches actual repo.
- [ ] implicit M2M conversion plan is known.
- [ ] AI log split plan is known.
- [ ] frontend/API numeric-ID assumptions are listed.
- [ ] no files were destructively changed.

Wait for:

`IMPLEMENT STEP 03 — UUID AND NOTEITEMDOMAIN HARDENING`
