# River enterprise readiness plan

## Gates

1. **Security and privacy** — threat model, auth lifecycle, consent, retention, encryption, abuse controls, and incident response.
2. **AI reliability** — structured memory extraction, provenance, deduplication, confidence thresholds, human approval, and model failure fallbacks.
3. **Realtime voice** — ephemeral session authorization, consent before microphone access, interruption handling, transcript controls, and reconnect behavior.
4. **Quality** — API/unit tests, responsive browser tests, accessibility checks, load tests, and migration tests.
5. **Operations** — environment separation, managed database, secrets manager, CI/CD, migrations, backups, observability, alerts, and rollback.

No production launch should occur until every gate has an owner, a test, and a rollback procedure.
