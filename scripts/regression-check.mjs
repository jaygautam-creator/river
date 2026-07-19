import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const api = await readFile(new URL('../api/index.js', import.meta.url), 'utf8')
const client = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8')
const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')

// These are intentionally cheap, offline contract checks. They protect security
// and accessibility invariants in CI; real device and deployed API checks are
// documented separately in the launch checklist.
for (const [name, source, expected] of [
  ['consent-aware memory modes', api, "['auto', 'review'].includes(memoryMode)"],
  ['evidence-bound memory extraction', api, 'item?.topic && item?.summary && item?.evidence'],
  ['memory categories', api, "'preference', 'project', 'plan', 'relationship', 'wellbeing', 'identity', 'other'"],
  ['cross-thread recall handling', api, 'const recallIntent'],
  ['session version invalidation', api, 'session_version=session_version+1'],
  ['CSRF verification', api, "'Your session could not be verified. Refresh and try again.'"],
  ['passkey safety gate', api, "readiness: 'foundation-only'"],
  ['live voice short-lived token', api, "expiresIn: '60s'"],
  ['live voice reconnect guard', client, 'liveReconnectAttemptsRef'],
  ['live voice setup deadline', client, 'liveReadyTimerRef'],
  ['voice press-to-talk fallback', client, "useState('tap')"],
  ['voice press-to-talk control', client, 'Press to talk'],
  ['voice hands-free opt-in', client, 'Hands-free beta'],
  ['voice turn-completion evidence gate', client, 'transcriptStillChanging'],
  ['voice manual mode does not auto-listen after speech', client, "turnModeRef.current === 'tap'"],
  ['shared IP rate limiter', api, 'rate_limit_buckets'],
  ['privacy-hashed abuse key', api, 'const clientFingerprint'],
  ['daily AI quota guard', api, 'const quota = (category, envName, fallback)'],
  ['owner analytics secret guard', api, 'const ownerAuthorized'],
  ['content-free aggregate usage response', api, 'Aggregated operational metrics only'],
  ['Turnstile server verifier', api, 'challenges.cloudflare.com/turnstile/v0/siteverify'],
  ['dialog accessible names', client, 'aria-modal="true"'],
  ['visible keyboard focus', css, 'button:focus-visible']
]) assert.ok(source.includes(expected), `Missing regression contract: ${name}`)

assert.ok(!client.includes('river.live?token='), 'Live voice tokens must not appear in URLs.')
console.log('River offline regression contracts passed.')
