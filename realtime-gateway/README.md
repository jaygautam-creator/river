# River real-time voice gateway

This Cloudflare Worker is a deployable WebSocket relay for Gemini Live. It is intentionally separate from River's Vercel API because a long-lived audio connection does not belong in a request/response serverless function.

## Deployment

1. Create a Cloudflare account and install/authenticate Wrangler.
2. From this directory, deploy the Worker with `npx wrangler deploy`.
3. Configure secrets, never plain variables:

```bash
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put RIVER_JWT_SECRET
npx wrangler secret put ALLOWED_ORIGIN
```

`RIVER_JWT_SECRET` must exactly match River's production secret. `ALLOWED_ORIGIN` is the deployed River origin, for example `https://river-sigma-three.vercel.app`.

4. Set `REALTIME_VOICE_GATEWAY_URL=wss://<worker-domain>/live` in Vercel and redeploy River.

## Security model

- River issues a purpose-limited, 60-second live-session token from `/api/voice/live/session`; the gateway validates its HS256 signature and expiry before opening a provider connection. The normal HTTP-only River session cookie never leaves River.
- The Gemini API key remains only in the Worker secret store.
- The Worker sends the provider setup itself; browser messages are limited to real-time input/control frames and cannot override River's model/system policy.
- Raw audio is relayed, not persisted. The gateway emits no transcript or audio logs.

## Before enabling for users

Run the voice scenarios in `docs/PRODUCTION_RUNBOOK.md`, add per-user/IP rate limiting using a durable store, verify Gemini Live model availability for the account, and perform a security review of the shared JWT-secret design. A production evolution should replace the shared JWT secret with server-issued ephemeral Live tokens.
