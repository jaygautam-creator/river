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
