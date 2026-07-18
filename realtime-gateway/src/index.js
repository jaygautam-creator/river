const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
const encoder = new TextEncoder()

const fromBase64Url = value => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, char => char.charCodeAt(0))
}

async function verifyRiverJwt(token, secret) {
  const [encodedHeader, encodedPayload, encodedSignature] = String(token || '').split('.')
  if (!encodedHeader || !encodedPayload || !encodedSignature || !secret) return null
  try {
    const header = JSON.parse(new TextDecoder().decode(fromBase64Url(encodedHeader)))
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(encodedPayload)))
    if (header.alg !== 'HS256' || !payload.id || payload.purpose !== 'live_voice' || !payload.exp || payload.exp * 1000 <= Date.now()) return null
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
    const valid = await crypto.subtle.verify('HMAC', key, fromBase64Url(encodedSignature), encoder.encode(`${encodedHeader}.${encodedPayload}`))
    return valid ? payload : null
  } catch { return null }
}

const close = (socket, code, reason) => { try { socket.close(code, reason) } catch {} }

function allowedMessage(raw) {
  if (typeof raw !== 'string' || raw.length > 1_500_000) return false
  try {
    const message = JSON.parse(raw)
    // River creates the provider setup itself. A browser may submit only live
    // input/control messages, so it cannot override model, system policy, or tools.
    return Boolean(message.realtimeInput || message.toolResponse)
  } catch { return false }
}

function providerSetup(claims) {
  const memory = Array.isArray(claims.memory_context) && claims.memory_context.length
    ? `\n\nApproved River memory (use only when relevant; never invent beyond this):\n${claims.memory_context.map(item => `- ${item.topic}: ${item.summary}`).join('\n')}`
    : ''
  return JSON.stringify({
    setup: {
      model: 'models/gemini-3.1-flash-live-preview',
      responseModalities: ['AUDIO'],
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      thinkingConfig: { thinkingLevel: 'minimal' },
      realtimeInputConfig: { automaticActivityDetection: { endOfSpeechSensitivity: 'END_SENSITIVITY_HIGH', prefixPaddingMs: 180, silenceDurationMs: 700 } },
      systemInstruction: { parts: [{ text: `You are River, a warm, concise AI companion for ${claims.name || 'the user'}. Respect the user’s boundaries. Never claim memories you have not been given. If there is immediate danger, encourage emergency services and trusted human support.${memory}` }] }
    }
  })
}

export default {
  async fetch(request, env) {
    if (request.method === 'GET' && new URL(request.url).pathname === '/health') return json({ ok: true, service: 'river-realtime-gateway' })
    if (new URL(request.url).pathname !== '/live') return json({ error: 'Not found.' }, 404)
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return json({ error: 'Expected a WebSocket upgrade.' }, 426)
    if (env.ALLOWED_ORIGIN && request.headers.get('Origin') !== env.ALLOWED_ORIGIN) return json({ error: 'Origin is not allowed.' }, 403)
    const token = new URL(request.url).searchParams.get('access_token')
    const claims = await verifyRiverJwt(token, env.RIVER_JWT_SECRET)
    if (!claims) return json({ error: 'Unauthorized.' }, 401)
    if (!env.GEMINI_API_KEY) return json({ error: 'Gemini Live is not configured.' }, 503)

    const pair = new WebSocketPair()
    const [client, browser] = Object.values(pair)
    browser.accept()
    const provider = new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`)
    let providerOpen = false
    const queued = []
    const sendProvider = message => providerOpen ? provider.send(message) : queued.push(message)

    provider.addEventListener('open', () => {
      providerOpen = true
      provider.send(providerSetup(claims))
      for (const message of queued.splice(0)) provider.send(message)
      browser.send(JSON.stringify({ type: 'session.ready', user_id: claims.id }))
    })
    provider.addEventListener('message', event => browser.send(event.data))
    provider.addEventListener('error', () => { browser.send(JSON.stringify({ type: 'error', code: 'provider_unavailable' })); close(browser, 1011, 'Provider unavailable') })
    provider.addEventListener('close', () => close(browser, 1000, 'Provider session closed'))
    browser.addEventListener('message', event => {
      if (!allowedMessage(event.data)) return close(browser, 1008, 'Unsupported live message')
      sendProvider(event.data)
    })
    browser.addEventListener('close', () => close(provider, 1000, 'Browser disconnected'))
    return new Response(null, { status: 101, webSocket: client })
  }
}
