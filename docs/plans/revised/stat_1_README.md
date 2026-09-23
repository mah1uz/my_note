# Clean Project Plan Pack

This plan pack assumes the database, Supabase Auth, UUID ownership, core models, and existing schema work were completed in Part 3.

## Locked implementation rule

Future work must NOT:
- create a new database;
- replace the existing database;
- add or redesign ownership models;
- create new core tables/columns merely because an older plan proposed them;
- run schema migrations unless fixing an already-confirmed defect outside this plan.

Database work allowed by this pack is optimization-only:
- indexes supported by measured query needs;
- query-plan review;
- select/prefetch tuning;
- bounded retrieval;
- transaction/concurrency hardening;
- integrity/isolation verification;
- performance measurement.

If a required model/field/table does not already exist, report the mismatch instead of silently creating it.

## Reading order

1. `architecture-consistency-roadmap.md`
2. `database-optimization-plan.md`
3. `part-03-4-foundation-verification.md`
4. `part-03-5-transactions-personalization-onboarding.md`
5. `part-04-hybrid-search-strict-rag.md`
6. `part-05-reminders-location.md`
7. `part-06-final-production.md`
8. `fluid-interactive-product-experience.md`
9. `documentation-consistency-audit.md`

## Product decisions retained

- Raw Note text remains the source record.
- AI output is derived and reviewable.
- Type and Domain remain separate.
- Confirmed Transactions are financial truth.
- NoteItem finance fields are extraction/source context only.
- Search retrieval and generated RAG answers use separate API paths.
- Deterministic queries bypass Groq.
- Live GPS stays browser-only and out of embeddings/RAG/Groq.
- Existing frontend stack remains in place unless a separate future decision changes it.
