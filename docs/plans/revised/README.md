# Reconciled Project Plan Pack

This folder contains the revised source-of-truth roadmap after moving the former
Part 4.5 Transactions/Personalization/Onboarding work to **Part 3.5**.

## Recommended reading order

1. `architecture-consistency-roadmap.md`
2. `future-proof-database-plan.md`
3. `part-03-4-postgresql-supabase-auth-foundation.md`
4. `part-03-5-transactions-personalization-onboarding.md`
5. `part-04-nextjs-hybrid-search-strict-rag.md`
6. `part-05-nextjs-reminders-location.md`
7. `part-06-nextjs-final-production.md`
8. `fluid-interactive-website-prompt.md`
9. `documentation-consistency-audit.md`

## Replacement map

| Old / conflicting plan | Reconciled replacement |
|---|---|
| old Part 3.4/3.5 split across DB/Auth docs | `part-03-4-postgresql-supabase-auth-foundation.md` |
| `part-04-5-transactions-personalization-onboarding.md` | `part-03-5-transactions-personalization-onboarding.md` |
| `part-04-nextjs-hybrid-search-strict-rag.md` | revised file with same name |
| `part-05-nextjs-reminders-location.md` | revised file with same name |
| `part-06-nextjs-final-production.md` | revised file with same name |
| old future-proof DB plan | reconciled `future-proof-database-plan.md` |
| old motion prompt | reconciled `fluid-interactive-website-prompt.md` |

## Historical files

Keep old Part 1–3 plans as implementation history.

Older Part 4/5/6 variants should be moved to something like:

```text
docs/archive/
```

or clearly marked:

```text
SUPERSEDED — DO NOT USE FOR FUTURE IMPLEMENTATION
```

so OpenCode or another implementation agent does not combine stale requirements
with the active roadmap.

## Key locked decisions

- Part 3.4 = PostgreSQL + UUID ownership + Supabase Auth foundation
- Part 3.5 = Transactions + Personalization + AI entitlement + Onboarding
- Part 4 = Next.js + Search/RAG
- Part 5 = Places/Reminders/Location
- Part 6 = Smart dashboard/evaluation/deployment
- no permanent top-level `Your Space`
- `Transactions` is the finance destination
- `finance_transactions` is financial truth
- NoteItem finance fields are source/extraction context
- Search retrieval and generated RAG answer use separate API paths
- authenticated Django data is primarily client-fetched in Next.js
- live GPS stays browser-only
- Supabase PostgreSQL is the selected database target
