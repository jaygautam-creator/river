# River

> A continuous, memory-aware AI companion that keeps the thread—without taking control of it.

River is built for the thoughts, plans, and personal projects that do not fit into a single chat. It carries forward only the storylines a person explicitly approves, so every memory stays visible, editable, and reversible.

**[Try the demo](https://river-sigma-three.vercel.app/)** · [How to run it](#quick-start) · [Voice notes](#voice-setup) · [Memory evaluation](#memory-evaluation)

> **Current status:** River is a public beta. Text chat, account-scoped threads, consent-aware memory, and press-to-talk voice are available. Live streaming voice and production operations are still being validated.

## How River works

1. **Talk in any thread.** Keep work, relationships, ideas, and everyday life in their own conversations.
2. **River notices possible continuity.** Clear, non-sensitive details can be saved automatically; sensitive or uncertain details stay as a proposal.
3. **You stay in charge.** Review, edit, approve, revoke, export, or delete memories whenever you want.

## Why River

Most conversational AI starts from zero. River is designed around continuity without taking ownership away from the person using it:

- **Multiple conversation threads** for different moments and contexts.
- **Consentful, useful memory**—River automatically saves clear, non-sensitive, high-confidence details that help it understand someone over time (such as enduring preferences, hobbies, plans, and projects). Sensitive or uncertain details always remain proposals for the person to review, edit, approve, or reject.
- **Searchable continuity** across conversations and approved memories, with recall-aware retrieval that never silently falls back to a fabricated history.
- **Real ownership controls**: edit, export, revoke memory consent, or delete the account.
- **Account and privacy controls** including secure browser sessions, CSRF protection, MFA, email-free backup recovery codes, and device-session controls.

## Quick start

River works locally without a paid service. For real, model-generated conversation, add a Groq API key to the ignored `.env` file; without it River uses the built-in local reply fallback.

The default chat model is Groq's `llama-3.3-70b-versatile`. Gemini is the preferred speech provider when `GEMINI_API_KEY` is configured; Groq handles transcription and remains the speech fallback. If a provider reports quota or credit exhaustion, River keeps the conversation usable with its local fallback instead of pretending a model response was generated.

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

## Engineering deployment notes

Build and run the production container with a persistent volume for the SQLite database:

```bash
docker build -t river .
docker run --rm -p 8787:8787 -v river-data:/app/data -e DATABASE_PATH=/app/data/river.db -e JWT_SECRET='replace-with-a-long-random-secret' river
```

Set `NODE_ENV=production`, unique `JWT_SECRET` and `FIELD_ENCRYPTION_KEY` values, and production CORS settings before exposing River publicly. `FIELD_ENCRYPTION_KEY` encrypts authenticator-app MFA secrets at rest and must be independently rotated from the JWT secret. Browser sessions use secure HTTP-only cookies plus a CSRF token; terminate TLS before the container and preserve the forwarded HTTPS protocol. The included container is a deployment interface, not a substitute for managed database backups, TLS termination, key management, or an independent security review.

The production container runs as a non-root `river` user, persists the local database in `/app/data`, and has a health check. Its encrypted backup workflow requires `RIVER_BACKUP_ENCRYPTION_KEY` in production. To restore, stop River first, then explicitly set `RIVER_RESTORE_SOURCE`, `RIVER_BACKUP_ENCRYPTION_KEY`, and `RIVER_RESTORE_OVERWRITE=true` before running `npm run restore`.

### Account recovery

Because a forgotten password would otherwise mean permanent lockout, River issues **backup recovery codes**—no email provider or custom domain required:

- Eight single-use codes are shown once at signup, with a copy control and an explicit save-acknowledgement step. They are stored only as SHA-256 hashes and are never emailed or persisted in plaintext.
- A **Forgot your password?** flow on the sign-in screen takes an email, one recovery code, and a new password. A successful reset rotates the password, invalidates existing sessions, and clears any failed-login lockout.
- The **Account & privacy** panel shows how many codes remain and can regenerate a fresh set at any time.
- The recovery endpoint is rate-limited and returns a uniform failure for a wrong email or a wrong code, so neither can be probed.

### Optional transactional email

River can additionally deliver password-recovery and email-verification links through Resend when these ignored environment variables are configured. Without them, River relies on the recovery codes above, and the console-only email links must not be relied on in production.

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
- Adaptive voice mode: Groq handles transcription; Gemini TTS is preferred when configured, with Groq speech as an automatic fallback. River waits for sustained speech and a natural pause, replies aloud, and resumes listening. It supports sustained-speech barge-in and a press-to-talk fallback for noisy environments. Recordings are not stored by River.
- Health, readiness, and authenticated metrics endpoints plus CI build/audit checks.
- Email verification, authenticator-app MFA, single-use backup recovery codes for email-free account recovery, refresh-session device listing/revocation, temporary failed-login lockout, and transactional password-reset delivery interfaces.

## Voice setup

Set these optional values in the ignored `.env` file to override the defaults:

```bash
GROQ_TRANSCRIPTION_MODEL=whisper-large-v3-turbo
GROQ_SPEECH_MODEL=canopylabs/orpheus-v1-english
GEMINI_SPEECH_MODEL=gemini-3.1-flash-tts-preview
GEMINI_SPEECH_VOICE=Aoede
```

Voice starts hands-free by default: River calibrates to ambient sound, detects sustained speech, waits longer after short or unfinished turns, transcribes the turn, replies in the active conversation thread, speaks the reply, and resumes listening. A sustained interruption stops River’s speech; press-to-talk is available when a room is noisy or browser speech awareness is unavailable. River does not persist the audio recording.

With `GEMINI_API_KEY`, River prefers Gemini TTS for a consistent voice and falls back to the configured Groq voice if Gemini's preview or free-tier quota is unavailable. Groq remains required for the current transcription path. Before the first Groq fallback reply, open Groq's Orpheus English model in its playground and accept its one-time model terms.

## Memory evaluation

The latest deployed baseline, including multi-memory extraction and cross-thread recall, is recorded in [the evaluation report](docs/evaluations/memory-eval-2026-07-19.md). It is a small controlled suite, not a population-level accuracy claim.

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

For a production launch, use managed encrypted storage and complete independent security, privacy, and model-safety reviews. See [the production runbook](docs/PRODUCTION_RUNBOOK.md) for deployment, voice-quality, restore-drill, and incident-response gates. The owner-facing [email delivery](docs/EMAIL_DELIVERY_SETUP.md), [Vercel monitoring](docs/VERCEL_MONITORING_SETUP.md), and [launch review checklist](docs/LAUNCH_REVIEW_CHECKLIST.md) make the remaining external work explicit.

## Project standards

River is released under the [MIT License](LICENSE). See [CONTRIBUTING.md](CONTRIBUTING.md) for local workflow and product principles.

## Built with Codex and GPT-5.6

River was built collaboratively in Codex with GPT-5.6 Terra during OpenAI Build Week. Codex was used throughout the project to implement and test the React/Express application, improve the responsive interaction design, integrate and validate the model/voice flows, add privacy controls, run smoke tests and dependency audits, and maintain the GitHub repository.

The product decisions, scope, naming, model-provider choice, demo direction, and final submission narrative remain the builder's own. This README documents what is actually in the repository; it does not claim that unfinished production infrastructure is complete.
