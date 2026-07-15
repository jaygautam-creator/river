const base = process.env.BASE_URL || 'http://127.0.0.1:8787'

const response = await fetch(`${base}/api/health`)
if (!response.ok) throw new Error(`Health check failed: ${response.status}`)
const health = await response.json()
if (!health.ok || health.service !== 'river') throw new Error(`Unexpected health payload: ${JSON.stringify(health)}`)

const page = await fetch(base)
if (!page.ok) throw new Error(`App shell failed: ${page.status}`)
const html = await page.text()
if (!html.includes('River')) throw new Error('App shell does not contain River branding')

console.log(`River smoke test passed (${health.model})`)

const email = `smoke-${Date.now()}@river.local`
const signup = await fetch(`${base}/api/auth/signup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'River Smoke', email, password: 'smoke-password-123' }) })
if (!signup.ok) throw new Error(`Signup failed: ${signup.status}`)
const session = await signup.json()
const authHeaders = { Authorization: `Bearer ${session.token}` }
const preferences = await fetch(`${base}/api/privacy/preferences`, { headers: authHeaders })
if (!preferences.ok) throw new Error(`Privacy preferences failed: ${preferences.status}`)
const exported = await fetch(`${base}/api/privacy/export`, { headers: authHeaders })
if (!exported.ok) throw new Error(`Privacy export failed: ${exported.status}`)
const refreshed = await fetch(`${base}/api/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refresh_token: session.refresh_token }) })
if (!refreshed.ok) throw new Error(`Refresh failed: ${refreshed.status}`)
const chat = await fetch(`${base}/api/chat`, { method: 'POST', headers: { ...authHeaders, 'content-type': 'application/json' }, body: JSON.stringify({ content: 'I am thinking about planning a two-week Lisbon trip for late summer with a tiny notebook.' }) })
if (!chat.ok) throw new Error(`Chat failed: ${chat.status}`)
const chatData = await chat.json()
if (!chatData.proposal?.id || chatData.proposal.status !== 'pending') throw new Error('Memory proposal was not created')
const approved = await fetch(`${base}/api/memory/proposals/${chatData.proposal.id}/approve`, { method: 'POST', headers: authHeaders })
if (!approved.ok) throw new Error(`Proposal approval failed: ${approved.status}`)
const approvedData = await approved.json()
if (!approvedData.storyline?.topic) throw new Error('Approved proposal did not create a storyline')
console.log('Authentication and privacy lifecycle smoke test passed')
