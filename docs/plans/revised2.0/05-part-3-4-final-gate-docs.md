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

# STEP 05 — PART 3.4 FINAL REGRESSION GATE + DOCUMENTATION

## Goal

Freeze a clean schema/auth baseline before categorization/finance expansion.

No new feature development.

---

# Automated gate

Backend:

```bash
cd /mnt/d/A1/my_note/backend
source .venv/bin/activate

python manage.py check
python manage.py makemigrations --check
python manage.py showmigrations
python manage.py test --keepdb -v 1
```

Frontend:

```bash
cd /mnt/d/A1/my_note/frontend
npm test
npm run build
```

Repository:

```bash
git diff --check
```

---

# Manual smoke

Verify:

1. email/password Supabase login;
2. Google login;
3. auth session restore;
4. `/auth/me/`;
5. create Note;
6. edit Note;
7. delete Note;
8. analyze Note;
9. retry analysis;
10. review drafts;
11. edit draft;
12. confirm;
13. Tasks page;
14. Events page;
15. Shopping page;
16. BYOK key clears on logout;
17. cross-user Note access => 404;
18. Django admin remains staff-only;
19. no private AI artifacts in admin.

---

# Documentation updates

Update current docs to actual Part-3.4 state:

```text
architecture.md
erd.md
api.md
database-migration.md
authentication.md if required
after_part_3_plan.md/current status snapshot
```

Label obsolete schema/auth plans historical.

---

# Git checkpoint

Create a clean checkpoint after all tests pass.

Suggested message:

```text
Harden post-Part-3 schema and AI audit models
```

---

## Acceptance criteria

- [ ] all automated tests green.
- [ ] production build green.
- [ ] no pending migrations.
- [ ] manual auth/Note/AI smoke passes.
- [ ] docs match implementation.
- [ ] clean checkpoint exists.

Wait for:

`IMPLEMENT STEP 06 — SHARED PARSING PRIMITIVES`
