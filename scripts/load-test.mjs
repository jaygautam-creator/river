import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const base = (process.env.BASE_URL || 'http://127.0.0.1:8787').replace(/\/$/, '')
const users = Math.max(1, Math.min(25, Number(process.env.LOAD_TEST_USERS || 5)))
const reportPath = process.env.LOAD_TEST_REPORT || ''
const durations = []
const failures = []
const measure = async (name, fn) => {
  const startedAt = performance.now()
  try {
    await fn()
    durations.push({ name, duration_ms: Math.round(performance.now() - startedAt), ok: true })
  } catch (error) {
    const durationMs = Math.round(performance.now() - startedAt)
    durations.push({ name, duration_ms: durationMs, ok: false })
    failures.push({ name, duration_ms: durationMs, error: error.message })
  }
}
const percentile = (items, p) => {
  const values = items.map(item => item.duration_ms).sort((a, b) => a - b)
  return values.length ? values[Math.min(values.length - 1, Math.ceil(values.length * p) - 1)] : null
}
const request = async (path, options = {}) => {
  const response = await fetch(`${base}${path}`, options)
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`${path}: ${response.status} ${body.error || ''}`.trim())
  return body
}

await measure('health', () => request('/api/health'))
await measure('readiness', () => request('/api/readiness'))
await Promise.all(Array.from({ length: users }, (_, index) => measure(`user-${index + 1}`, async () => {
  const account = await request('/api/auth/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: `Load test ${index + 1}`, email: `load-${Date.now()}-${index}-${crypto.randomUUID().slice(0, 8)}@river.local`, password: 'load-test-password-123' }) })
  const headers = { Authorization: `Bearer ${account.token}`, 'content-type': 'application/json' }
  await request('/api/auth/me', { headers })
  const thread = await request('/api/threads', { method: 'POST', headers, body: JSON.stringify({ title: 'Load test thread' }) })
  await request(`/api/conversation?thread_id=${thread.thread.id}`, { headers })
  await request('/api/privacy/preferences', { headers })
})))

const report = {
  schema_version: 1,
  executed_at: new Date().toISOString(),
  base,
  users,
  completed: failures.length === 0,
  requests: durations,
  summary_ms: { count: durations.length, p50: percentile(durations, .5), p95: percentile(durations, .95), max: durations.length ? Math.max(...durations.map(item => item.duration_ms)) : null },
  failures
}
if (reportPath) {
  const target = resolve(reportPath)
  await mkdir(dirname(target), { recursive: true })
  report.report_path = target
}
const serialized = `${JSON.stringify(report, null, 2)}\n`
if (report.report_path) await writeFile(report.report_path, serialized, 'utf8')
console.log(serialized)
if (failures.length) process.exitCode = 1
