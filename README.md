# River

> A continuous, memory-aware AI companion that keeps the thread—without taking control of it.

River is built for the thoughts, plans, and personal projects that do not fit into a single chat. It carries forward only the storylines a person explicitly approves, so every memory stays visible, editable, and reversible.

## Why River

Most conversational AI starts from zero. River is designed around continuity with consent:

- **Multiple conversation threads** for different moments and contexts.
- **Memory proposals, not silent profiling**—users approve or reject every new storyline.
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

## What is included

- Responsive chat shell for mobile, tablet, and laptop layouts.
- Separate chat and memory scrolling surfaces.
- Editable storyline memory cards.
- Local SQLite persistence and demo seed flow.
- Server-side Groq chat integration for real companion responses, with Gemini and deterministic local fallbacks when no key is configured.
- Persistent multi-conversation threads and search across conversations and approved memories.
- User-controlled memory proposals, privacy preferences, and JSON data export.
- Optional Realtime voice path with clear permission, failure, and reconnect states when an API key is configured.
- Health, readiness, and authenticated metrics endpoints plus CI build/audit checks.
- Authenticator-app MFA, refresh-session device listing/revocation, and transactional password-reset delivery interfaces.

## Optional live integrations

Set `OPENAI_API_KEY` and `REALTIME_MODEL=gpt-realtime` only if you want live AI responses and voice. River remains fully demoable without them.

For a production launch, replace local SQLite with managed encrypted storage and complete independent security, privacy, and model-safety reviews.

## Project standards

River is released under the [MIT License](LICENSE). See [CONTRIBUTING.md](CONTRIBUTING.md) for local workflow and product principles.
