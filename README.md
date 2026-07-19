# River

> A continuous, memory-aware AI companion that keeps the thread—without taking control of it.

River is built for the thoughts, plans, and personal projects that do not fit into a single chat. It carries forward only the storylines a person explicitly approves, so every memory stays visible, editable, and reversible.

## Why River

Most conversational AI starts from zero. River is designed around continuity with consent:

- **Multiple conversation threads** for different moments and contexts.
- **Consentful, useful memory**—River automatically saves clear, non-sensitive, high-confidence details that help it understand someone over time (such as enduring preferences, hobbies, plans, and projects). Sensitive or uncertain details always remain proposals for the person to review, edit, approve, or reject.
- **Searchable continuity** across conversations and approved memories, with recall-aware retrieval that never silently falls back to a fabricated history.
- **Real ownership controls**: edit, export, revoke memory consent, or delete the account.
- **Privacy-ready foundations** including secure browser sessions, CSRF protection, MFA, and device-session controls.

## Hackathon quick start

River works locally without a paid service. For real, model-generated conversation, add a Groq API key to the ignored `.env` file; without it River uses the built-in local reply fallback.

The default is Groq's `llama-3.3-70b-versatile`. Gemini remains available as a secondary provider. If a provider reports quota or credit exhaustion, River deliberately keeps the conversation usable with its local fallback instead of claiming a model response.

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. The Vite development server proxies API requests to River’s local API at port `8787`.

For a demo walkthrough and video storyboard, see [HACKATHON_DEMO.md](HACKATHON_DEMO.md).

For the Build Week submission checklist and personal-description outline, see [HACKATHON_SUBMISSION.md](HACKATHON_SUBMISSION.md).

## Verification

```bash
npm run test:smoke
npm run test:memory-eval
npm run test:load
npm run build
npm audit --audit-level=high
```

## Container deployment

Build and run the production container with a persistent volume for the SQLite database:

```bash
docker build -t river .
docker run --rm -p 8787:8787 -v river-data:/app/data -e DATABASE_PATH=/app/data/river.db -e JWT_SECRET='replace-with-a-long-random-secret' river
```

Set `NODE_ENV=production`, unique `JWT_SECRET` and `FIELD_ENCRYPTION_KEY` values, and production CORS settings before exposing River publicly. `FIELD_ENCRYPTION_KEY` encrypts authenticator-app MFA secrets at rest and must be independently rotated from the JWT secret. Browser sessions use secure HTTP-only cookies plus a CSRF token; terminate TLS before the container and preserve the forwarded HTTPS protocol. The included container is a deployment interface, not a substitute for managed database backups, TLS termination, key management, or an independent security review.

The production container runs as a non-root `river` user, persists the local database in `/app/data`, and has a health check. Its encrypted backup workflow requires `RIVER_BACKUP_ENCRYPTION_KEY` in production. To restore, stop River first, then explicitly set `RIVER_RESTORE_SOURCE`, `RIVER_BACKUP_ENCRYPTION_KEY`, and `RIVER_RESTORE_OVERWRITE=true` before running `npm run restore`.

### Optional transactional email

River can deliver password-recovery and email-verification links through Resend when these ignored environment variables are configured. Without them, those local-development flows remain available through the server console only and must not be relied on in production.

```bash
RESEND_API_KEY=re_...
EMAIL_FROM="River <hello@example.com>"
```

## What is included

- Responsive chat shell for mobile, tablet, and laptop layouts.
- Separate chat and memory scrolling surfaces.
- Editable storyline memory cards.
- Local SQLite persistence and demo seed flow.
- Server-side Groq chat integration for real companion responses, with Gemini and deterministic local fallbacks when no key is configured.
- Persistent multi-conversation threads and search across conversations and approved memories.
- User-controlled memory proposals, privacy preferences, and JSON data export.
- Adaptive Groq voice mode: start once, River calibrates to ambient sound, waits for sustained speech and a natural pause, replies aloud, and resumes listening. It supports sustained-speech barge-in and a press-to-talk fallback for noisy environments. Recordings are not stored by River.
- Health, readiness, and authenticated metrics endpoints plus CI build/audit checks.
- Email verification, authenticator-app MFA, refresh-session device listing/revocation, temporary failed-login lockout, and transactional password-reset delivery interfaces.

## Groq voice setup

Set these optional values in the ignored `.env` file to override the defaults:

```bash
GROQ_TRANSCRIPTION_MODEL=whisper-large-v3-turbo
GROQ_SPEECH_MODEL=canopylabs/orpheus-v1-english
```

Voice starts hands-free by default: River calibrates to ambient sound, detects sustained speech, waits longer after short or unfinished turns, transcribes the turn, replies in the active conversation thread, speaks the reply, and resumes listening. A sustained interruption stops River’s speech; press-to-talk is available when a room is noisy or browser speech awareness is unavailable. River does not persist the audio recording.

Before the first spoken reply, open Groq's Orpheus English model in its playground and accept its one-time model terms. River shows a direct instruction if this has not been completed.

## Memory evaluation

River includes a small, reproducible memory-quality harness. It sends four durable-storyline cases and four cases that should not become memories, then reports proposal precision, recall, and F1. It also approves one proposed memory, opens a new thread, and checks whether River recalls the approved summary without relying on the old thread’s raw messages.

```bash
npm run test:memory-eval
# Optional quality gate: precision >= 0.80 and recall >= 0.60
npm run test:memory-eval -- --strict
```

Run it against a locally started River server when you are ready to benchmark. Against a rate-limited provider, retain the report and add a pause between model calls so the result is evidence rather than a quota failure:

```bash
BASE_URL=https://your-river-domain.example \
MEMORY_EVAL_DELAY_MS=13000 \
MEMORY_EVAL_REPORT=artifacts/memory-eval.json \
npm run test:memory-eval -- --strict
```

The report records outcomes, strict-gate status, request latency percentiles, configured delay, timestamp, and any execution failure. Do not publish a precision/recall score until a completed report is retained with the model name and date.

The authenticated API load smoke test writes an evidence report without spending model/voice credits:

```bash
BASE_URL=https://your-river-domain.example LOAD_TEST_USERS=5 LOAD_TEST_REPORT=artifacts/load-test.json npm run test:load
```

## Real-time voice and launch boundaries

River includes two voice paths. Its default fallback is adaptive, turn-based Groq voice. When `REALTIME_VOICE_GATEWAY_URL` is configured, River uses the independently deployed Cloudflare WebSocket gateway with short-lived server-issued sessions, streaming Gemini Live audio, interruption events, live transcripts, and approved-memory context. See [the real-time voice architecture](docs/REALTIME_VOICE_ARCHITECTURE.md). The live path still requires load, noisy-room, browser, and latency validation before it can be called production-ready.

Draft launch documents are provided for legal review, not publication: [privacy policy](docs/PRIVACY_POLICY_DRAFT.md), [terms](docs/TERMS_OF_SERVICE_DRAFT.md), and [DPA](docs/DPA_DRAFT.md).

For a production launch, use managed encrypted storage and complete independent security, privacy, and model-safety reviews. See [the production runbook](docs/PRODUCTION_RUNBOOK.md) for deployment, voice-quality, restore-drill, and incident-response gates.

## Project standards

River is released under the [MIT License](LICENSE). See [CONTRIBUTING.md](CONTRIBUTING.md) for local workflow and product principles.

## Built with Codex and GPT-5.6

River was built collaboratively in Codex with GPT-5.6 Terra during OpenAI Build Week. Codex was used throughout the project to implement and test the React/Express application, improve the responsive interaction design, integrate and validate the model/voice flows, add privacy controls, run smoke tests and dependency audits, and maintain the GitHub repository.

The product decisions, scope, naming, model-provider choice, demo direction, and final submission narrative remain the builder's own. This README documents what is actually in the repository; it does not claim that unfinished production infrastructure is complete.
