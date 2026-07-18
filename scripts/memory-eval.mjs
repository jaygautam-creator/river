const base = process.env.BASE_URL || 'http://127.0.0.1:8787'
const strict = process.argv.includes('--strict')

// These cases are deliberately small and human-readable. They measure whether River
// proposes an approval-gated memory, not whether a provider produces a certain reply.
const cases = [
  { id: 'enduring-project', shouldPropose: true, text: 'I am building a photo journal for my grandmother’s recipes and want to keep working on it this summer.' },
  { id: 'relationship-concern', shouldPropose: true, text: 'I have been feeling hurt and uncertain because my close friends say I can come across as distant.' },
  { id: 'upcoming-plan', shouldPropose: true, text: 'I want to plan a two-week trip to Lisbon in late summer, but I do not want every day scheduled.' },
  { id: 'recurring-wellbeing', shouldPropose: true, text: 'I keep losing sleep before work presentations, and I want to find a steadier routine.' },
  { id: 'greeting', shouldPropose: false, text: 'Hi River, how are you?' },
  { id: 'transient-question', shouldPropose: false, text: 'What time is it in London right now?' },
  { id: 'memory-question', shouldPropose: false, text: 'What do you remember about me?' },
  { id: 'one-off-preference', shouldPropose: false, text: 'I had pasta for lunch today.' }
]

const request = async (path, options = {}) => {
  const response = await fetch(`${base}${path}`, options)
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`${path} failed (${response.status}): ${body.error || 'unknown error'}`)
  return body
}

const outcomes = []
for (const testCase of cases) {
  const email = `memory-eval-${testCase.id}-${Date.now()}-${Math.random().toString(16).slice(2)}@river.local`
  const account = await request('/api/auth/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Memory evaluation', email, password: 'memory-evaluation-password' }) })
  const headers = { Authorization: `Bearer ${account.token}`, 'content-type': 'application/json' }
  const thread = await request('/api/threads', { method: 'POST', headers, body: JSON.stringify({ title: `Evaluation: ${testCase.id}` }) })
  const result = await request('/api/chat', { method: 'POST', headers, body: JSON.stringify({ thread_id: thread.thread.id, content: testCase.text }) })
  const proposed = Boolean(result.proposal?.id)
  outcomes.push({ ...testCase, proposed, provider: result.provider, topic: result.proposal?.topic || null })
}

const totals = outcomes.reduce((metrics, outcome) => {
  if (outcome.shouldPropose && outcome.proposed) metrics.truePositive += 1
  if (!outcome.shouldPropose && outcome.proposed) metrics.falsePositive += 1
  if (outcome.shouldPropose && !outcome.proposed) metrics.falseNegative += 1
  return metrics
}, { truePositive: 0, falsePositive: 0, falseNegative: 0 })
const precision = totals.truePositive / Math.max(1, totals.truePositive + totals.falsePositive)
const recall = totals.truePositive / Math.max(1, totals.truePositive + totals.falseNegative)
const f1 = (2 * precision * recall) / Math.max(0.0001, precision + recall)

// Cross-thread recall is tested separately from proposal extraction. River may only
// retrieve an approved summary, never raw conversation history from another thread.
const recallEmail = `memory-recall-${Date.now()}-${Math.random().toString(16).slice(2)}@river.local`
const recallAccount = await request('/api/auth/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Recall evaluation', email: recallEmail, password: 'memory-evaluation-password' }) })
const recallHeaders = { Authorization: `Bearer ${recallAccount.token}`, 'content-type': 'application/json' }
const firstThread = await request('/api/threads', { method: 'POST', headers: recallHeaders, body: JSON.stringify({ title: 'First conversation' }) })
const source = 'I am building a photo journal for my grandmother’s recipes and want to keep working on it this summer.'
const sourceResult = await request('/api/chat', { method: 'POST', headers: recallHeaders, body: JSON.stringify({ thread_id: firstThread.thread.id, content: source }) })
if (sourceResult.proposal?.id) await request(`/api/memory/proposals/${sourceResult.proposal.id}/approve`, { method: 'POST', headers: recallHeaders, body: '{}' })
const secondThread = await request('/api/threads', { method: 'POST', headers: recallHeaders, body: JSON.stringify({ title: 'A new conversation' }) })
const recallResult = await request('/api/chat', { method: 'POST', headers: recallHeaders, body: JSON.stringify({ thread_id: secondThread.thread.id, content: 'What do you remember from our previous conversation about my project?' }) })
const crossThreadRecall = {
  proposal_created: Boolean(sourceResult.proposal?.id),
  answer: recallResult.reply,
  passed: Boolean(sourceResult.proposal?.id) && /(photo journal|grandmother|recipe)/i.test(recallResult.reply || '')
}

const report = { evaluated_at: new Date().toISOString(), base, totals, precision, recall, f1, cross_thread_recall: crossThreadRecall, outcomes }

console.log(JSON.stringify(report, null, 2))
if (strict && (precision < 0.8 || recall < 0.6 || !crossThreadRecall.passed)) process.exitCode = 1
