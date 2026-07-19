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
4. Run the deployment-independent verification after every production release. It deliberately checks only service configuration and never prints secrets:

   ```bash
   BASE_URL=https://your-river-domain.example \
   VOICE_GATEWAY_URL=wss://your-live-voice-gateway.example \
   npm run check:production
   ```

5. Run `npm run check:regression`, `npm run build`, `npm run test:smoke`, and `npm audit --audit-level=high` before release. The local smoke command checks the SQLite demo stack; use the retained deployed evaluator and load-test artifacts for Postgres production evidence.
6. Review Vercel deployment logs after every production deploy and roll back immediately if readiness fails.

## Latency budgets and observability

River emits one structured, content-free `http.request` log event per API request with a request ID, route, status, and duration. Use the Vercel log explorer or a managed log drain to alert on elevated 5xx responses and sustained latency. Do not add messages, memory summaries, audio, transcripts, access tokens, or provider keys to logs.

Set an initial release budget, then measure it from production traffic before tightening it:

| Interaction | Initial p95 target | Escalation threshold |
| --- | ---: | ---: |
| Thread creation / memory edit | 1.5 s | 3 s |
| Conversation fetch | 1.5 s | 3 s |
| Text reply, excluding model generation | 2 s | 4 s |
| Voice turn to first audio | 2.5 s on a streaming gateway | 4 s |

The existing Groq REST voice path is not a streaming gateway and is expected to exceed the voice target under normal network/provider conditions. Treat that as an architectural limitation, not a client rendering defect. Keep the application and database in compatible nearby regions before trying to optimize browser code; do not move regions or plans without cost/availability approval.

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

## Restore drill record

Run a restore drill at least quarterly and after any material migration. The local encrypted-backup scripts support a verifiable drill for SQLite deployments; the Supabase deployment must use a separate staging project or restore environment.

1. Record the source backup/snapshot ID, operator, target environment, and start time.
2. Restore only into an isolated environment—never the active production database.
3. Run `npm run test:smoke` and a retained `npm run test:memory-eval -- --strict` report against that environment.
4. Verify sign-in, approved-memory recall, deletion, and retention behavior manually.
5. Record recovery time, recovery point, failures, and follow-up owner. Destroy the restore environment when complete.

## Load and release testing

The repository includes a low-cost authenticated API load smoke test. It does not invoke models, create raw-audio traffic, or represent a full capacity certification.

```bash
BASE_URL=https://your-river-domain.example \
LOAD_TEST_USERS=5 \
LOAD_TEST_REPORT=artifacts/load-test.json \
npm run test:load
```

Retain the JSON report with the Vercel deployment ID. Increase concurrency only after confirming account-creation limits and provider costs. Full load/soak testing, regional failover, monitoring alerts, and an independent review remain formal release gates.

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
- A regional, long-lived live-voice gateway with short-lived sessions and load testing; see [real-time voice architecture](REALTIME_VOICE_ARCHITECTURE.md).
- Published, counsel-reviewed legal documents. Repository drafts are available for review: [privacy policy](PRIVACY_POLICY_DRAFT.md), [terms](TERMS_OF_SERVICE_DRAFT.md), and [DPA](DPA_DRAFT.md).
