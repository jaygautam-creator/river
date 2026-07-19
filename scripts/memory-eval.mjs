import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const base = (process.env.BASE_URL || 'http://127.0.0.1:8787').replace(/\/$/, '')
const strict = process.argv.includes('--strict')
const reportFlag = process.argv.find(value => value.startsWith('--report='))
const reportPath = reportFlag?.slice('--report='.length) || process.env.MEMORY_EVAL_REPORT || ''
// Groq free tiers are deliberately conservative. Space model calls by default so a
// benchmark produces evidence instead of a misleading rate-limit failure.
const delayMs = Math.max(0, Number(process.env.MEMORY_EVAL_DELAY_MS || 13_000))
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

const cases = [
  { id: 'enduring-project', shouldRemember: true, text: 'I am building a photo journal for my grandmother’s recipes and want to keep working on it this summer.' },
  { id: 'relationship-concern', shouldRemember: true, text: 'I have been feeling hurt and uncertain because my close friends say I can come across as distant.' },
  { id: 'upcoming-plan', shouldRemember: true, text: 'I want to plan a two-week trip to Lisbon in late summer, but I do not want every day scheduled.' },
  { id: 'recurring-wellbeing', shouldRemember: true, text: 'I keep losing sleep before work presentations, and I want to find a steadier routine.' },
  { id: 'multiple-hobbies', shouldRemember: true, minimumMemories: 2, text: 'I play cricket most weekends and I also enjoy chess with my brother.' },
  { id: 'greeting', shouldRemember: false, text: 'Hi River, how are you?' },
  { id: 'transient-question', shouldRemember: false, text: 'What time is it in London right now?' },
  { id: 'memory-question', shouldRemember: false, text: 'What do you remember about me?' },
  { id: 'one-off-preference', shouldRemember: false, text: 'I had pasta for lunch today.' }
]

const timings = []
const percentile = (values, p) => {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)]
}
const request = async (path, options = {}) => {
  const startedAt = performance.now()
  let response
  try {
    response = await fetch(`${base}${path}`, options)
  } catch (error) {
    throw new Error(`${path} network failure: ${error.message}`)
  }
  const durationMs = Math.round(performance.now() - startedAt)
  const body = await response.json().catch(() => ({}))
  timings.push({ path, method: options.method || 'GET', status: response.status, duration_ms: durationMs })
  if (!response.ok) throw new Error(`${path} failed (${response.status}): ${body.error || 'unknown error'}`)
  return body
}
const accountHeaders = account => ({ Authorization: `Bearer ${account.token}`, 'content-type': 'application/json' })
const uniqueEmail = prefix => `${prefix}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}@river.local`
const signup = async (name, prefix) => request('/api/auth/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, email: uniqueEmail(prefix), password: 'memory-evaluation-password' }) })
const pauseForProvider = async () => { if (delayMs) await sleep(delayMs) }
const approvePending = async (result, headers) => Promise.all((result.proposals || []).map(proposal => request(`/api/memory/proposals/${proposal.id}/approve`, { method: 'POST', headers, body: '{}' })))

const outcomes = []
let executionError = null
try {
  for (const testCase of cases) {
    const account = await signup('Memory evaluation', `memory-eval-${testCase.id}`)
    const headers = accountHeaders(account)
    const thread = await request('/api/threads', { method: 'POST', headers, body: JSON.stringify({ title: `Evaluation: ${testCase.id}` }) })
    await pauseForProvider()
    const result = await request('/api/chat', { method: 'POST', headers, body: JSON.stringify({ thread_id: thread.thread.id, content: testCase.text }) })
    const remembered = Array.isArray(result.storylines) ? result.storylines : []
    const pending = Array.isArray(result.proposals) ? result.proposals : []
    const createdCount = remembered.length + pending.length
    outcomes.push({ ...testCase, remembered: remembered.length, proposed: pending.length, createdCount, detected: createdCount >= (testCase.minimumMemories || 1), provider: result.provider, topics: [...remembered, ...pending].map(memory => memory.topic) })
  }
} catch (error) {
  executionError = error.message
}

const totals = outcomes.reduce((metrics, outcome) => {
  if (outcome.shouldRemember && outcome.detected) metrics.truePositive += 1
  if (!outcome.shouldRemember && outcome.detected) metrics.falsePositive += 1
  if (outcome.shouldRemember && !outcome.detected) metrics.falseNegative += 1
  return metrics
}, { truePositive: 0, falsePositive: 0, falseNegative: 0 })
const precision = totals.truePositive / Math.max(1, totals.truePositive + totals.falsePositive)
const recall = totals.truePositive / Math.max(1, totals.truePositive + totals.falseNegative)
const f1 = (2 * precision * recall) / Math.max(0.0001, precision + recall)

let crossThreadRecall = { memory_created: false, answer: null, passed: false, skipped: Boolean(executionError) }
if (!executionError) {
  try {
    const account = await signup('Recall evaluation', 'memory-recall')
    const headers = accountHeaders(account)
    const firstThread = await request('/api/threads', { method: 'POST', headers, body: JSON.stringify({ title: 'First conversation' }) })
    const source = 'I am building a photo journal for my grandmother’s recipes and want to keep working on it this summer.'
    await pauseForProvider()
    const sourceResult = await request('/api/chat', { method: 'POST', headers, body: JSON.stringify({ thread_id: firstThread.thread.id, content: source }) })
    const sourceMemoryCreated = (sourceResult.storylines || []).length > 0 || (sourceResult.proposals || []).length > 0
    await approvePending(sourceResult, headers)
    const secondThread = await request('/api/threads', { method: 'POST', headers, body: JSON.stringify({ title: 'A new conversation' }) })
    await pauseForProvider()
    const recallResult = await request('/api/chat', { method: 'POST', headers, body: JSON.stringify({ thread_id: secondThread.thread.id, content: 'What do you remember from our previous conversation about my project?' }) })
    crossThreadRecall = { memory_created: sourceMemoryCreated, answer: recallResult.reply, passed: sourceMemoryCreated && /(photo journal|grandmother|recipe)/i.test(recallResult.reply || ''), skipped: false }
  } catch (error) {
    executionError = error.message
    crossThreadRecall = { ...crossThreadRecall, skipped: true }
  }
}

let crossThreadPreferenceRecall = { memories_created: false, answer: null, passed: false, skipped: Boolean(executionError) }
if (!executionError) {
  try {
    const account = await signup('Preference recall evaluation', 'memory-preference-recall')
    const headers = accountHeaders(account)
    const firstThread = await request('/api/threads', { method: 'POST', headers, body: JSON.stringify({ title: 'Interests' }) })
    const source = 'I play cricket most weekends, and I also enjoy chess with my brother.'
    await pauseForProvider()
    const sourceResult = await request('/api/chat', { method: 'POST', headers, body: JSON.stringify({ thread_id: firstThread.thread.id, content: source }) })
    await approvePending(sourceResult, headers)
    const approved = await request('/api/memory', { headers })
    const preferenceCount = (approved.storylines || []).filter(memory => memory.memory_kind === 'preference').length
    const secondThread = await request('/api/threads', { method: 'POST', headers, body: JSON.stringify({ title: 'Recall interests' }) })
    await pauseForProvider()
    const recallResult = await request('/api/chat', { method: 'POST', headers, body: JSON.stringify({ thread_id: secondThread.thread.id, content: 'Which games or hobbies do I play?' }) })
    crossThreadPreferenceRecall = { memories_created: preferenceCount >= 2, answer: recallResult.reply, passed: preferenceCount >= 2 && /cricket/i.test(recallResult.reply || '') && /chess/i.test(recallResult.reply || ''), skipped: false }
  } catch (error) {
    executionError = error.message
    crossThreadPreferenceRecall = { ...crossThreadPreferenceRecall, skipped: true }
  }
}

const durations = timings.map(item => item.duration_ms)
const report = {
  schema_version: 1,
  evaluated_at: new Date().toISOString(),
  base,
  configuration: { strict, delay_ms: delayMs, cases_expected: cases.length, provider: outcomes.find(outcome => outcome.provider)?.provider || null },
  completed: !executionError && outcomes.length === cases.length && !crossThreadRecall.skipped && !crossThreadPreferenceRecall.skipped,
  error: executionError,
  totals,
  precision,
  recall,
  f1,
  cross_thread_recall: crossThreadRecall,
  cross_thread_preference_recall: crossThreadPreferenceRecall,
  request_latency_ms: { count: durations.length, p50: percentile(durations, .5), p95: percentile(durations, .95), max: durations.length ? Math.max(...durations) : null },
  outcomes,
  requests: timings
}

if (reportPath) {
  const target = resolve(reportPath)
  await mkdir(dirname(target), { recursive: true })
  report.report_path = target
}
const serialized = `${JSON.stringify(report, null, 2)}\n`
if (report.report_path) await writeFile(report.report_path, serialized, 'utf8')
console.log(serialized)
if (strict && (!report.completed || precision < 0.8 || recall < 0.6 || !crossThreadRecall.passed || !crossThreadPreferenceRecall.passed)) process.exitCode = 1
