# River security baseline

River handles private conversations and inferred personal storylines. Treat all conversation, memory, authentication, and model-provider data as sensitive.

## Current safeguards

- Model credentials remain server-side and are never sent to the browser.
- API requests have a body-size limit and basic per-IP throttling.
- Production refuses to start without an explicit `JWT_SECRET`.
- CORS defaults to the local origin and can be narrowed with `APP_ORIGIN`.
- Storyline seed creation is idempotent.

## Required before production

- Replace SQLite-local persistence with encrypted managed storage and tested backups.
- Replace in-memory throttling with a shared Redis-backed limiter.
- Use short-lived access tokens with refresh-token rotation and revocation.
- Add account lockout, email verification, password reset, MFA, and audit events.
- Add data export/deletion, retention controls, and explicit memory consent/revocation.
- Review model-provider data retention and regional processing requirements.
- Add HTTPS, secure headers, CSRF protection where cookie auth is used, and dependency scanning.
- Add centralized logs, metrics, traces, alerting, incident response, and key rotation.

Do not treat the current local server as production deployable until these controls are implemented and independently reviewed.
