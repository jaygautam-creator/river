# River launch review checklist

This document separates completed engineering safeguards from review work that only qualified external people can sign off.

## Complete in the repository

- encrypted application fields, secure cookie sessions, CSRF protection, refresh-token rotation, MFA, session/device controls, export/delete, retention configuration, and baseline rate limits;
- no secrets in tracked files (`.env*`, local SQLite databases, backups, and generated artifacts are ignored);
- production readiness check, smoke test, memory-evaluation runner, load-test runner, and backup/restore procedures;
- WebSocket gateway with origin enforcement, short-lived session claims, constrained client message schema, and per-connection message-rate limits.

## Requires the owner or an external reviewer

- Resend sender-domain verification and receipt testing;
- Vercel notification contacts and on-call ownership;
- Supabase backup/restore drill in an isolated project, with an evidence record of the recovered schema and sampled data;
- controlled laptop, mobile, and noisy-room voice tests using informed participants;
- legal counsel review of the privacy policy, terms, and DPA drafts for the jurisdictions and customers River will serve;
- independent security/privacy assessment, including cloud configuration and live endpoints.

## Evidence to retain

For each item record the date, environment, operator, test inputs, outcome, and remediation. Do not store passwords, raw audio, API keys, or personal chat content in the evidence record.
