# Memory evaluation — 2026-07-19

This is a reproducible baseline run against the deployed River API at
`https://river-sigma-three.vercel.app` using `npm run test:memory-eval -- --strict`.

## Result

| Measure | Result |
| --- | ---: |
| Expected memory cases detected | 5 / 5 |
| False positives | 0 / 4 |
| Precision | 1.00 |
| Recall | 1.00 |
| F1 | 1.00 |
| Cross-thread recall | Passed |
| API request p50 / p95 | 1,256 ms / 3,748 ms |

The suite also includes a multi-memory scenario: “I play cricket most weekends
and I also enjoy chess with my brother.” River created two independent memories,
one for cricket and one for chess.

## Scope and limitation

This is a small controlled functional suite, not a population-level quality
claim. It proves that the current retrieval and extraction path handles the
covered cases. River should be tested with a larger, consented, diverse dataset
before publishing a general accuracy claim.
