# River threat model

## Assets

- Conversation content and inferred personal storylines.
- Authentication credentials, refresh tokens, reset tokens, and audit events.
- Voice transcripts and any future audio artifacts.
- Model-provider credentials and operational telemetry.

## Primary threats

- Account takeover through credential stuffing, reset-token theft, or session theft.
- Cross-site request forgery or token exposure.
- Unauthorized access to another user’s messages or memories.
- Prompt injection causing unsafe disclosure or memory poisoning.
- Excessive retention or provider-side data exposure.
- Abuse of chat, voice, export, or reset endpoints.
- Backup theft and restore-path compromise.

## Required controls

- Short-lived sessions, rotation, revocation, MFA, secure cookies, CSRF protection.
- Per-user authorization on every data endpoint and privacy-safe audit events.
- Consent-gated memory writes with provenance and user approval for sensitive items.
- Redaction/minimization before model calls, provider retention review, and deletion workflows.
- Shared rate limits, abuse detection, monitoring, alerting, encrypted backups, and restore drills.
