# River

River is a continuous, memory-aware AI companion. It keeps an ongoing thread instead of treating every conversation as a blank slate.

## Local development

```bash
npm install
npm run dev
```

The app runs at `http://127.0.0.1:8787`.

## Container deployment

Build and run the production container with a persistent volume for the SQLite database:

```bash
docker build -t river .
docker run --rm -p 8787:8787 -v river-data:/app/data -e DATABASE_PATH=/app/data/river.db -e JWT_SECRET='replace-with-a-long-random-secret' river
```

Set `NODE_ENV=production`, a unique `JWT_SECRET`, and production CORS settings before exposing River publicly. The included container is a deployment interface, not a substitute for managed database backups, TLS termination, key management, or an independent security review.

## Current state

- Responsive chat shell for mobile, tablet, and laptop layouts.
- Separate chat and memory scrolling surfaces.
- Editable storyline memory cards.
- Local SQLite persistence and demo seed flow.
- Deterministic local reply fallback while model integration is pending.
- Persistent multi-conversation threads and search across conversations and approved memories.
- User-controlled memory proposals, privacy preferences, and JSON data export.
- Voice permission/session readiness UI with clear failure and retry states; a server-side Realtime session provider still needs to be configured.
- Health, readiness, and authenticated metrics endpoints plus CI build/audit checks.

## Next build priorities

1. Set `OPENAI_API_KEY` and `REALTIME_MODEL=gpt-realtime` in the server environment to activate the included server-proxied WebRTC voice call path. Confirm provider billing, rate limits, voice policy, and transcript-retention settings before enabling it for users.
2. Replace the local SQLite deployment path with managed encrypted storage, backups, restore drills, and regional controls.
3. Add browser regression coverage at mobile and desktop breakpoints, then run load/soak testing.
4. Complete external production gates: transactional email, MFA/passkeys, independent penetration/privacy/model-safety reviews, and incident response ownership.
