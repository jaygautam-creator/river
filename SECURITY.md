# River security baseline

River handles private conversations and inferred personal storylines. Treat all conversation, memory, authentication, and model-provider data as sensitive.

## Current safeguards

- Model credentials remain server-side and are never sent to the browser.
- API requests have a body-size limit, request tracing, and basic persistent local throttling.
- Production refuses to start without an explicit `JWT_SECRET`.
- CORS defaults to the local origin and can be narrowed with `APP_ORIGIN`.
- Secure HTTP-only sessions use CSRF protection, refresh rotation, device revocation, session-version invalidation after MFA/password resets, authenticator-app MFA, email verification, recovery flows, and temporary lockout after repeated failed sign-ins.
- Memory writes are consent-gated proposals with provenance, confidence, sensitivity, review, edit, and deletion controls.
- Docker builds exclude local databases and backups; production backups require encryption and restrictive filesystem permissions.

## Required before production

- Replace SQLite-local persistence with encrypted managed storage and tested backups.
- Replace in-memory throttling with a shared Redis-backed limiter.
- Add suspicious-login detection, passkeys, and stronger device-risk signals.
- Review model-provider data retention and regional processing requirements.
- Enforce TLS at the edge, add a complete secure-header policy, and run dependency/container scanning continuously.
- Add centralized logs, metrics, traces, alerting, incident response, and key rotation.

Do not treat the current local server as production deployable until these controls are implemented and independently reviewed.
