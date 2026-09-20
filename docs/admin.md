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
