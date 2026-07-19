# Vercel monitoring baseline

Vercel logs are River's current production monitoring surface. Configure these before inviting real users.

## Owner checklist

1. In **Vercel → River → Settings → Notifications**, enable email alerts for failed production deployments.
2. In **Logs**, save filters for `level:error` and these routes: `/api/health`, `/api/chat`, `/api/voice/live/session`, and `/api/auth/*`.
3. Review errors daily during beta and immediately after every deploy.
4. In **Speed Insights**, enable Web Vitals collection and watch interaction latency on the conversation, memory, and authentication screens.
5. Create an incident note for any sustained 5xx increase, authentication failure spike, or degraded health check. Do not include prompts, tokens, passwords, or raw audio in the note.

## Suggested initial alert thresholds

| Signal | Escalate when |
| --- | --- |
| Health endpoint | two consecutive failed checks |
| `/api/chat` or `/api/auth/*` | 5xx rate exceeds 2% for 10 minutes |
| Voice gateway | provider/session errors exceed 5% in an hour |
| Client interaction | p75 INP exceeds 300 ms after excluding network waits |

These thresholds are operational starting points, not an SLO claim. River needs a sustained production traffic baseline before formal service objectives are set.
# Vercel monitoring setup

River emits content-free structured request logs. Configure Vercel alerts before sharing the public URL:

1. In Vercel **Logs**, save filters for `status >= 500`, `status = 429`, and the `/api/readiness` route.
2. Create alerts for a sustained 5xx increase, repeated readiness failures, and a material spike in 429 responses. Send them to an owner-controlled email or notification channel.
3. Review logs after the first public traffic window. Never copy request bodies, cookies, Authorization headers, emails, or transcripts into an issue tracker.
4. Use the protected `/api/internal/usage` endpoint for aggregate adoption/cost signals. It intentionally excludes conversation content and direct identifiers.

This is baseline operational monitoring, not a substitute for an external error-monitoring product, on-call rotation, or a formal incident-response program.
