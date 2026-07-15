# River enterprise architecture

## Trust boundaries

- Browser: presentation only; never receives provider secrets.
- River API: authentication, authorization, consent enforcement, model orchestration, audit events.
- Managed database: encrypted user data, memories, sessions, audit records.
- Model provider: receives only the minimum approved context; provider retention and regional processing must be configured and verified.
- Background workers: retention, notifications, exports, backup verification, and abuse detection.

## Production gates

| Gate | Repository evidence | External evidence required |
| --- | --- | --- |
| Auth | rotation/revocation endpoints and audit events | MFA, email provider, HTTPS cookies, penetration review |
| Privacy | consent, export, deletion, retention hooks | legal policy, DPA, regional processing decision |
| AI | model fallback and memory seam | safety evals, prompt-injection tests, provider review |
| Voice | session endpoint seam | Realtime provider setup, microphone/privacy review |
| Data | migration and backup scripts | managed encrypted DB, off-site backup, restore drill |
| Operations | health endpoint and smoke tests | CI/CD, monitoring, alerting, incident response |

No production deployment should bypass an external-evidence gate.
