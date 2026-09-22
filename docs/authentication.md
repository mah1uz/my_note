# Authentication Architecture

The target identity provider is Supabase Auth for email/password and Google.
Django verifies Supabase access JWTs using the project's JWKS endpoint and maps
`iss + sub` through `UserAuthIdentity` to the internal UUID `AppUser`.

```text
Supabase Auth -> access JWT -> Django JWKS verification
             -> UserAuthIdentity(issuer, subject) -> AppUser UUID
```

Supabase Auth is the active application authentication system. The frontend
uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Never put
Supabase secret/service-role keys, database passwords, Django secrets, or
Groq server keys in Vite variables.

The first valid Supabase request creates `AppUser`, `UserAuthIdentity`, and
`UserPreference` atomically. Existing accounts are not implicitly merged by
email. Suspended, deletion-pending, and deleted application users are rejected
even when their JWT is valid.

Google requires a Google Cloud Web OAuth client, `openid`, `email`, and
`profile` scopes, local/production origins, Supabase's provider callback URI,
and matching Supabase redirect allow-list entries. The React app uses the
standard Supabase SPA session model; Django receives the current access token
as a Bearer token.
