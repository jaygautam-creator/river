# Public launch controls

River keeps each account's messages, threads, memories, sessions and usage rows scoped by the authenticated `user_id`. The application does not use one person's memories to answer another person's conversation.

## Protections now implemented

- PostgreSQL-backed per-IP request limits apply across Vercel instances. Signup is limited to 4 attempts per hour per privacy-hashed IP, password recovery to 4 per hour, login to 12 per 15 minutes, and other API traffic to 180 requests per minute by default.
- Account lockout remains active after five failed password attempts.
- Per-account daily quotas cap model cost: 120 chat completions, 45 transcription calls, 60 speech calls, and 45 live-turn saves by default. Environment variables can tune these without a code deploy.
- The owner-only `GET /api/internal/usage` endpoint requires the `X-River-Owner-Key` header. It returns aggregate counts only: users, active users, message counts, voice minutes, failed logins, rate limits and quota use. It deliberately never returns conversation text, emails, raw IP addresses, audio, or memory content.
- River's host logs are content-free structured request logs. Security and product audit events store only narrow operational metadata.

## Required before opening unrestricted signup

1. Create a Cloudflare Turnstile widget for `river-sigma-three.vercel.app`, plus `localhost` for development.
2. Add `TURNSTILE_SECRET` to Vercel and `VITE_TURNSTILE_SITE_KEY` to the Vite build environment, then set `TURNSTILE_REQUIRED=true` and redeploy.
3. Set a unique `OWNER_ANALYTICS_KEY` in Vercel. Never put it in client code, screenshots, or a public repository.
4. Configure Vercel log alerts for function errors, 429 spikes, and readiness failures. The alert setup is documented in `docs/VERCEL_MONITORING_SETUP.md`.

## Cloudflare WAF boundary

Cloudflare WAF and Bot Management only protect traffic that is proxied through a Cloudflare-managed domain. They cannot protect the default `*.vercel.app` hostname directly. Until River has a custom domain, the database-backed application limits are the active protection; Turnstile becomes an additional active control only after its site key and secret are configured. Do not claim Cloudflare WAF or Turnstile is enabled for the current Vercel hostname unless the relevant verification passes.

## Owner metrics request

```bash
curl -H "X-River-Owner-Key: $OWNER_ANALYTICS_KEY" \
  https://river-sigma-three.vercel.app/api/internal/usage
```

## Go/no-go check

Before a public post, confirm `/api/readiness` shows `database`, `jwt_secret`, `field_encryption`, `model`, and `turnstile` as `true`; run the authenticated smoke test; and inspect error/429 alerts after a small invited-user test.
