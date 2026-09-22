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

# STEP 15 — PART 3.5 FINAL QUALITY GATE

## Goal

Prove the categorization/finance foundation is ready before frontend framework migration.

No new feature development.

---

# Categorization gate

Must verify:

```text
raw Note preserved
revision concurrency works
pre-parser deterministic
Groq schema strict
explicit facts win
conflicts visible
multi-intent split stable
user correction authoritative
income != expense
Shopping = TASK + Shopping Domain
Study = Education Domain
```

Run the labelled dataset evaluation.

Record results.

---

# Finance gate

Verify:

- CREDIT/DEBIT;
- positive Decimal amounts;
- separate currencies;
- opening balance;
- timezone period summaries;
- no duplicate source transaction;
- re-analysis cannot overwrite;
- manual transaction works;
- finance aggregates use ledger only.

---

# AI access gate

Verify:
- BYOK;
- trial;
- exhausted trial;
- no-key manual path;
- atomic quota;
- no secrets.

---

# Product gate

Verify:
- Dashboard categories;
- manual add;
- preferences;
- onboarding;
- replay tour;
- current React/Vite production build.

---

# E2E flow

At least:

1. login;
2. onboarding;
3. quiz Note;
4. Shopping Note;
5. debit Note;
6. salary Note;
7. confirm all;
8. verify categorized summary;
9. verify balance;
10. manual transaction;
11. change priority profile;
12. logout.

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

E2E:
- run current Playwright suite plus Part-3.5 flow.

---

# Docs

Update:

```text
README
architecture.md
erd.md
api.md
ai-design.md
finance design doc
current status snapshot
```

---

## Acceptance criteria

- [ ] categorization metrics recorded.
- [ ] explicit-fact contradiction tests all pass.
- [ ] all finance tests pass.
- [ ] all user-isolation tests pass.
- [ ] all existing Parts 1–3.4 regressions pass.
- [ ] React/Vite build is green.
- [ ] docs match reality.
- [ ] clean Git checkpoint exists.

Wait for:

`IMPLEMENT STEP 16 — NEXT.JS MIGRATION`
