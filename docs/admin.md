# Django Admin Plan and Implementation

## Purpose

Django Admin is a development and capstone-demonstration tool for inspecting Users and Notes. It is not an end-user application page and does not replace API authorization.

## Scope

- Enable `/admin/` using Django's built-in admin site.
- Use Django's built-in User admin.
- Register Note with owner, status, archive state, and timestamps.
- Add search, filters, ordering, and read-only timestamp fields.
- Require an active staff/superuser account.
- Verify anonymous and ordinary users cannot access admin pages.
- Verify a superuser can log in and inspect Notes.

## Security rules

- Never expose admin credentials in source-controlled settings or fixtures.
- Create development credentials only in the local SQLite database.
- Keep `/admin/` protected by Django session authentication and CSRF middleware.
- Do not grant staff status through the public registration API.
- Change demonstration passwords before any public deployment.

## Verification

Automated tests cover admin registration and access control. Manual verification uses the local development superuser documented in the final implementation report.

## Trial key pool (super-admin only)

Free-trial Groq keys are managed in the admin dashboard under AI settings →
Trial key pool. Keys are Fernet-encrypted with `SERVER_KEY_SECRET` before
the first write; full values are never returned, logged, or audited
(masked `••••1234` plus metadata only).

- Selection is round-robin by least-recent use; on a rate-limit or
  rejected-key failure the backend fails over to the next key inside the
  same call. After 3 consecutive key failures a key auto-disables with a
  reason; re-enabling resets the counter.
- `.env` `GROQ_API_KEY` remains as fallback when the pool is empty.
- Rotate by deleting (or deactivating) a key — no redeploy needed.
- Operations: generate the secret once and back it up
  (`python -c "from cryptography.fernet import Fernet;
  print(Fernet.generate_key().decode())"`), set it as `SERVER_KEY_SECRET`
  on the host, and run migrations. Losing it orphans stored keys:
  delete and re-add them. Without it, key CRUD returns `503` and the
  `.env` fallback keeps working.
