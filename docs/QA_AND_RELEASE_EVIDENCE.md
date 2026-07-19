# River QA and release evidence

This checklist separates automated evidence from claims that require real people, devices, or infrastructure. Do not mark a gate complete merely because the UI looks correct in one browser.

## Every change

```bash
npm run check:regression
npm run build
npm audit --audit-level=high
```

CI runs these offline checks on every push. They protect the consent gate, evidence-bound memory extraction, session invalidation, CSRF guard, passkey safety gate, voice token handling, reconnect control, and keyboard focus treatment.

## Memory quality evaluation

Run against a non-production account set or a disposable staging deployment; the evaluator creates accounts and messages.

```bash
BASE_URL=https://your-staging-river.example \
MEMORY_EVAL_DELAY_MS=13000 \
MEMORY_EVAL_REPORT=artifacts/memory-eval.json \
npm run test:memory-eval -- --strict
```

Retain the JSON artifact with the deployed commit. Do not publish a precision, recall, or F1 figure until a complete report exists. Review failures for three risks: an unsupported memory, a missed durable memory, and an irrelevant memory injected into a reply.

## Device matrix

Record browser/version, deployment URL, network type, and outcome for each case:

| Surface | Minimum scenarios |
| --- | --- |
| Laptop | keyboard-only navigation, memory edit/save/delete, new thread, search, sign out every device |
| Phone | 360 px and 390 px layouts, menu, memory drawer, composer, rotation, safe-area padding |
| Voice quiet room | short greeting, long answer, mid-sentence pause, end conversation |
| Voice noisy room | hands-free false trigger resistance, press-to-talk fallback, microphone denied, tab muted |
| Live voice | provider reconnect, interruption/barge-in, no transcript or audio in logs |

## Load and restore evidence

Use only a staging database and a disposable account domain.

```bash
BASE_URL=https://your-staging-river.example \
LOAD_TEST_USERS=5 \
LOAD_TEST_REPORT=artifacts/load-test.json \
npm run test:load
```

For restore drills, follow [the production runbook](PRODUCTION_RUNBOOK.md#restore-drill-record). Capture the restore target, start/end time, data source, test report links, result, and person responsible. Never restore into production to test it.

## Still human/external gates

- Vercel alert rules and log review.
- Resend domain verification and real recovery-email deliverability.
- Passkey ceremony implementation and real-device tests before enabling enrollment.
- Independent security, privacy, legal, and model-safety review.
