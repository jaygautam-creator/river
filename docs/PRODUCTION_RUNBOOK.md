# River production runbook

This runbook describes the minimum operating standard for a public River deployment. It does not replace an independent security, privacy, or model-safety review.

## Architecture

- **Web and API:** Vercel serves the React client and `api/index.js` serverless API.
- **Data:** Supabase Postgres via the transaction-pooler `DATABASE_URL`.
- **AI:** Groq keys remain server-only and are used for chat, approved-memory extraction, transcription, and text-to-speech.
- **Sensitive values:** Vercel environment variables only. Never place `DATABASE_URL`, `JWT_SECRET`, `FIELD_ENCRYPTION_KEY`, provider keys, or email credentials in Git.

## Deployment checklist

1. Set production-only Vercel variables: `DATABASE_URL`, `JWT_SECRET`, `FIELD_ENCRYPTION_KEY`, `GROQ_API_KEY`, `APP_ORIGIN`, and, when email is enabled, `RESEND_API_KEY` and `EMAIL_FROM`.
2. Use independently generated secrets for `JWT_SECRET` and `FIELD_ENCRYPTION_KEY`; rotate deliberately because rotation invalidates existing sessions or encrypted MFA data.
3. Confirm `GET /api/readiness` reports database, JWT, field encryption, and model readiness.
4. Run `npm run build`, `npm run test:smoke`, and `npm audit --audit-level=high` before release.
5. Review Vercel deployment logs after every production deploy and roll back immediately if readiness fails.

## Voice quality and operations

River records only the active browser turn; it does not persist audio. The client records privacy-safe timing telemetry (`capture`, `transcription`, `reply`, `speech`, and final turn outcome) without audio or transcripts. The API stores only stage, duration, outcome, and user account reference in `voice_events`.

For a release candidate, test all of these on a real phone and laptop:

- quiet room, normal conversation, and moderate background noise;
- a short utterance such as “hello”; a mid-sentence pause; and a long explanation;
- barge-in while River is speaking;
- browser autoplay blocked, microphone denied, tab muted, slow network, and reconnect;
- both hands-free and press-to-talk fallback.

Treat a sustained increase in `reply` or `speech` duration as a provider/network issue. Treat high `capture` duration or frequent `interrupted` events as a turn-detection issue. Do not log raw audio or transcripts merely to debug voice latency.

## Database safety

- Supabase manages encrypted storage and automated platform backups, but River still needs a documented restore drill before claiming production readiness.
- Export a sanitized staging dataset, restore it into a separate project, and prove sign-in, conversation retrieval, approved-memory retrieval, and deletion work there.
- Rehearse rollback with a Vercel deployment rollback and record the timestamp, owner, and outcome.
- Keep Row Level Security enabled for any Supabase tables exposed directly to a client. River’s current application data path is server-side Postgres, not direct browser table access.

## Incident response

1. Disable provider keys or Vercel traffic if a credential leak or unsafe behavior is suspected.
2. Rotate affected secrets; increment user session versions if access-token compromise is suspected.
3. Preserve Vercel request IDs and deployment logs. Do not add raw conversation content to incident notes unless a user explicitly consents and access is authorized.
4. Notify affected users when required by applicable law or your privacy policy.

## Release gates still outside this repository

- Transactional email domain verification and deliverability testing.
- Managed monitoring/alerting and an off-site restore drill.
- Published privacy policy, terms, consent records, and jurisdictional review.
- Passkeys or WebAuthn, suspicious-login alerts, richer device controls.
- Independent application security, privacy, and model-safety assessments.
