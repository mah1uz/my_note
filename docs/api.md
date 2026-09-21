# Part 2 API

Base URL: `/api/v1`

Request bodies must use `Content-Type: application/json`. Form-encoded API requests are rejected.

## Authentication

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/auth/register/` | Create a user and return an access token |
| POST | `/auth/login/` | Authenticate and return an access token |
| POST | `/auth/refresh/` | Rotate the HttpOnly refresh cookie and return an access token |
| POST | `/auth/logout/` | Blacklist the refresh token and clear its cookie |
| GET | `/auth/me/` | Return the authenticated user's limited profile |
| POST | `/auth/password-reset/` | Request a signed password-reset link |
| POST | `/auth/password-reset/confirm/` | Set a new password using `uid` and `token` |

The password-reset request always returns the same generic success response and never returns a reset token or URL. In local development, Django's console email backend prints the email containing the link to the backend terminal.

Successful password reset invalidates existing access tokens and blacklists outstanding refresh tokens for that user.

## Notes

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/notes/` | List the current user's notes, newest first |
| POST | `/notes/` | Create an `UNPROCESSED` note for the current user |
| GET | `/notes/:id/` | Retrieve an owned note |
| PATCH | `/notes/:id/` | Update an owned note |
| DELETE | `/notes/:id/` | Delete an owned note |

Create payload:

```json
{ "raw_text": "Buy eggs from Agora" }
```

Another user's note is not present in the scoped queryset and therefore returns `404`, avoiding resource-existence disclosure.
