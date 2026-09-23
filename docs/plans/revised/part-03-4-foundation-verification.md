# PART 3.4 - FOUNDATION VERIFICATION AND HARDENING

## Scope

Part 3 already completed database/auth/ownership setup. This phase verifies and hardens the existing foundation only.

Do not:
- create or replace a database;
- migrate ownership models;
- create UUID conversions;
- add new auth identity tables;
- redesign Supabase integration;
- add new schema from older plans.

## Verify current architecture

Confirm the existing application provides:
- authenticated frontend session;
- Bearer access token to Django where currently designed;
- server-side token validation;
- stable current-user resolution;
- owner-scoped Notes and child data;
- staff/admin separation;
- secret separation between frontend and backend.

Do not change working auth architecture merely to match old documentation wording.

## Security checks

Verify:
- signature/issuer/audience/expiry checks where applicable;
- invalid/expired tokens fail safely;
- disabled/suspended users follow current policy;
- foreign-object access is blocked;
- frontend contains no backend secrets;
- logs do not print tokens, database URLs, API keys, or sensitive payloads.

## Admin privacy

Keep private user content out of normal admin surfaces unless the existing product explicitly requires a sanitized projection.

Do not expose:
- raw Notes;
- private NoteItem content;
- transaction details;
- AI raw artifacts;
- embeddings;
- precise saved coordinates;
- BYOK secrets.

## Database optimization only

Allowed:
- inspect slow queries;
- remove N+1 behavior;
- tune related-object loading;
- add measured indexes on existing fields if needed;
- validate existing constraints/cascades.

Do not create new tables/columns.

## Regression tests

Backend:
- Notes CRUD;
- AI analyze/review;
- ownership/isolation;
- authentication failures;
- repeated login/session use;
- admin separation.

Frontend:
- session restore;
- login/register if currently supported;
- protected routes;
- API bearer attachment;
- logout;
- auth error handling.

## Acceptance

Part 3.4 is complete when the existing Part 3 foundation passes regression, privacy, isolation, and performance checks without schema or framework migration.
