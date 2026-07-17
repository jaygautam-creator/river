# River

> A continuous, memory-aware AI companion that keeps the thread—without taking control of it.

River is built for the thoughts, plans, and personal projects that do not fit into a single chat. It carries forward only the storylines a person explicitly approves, so every memory stays visible, editable, and reversible.

## Why River

Most conversational AI starts from zero. River is designed around continuity with consent:

- **Multiple conversation threads** for different moments and contexts.
- **Memory proposals, not silent profiling**—a structured model extractor proposes at most one grounded storyline; users approve or reject every proposal, and failed/uncertain extraction saves nothing.
- **Searchable continuity** across conversations and approved memories.
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
- Hands-free Groq voice mode: start once, speak naturally, River detects a pause, replies aloud, and resumes listening. Speaking while River is talking interrupts the response. Recordings are not stored by River.
- Health, readiness, and authenticated metrics endpoints plus CI build/audit checks.
- Email verification, authenticator-app MFA, refresh-session device listing/revocation, and transactional password-reset delivery interfaces.

## Groq voice setup

Set these optional values in the ignored `.env` file to override the defaults:

```bash
GROQ_TRANSCRIPTION_MODEL=whisper-large-v3-turbo
GROQ_SPEECH_MODEL=canopylabs/orpheus-v1-english
```

Voice is hands-free after one start action: River detects a natural pause, transcribes the turn, replies in the active conversation thread, speaks the reply, and resumes listening. Speaking while River is talking interrupts the response. River does not persist the audio recording.

Before the first spoken reply, open Groq's Orpheus English model in its playground and accept its one-time model terms. River shows a direct instruction if this has not been completed.

For a production launch, replace local SQLite with managed encrypted storage and complete independent security, privacy, and model-safety reviews.

## Project standards

River is released under the [MIT License](LICENSE). See [CONTRIBUTING.md](CONTRIBUTING.md) for local workflow and product principles.

## Built with Codex and GPT-5.6

River was built collaboratively in Codex with GPT-5.6 Terra during OpenAI Build Week. Codex was used throughout the project to implement and test the React/Express application, improve the responsive interaction design, integrate and validate the model/voice flows, add privacy controls, run smoke tests and dependency audits, and maintain the GitHub repository.

The product decisions, scope, naming, model-provider choice, demo direction, and final submission narrative remain the builder's own. This README documents what is actually in the repository; it does not claim that unfinished production infrastructure is complete.
