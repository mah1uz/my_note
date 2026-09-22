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

# STEP 21 — PART 6 FINAL INTELLIGENCE, EVALUATION, HARDENING & DEPLOYMENT

## Goal

Finish the product without adding unrelated scope.

---

# Sequence

```text
A. full audit
B. What Matters Now
C. Daily Briefing
D. finance dashboard
E. categorization evaluation rerun
F. query-parser evaluation
G. retrieval evaluation
H. RAG evaluation
I. frontend accessibility/motion hardening
J. complete automated release tests
K. security/privacy review
L. performance review
M. deployment
N. final docs/demo
```

---

# What Matters Now

Deterministic scoring.

Inputs:
- overdue;
- due soon;
- upcoming Event;
- explicit importance;
- priority profile;
- optional client-side nearby Shopping boost.

Profession never recategorizes Notes.

Expose reasons.

---

# Daily Briefing

Django selects structured facts first.

Groq only summarizes those facts.

Do not send all raw Notes.

If Groq fails:
- deterministic dashboard remains useful.

---

# Finance dashboard

Reuse the same FinanceService as Part 3.5/Part 4.

Show:
- current balance by currency;
- monthly income;
- monthly spending;
- largest expenses;
- category totals;
- recent transactions.

Search and dashboard values must agree.

---

# Evaluation

## Categorization
Rerun full labelled set and record final metrics.

## Query parser
Measure exact field/operator/date parsing.

## Retrieval
Compare vector/lexical/hybrid.

## RAG
Measure:
- source validity;
- unsupported claim rate;
- abstention;
- injection resistance;
- cross-user leakage.

Release blockers:

```text
cross-user source leakage = 0
invalid source IDs shown = 0
known unsupported factual claims in labelled set = 0
```

---

# Frontend hardening

Follow fluid-interactive prompt.

Verify:
- sidebar;
- dashboard group;
- categorized summary;
- Search;
- modal focus;
- reduced motion;
- mobile;
- no hydration errors;
- no animation blocking interaction.

---

# Security

Review:
- secrets;
- Supabase keys;
- BYOK;
- admin privacy;
- RAG;
- search;
- location;
- deletion cascades;
- CORS;
- production env.

---

# Performance

Review:
- Django query counts;
- vector latency;
- FTS latency;
- bounded top-K;
- embedding-model caching;
- Next.js bundle size;
- map lazy load;
- client boundaries;
- unnecessary rerenders.

Do not add Redis/Celery without evidence.

---

# Deployment

Target:

```text
Next.js -> Vercel/comparable
Django -> Render/Fly/comparable
PostgreSQL -> Supabase PostgreSQL
Auth -> Supabase Auth
```

Run production smoke:
- auth;
- Note;
- analyze;
- categorize;
- transaction;
- Search;
- grounded answer;
- Place/reminder;
- mobile;
- logout.

---

# Final docs

Update:
- README;
- architecture;
- ERD;
- API;
- AI design;
- finance;
- search/RAG;
- location;
- testing/evaluation;
- deployment;
- known limitations.

Archive stale plans.

---

# Final acceptance criteria

- [ ] core categorization metrics reported.
- [ ] deterministic finance correct.
- [ ] search evaluated.
- [ ] RAG validated/abstaining safely.
- [ ] reminders/location privacy correct.
- [ ] all backend/frontend/E2E tests green.
- [ ] accessibility/reduced motion works.
- [ ] security/privacy review passes.
- [ ] deployment smoke passes.
- [ ] README reflects implemented reality.
- [ ] demo is repeatable.
