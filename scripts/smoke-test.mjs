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
