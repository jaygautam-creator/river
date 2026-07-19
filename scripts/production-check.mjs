const baseUrl = (process.env.BASE_URL || '').replace(/\/$/, '')
const voiceGatewayUrl = (process.env.VOICE_GATEWAY_URL || '').replace(/^wss:/, 'https:').replace(/\/$/, '')

if (!baseUrl) throw new Error('BASE_URL is required, for example https://river.example')

const readJson = async (url, label) => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${label} failed with HTTP ${response.status}`)
  return response.json()
}

const health = await readJson(`${baseUrl}/api/health`, 'Application health check')
if (!health.ok || health.service !== 'river') throw new Error('Application health response was invalid')

const readiness = await readJson(`${baseUrl}/api/readiness`, 'Application readiness check')
if (!readiness.ready) throw new Error('Application is not ready')

const requiredChecks = ['database', 'jwt_secret', 'field_encryption', 'model']
const missingChecks = requiredChecks.filter(check => !readiness.checks?.[check])
if (missingChecks.length) throw new Error(`Required readiness checks failed: ${missingChecks.join(', ')}`)

if (process.env.REQUIRE_TURNSTILE === 'true' && !readiness.checks?.turnstile) {
  throw new Error('Turnstile is required for this release but is not configured.')
}

if (voiceGatewayUrl) {
  const gateway = await readJson(`${voiceGatewayUrl}/health`, 'Live voice gateway health check')
  if (!gateway.ok) throw new Error('Live voice gateway reported unhealthy')
}

console.log(JSON.stringify({
  ok: true,
  application: baseUrl,
  provider: health.provider,
  readiness: readiness.checks,
  voice_gateway_checked: Boolean(voiceGatewayUrl),
}, null, 2))
