import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'
import * as OTPAuth from 'otpauth'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 8787
const JWT_SECRET = process.env.JWT_SECRET || 'kindred-local-demo-secret'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5'
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3-flash-preview'
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
const GROQ_TRANSCRIPTION_MODEL = process.env.GROQ_TRANSCRIPTION_MODEL || 'whisper-large-v3-turbo'
const GROQ_SPEECH_MODEL = process.env.GROQ_SPEECH_MODEL || 'canopylabs/orpheus-v1-english'
const REALTIME_MODEL = process.env.REALTIME_MODEL || 'gpt-realtime'
const allowedOrigin = process.env.APP_ORIGIN || `http://127.0.0.1:${PORT}`
const RETENTION_DAYS = Math.max(30, Number(process.env.RETENTION_DAYS || 365))
const isProduction = process.env.NODE_ENV === 'production'
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) throw new Error('JWT_SECRET must be configured in production.')
if (process.env.NODE_ENV === 'production' && !process.env.FIELD_ENCRYPTION_KEY) throw new Error('FIELD_ENCRYPTION_KEY must be configured in production.')
const fieldKey = crypto.createHash('sha256').update(process.env.FIELD_ENCRYPTION_KEY || JWT_SECRET).digest()
const db = new Database(process.env.DATABASE_PATH || path.join(__dirname, 'kindred.db'))
db.pragma('journal_mode = WAL')
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL DEFAULT 'Today',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS storylines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    topic TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'resolved', 'stale')),
    summary TEXT NOT NULL,
    source_quotes TEXT NOT NULL DEFAULT '[]',
    first_mentioned_at TEXT NOT NULL,
    last_updated_at TEXT NOT NULL,
    follow_up_due TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS audit_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    event TEXT NOT NULL,
    request_id TEXT,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
  );
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    window_started_at INTEGER NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS memory_proposals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    topic TEXT NOT NULL,
    summary TEXT NOT NULL,
    source_quote TEXT NOT NULL,
    confidence REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`)

const userColumns = db.prepare('PRAGMA table_info(users)').all().map(column => column.name)
if (!userColumns.includes('memory_enabled')) db.exec('ALTER TABLE users ADD COLUMN memory_enabled INTEGER NOT NULL DEFAULT 1')
if (!userColumns.includes('mfa_secret')) db.exec('ALTER TABLE users ADD COLUMN mfa_secret TEXT')
if (!userColumns.includes('mfa_enabled_at')) db.exec('ALTER TABLE users ADD COLUMN mfa_enabled_at TEXT')
const messageColumns = db.prepare('PRAGMA table_info(messages)').all().map(column => column.name)
if (!messageColumns.includes('thread_id')) db.exec('ALTER TABLE messages ADD COLUMN thread_id INTEGER REFERENCES threads(id) ON DELETE CASCADE')
const refreshColumns = db.prepare('PRAGMA table_info(refresh_tokens)').all().map(column => column.name)
if (!refreshColumns.includes('user_agent')) db.exec('ALTER TABLE refresh_tokens ADD COLUMN user_agent TEXT')
if (!refreshColumns.includes('ip_address')) db.exec('ALTER TABLE refresh_tokens ADD COLUMN ip_address TEXT')

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', 1)
app.use(cors({ origin: allowedOrigin, credentials: true }))
app.use(express.json({ limit: '32kb' }))
app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID()
  req.requestId = String(requestId).slice(0, 120)
  res.setHeader('X-Request-ID', req.requestId)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=(self)')
  if (isProduction) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  next()
})
app.use((req, res, next) => {
  if (isProduction && process.env.ENFORCE_HTTPS !== 'false' && req.path.startsWith('/api') && !req.secure) return res.status(400).json({ error: 'HTTPS is required.' })
  next()
})

app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) return next()
  const key = req.ip || 'unknown'
  const minute = Math.floor(Date.now() / 60_000) * 60_000
  const current = db.prepare('SELECT * FROM rate_limits WHERE key = ?').get(key)
  if (!current || current.window_started_at !== minute) db.prepare('INSERT INTO rate_limits (key, window_started_at, request_count) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET window_started_at = excluded.window_started_at, request_count = 1').run(key, minute)
  else if (current.request_count >= 120) return res.status(429).json({ error: 'Too many requests. Please try again shortly.' })
  else db.prepare('UPDATE rate_limits SET request_count = request_count + 1 WHERE key = ?').run(key)
  next()
})

const now = () => new Date().toISOString()
const audit = (req, event, metadata = {}) => db.prepare('INSERT INTO audit_events (user_id, event, request_id, metadata) VALUES (?, ?, ?, ?)').run(req.user?.id || null, event, req.requestId, JSON.stringify(metadata))
const tokenFor = (user) => jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '30d' })
const publicUser = (user) => ({ id: user.id, name: user.name, email: user.email, mfa_enabled: Boolean(user.mfa_enabled_at) })
const readCookie = (req, name) => String(req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1)
const cookieOptions = (httpOnly = true) => ({ httpOnly, secure: isProduction, sameSite: 'lax', path: '/', maxAge: 1000 * 60 * 60 * 24 * 30 })
const setSessionCookies = (res, token, refreshToken) => {
  const csrfToken = crypto.randomBytes(32).toString('base64url')
  res.cookie('river_access', token, cookieOptions(true))
  res.cookie('river_refresh', refreshToken, cookieOptions(true))
  res.cookie('river_csrf', csrfToken, cookieOptions(false))
}
const clearSessionCookies = res => ['river_access', 'river_refresh', 'river_csrf'].forEach(name => res.clearCookie(name, { httpOnly: name !== 'river_csrf', secure: isProduction, sameSite: 'lax', path: '/' }))
app.use((req, res, next) => {
  if (!req.path.startsWith('/api') || ['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  const cookieSession = readCookie(req, 'river_access') || readCookie(req, 'river_refresh')
  const exempt = ['/api/auth/signup', '/api/auth/login', '/api/auth/password-reset/request', '/api/auth/password-reset/complete']
  if (!cookieSession || exempt.includes(req.path)) return next()
  const cookieToken = readCookie(req, 'river_csrf') || ''
  const headerToken = String(req.headers['x-csrf-token'] || '')
  if (!cookieToken || cookieToken.length !== headerToken.length || !crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))) return res.status(403).json({ error: 'Your session could not be verified. Refresh and try again.' })
  next()
})
function ensureThread(userId, threadId = null) {
  if (threadId) {
    const existing = db.prepare('SELECT * FROM threads WHERE id = ? AND user_id = ?').get(threadId, userId)
    if (existing) return existing
  }
  let thread = db.prepare('SELECT * FROM threads WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1').get(userId)
  if (!thread) {
    const result = db.prepare('INSERT INTO threads (user_id, title) VALUES (?, ?)').run(userId, 'Today')
    thread = db.prepare('SELECT * FROM threads WHERE id = ?').get(result.lastInsertRowid)
  }
  return thread
}
const hashToken = token => crypto.createHash('sha256').update(token).digest('hex')
async function sendTransactionalEmail({ to, subject, text }) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return false
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text }) })
  if (!response.ok) throw new Error(`Email provider failed (${response.status}).`)
  return true
}
const issueRefreshToken = (userId, req) => {
  const token = crypto.randomBytes(48).toString('base64url')
  db.prepare('INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_address) VALUES (?, ?, ?, ?, ?)').run(userId, hashToken(token), new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(), String(req?.headers['user-agent'] || '').slice(0, 240), String(req?.ip || '').slice(0, 64))
  return token
}
const respondSession = (res, user, req) => {
  const token = tokenFor(user)
  const refreshToken = issueRefreshToken(user.id, req)
  setSessionCookies(res, token, refreshToken)
  res.json({ token, refresh_token: refreshToken, user: publicUser(user) })
}
const encryptField = value => { const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', fieldKey, iv); const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]); return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}` }
const decryptField = value => { const [iv, tag, ciphertext] = String(value || '').split('.').map(x => Buffer.from(x, 'base64url')); const decipher = crypto.createDecipheriv('aes-256-gcm', fieldKey, iv); decipher.setAuthTag(tag); return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8') }
const verifyMfa = (user, token) => { try { if (!user?.mfa_secret || !/^\d{6}$/.test(String(token || ''))) return false; return new OTPAuth.TOTP({ issuer: 'River', label: user.email, secret: OTPAuth.Secret.fromBase32(decryptField(user.mfa_secret)), algorithm: 'SHA1', digits: 6, period: 30 }).validate({ token: String(token), window: 1 }) !== null } catch { return false } }
const revokeRefreshToken = token => db.prepare('UPDATE refresh_tokens SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL').run(now(), hashToken(token))
const runRetentionCleanup = () => {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  db.transaction(() => {
    db.prepare('DELETE FROM audit_events WHERE created_at < ?').run(cutoff)
    db.prepare('DELETE FROM refresh_tokens WHERE expires_at < ? OR revoked_at < ?').run(now(), cutoff)
    db.prepare('DELETE FROM password_reset_tokens WHERE expires_at < ? OR used_at < ?').run(now(), cutoff)
    db.prepare('DELETE FROM rate_limits WHERE window_started_at < ?').run(Date.now() - 120_000)
  })()
}
runRetentionCleanup()
setInterval(runRetentionCleanup, 24 * 60 * 60 * 1000).unref()

function auth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : readCookie(req, 'river_access')
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch { res.status(401).json({ error: 'Please sign in again.' }) }
}

function getStorylines(userId) {
  return db.prepare("SELECT * FROM storylines WHERE user_id = ? ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'stale' THEN 1 ELSE 2 END, last_updated_at DESC").all(userId).map(parseStoryline)
}
function parseStoryline(row) { return { ...row, source_quotes: JSON.parse(row.source_quotes || '[]') } }
function getProposals(userId) { return db.prepare("SELECT * FROM memory_proposals WHERE user_id = ? AND status = 'pending' ORDER BY created_at DESC").all(userId) }

const memoryRules = [
  { match: ['lisbon'], topic: 'The Lisbon idea', summary: 'You are planning a two-week Lisbon trip for late summer, with a tiny notebook and no over-planned itinerary.' },
  { match: ['work', 'job', 'interview', 'client', 'promotion'], topic: 'Work & direction', summary: 'Navigating a work decision or professional next step.' },
  { match: ['friend', 'partner', 'date', 'relationship', 'someone important'], topic: 'People on your mind', summary: 'Something is unfolding with someone important.' },
  { match: ['trip', 'travel', 'visit', 'flight', 'weekend away'], topic: 'A trip to look forward to', summary: 'Making plans for a trip or time away.' },
  { match: ['sleep', 'tired', 'energy', 'morning', 'routine'], topic: 'Energy & routine', summary: 'Trying to find a steadier rhythm and protect your energy.' },
  { match: ['learn', 'build', 'project', 'idea', 'write', 'creative'], topic: 'The thing you are making', summary: 'A personal project or idea you want to keep moving.' }
]
function detectMemoryProposal(content) {
  const lower = content.toLowerCase()
  const rule = memoryRules.find(r => r.match.some(word => lower.includes(word)))
  if (!rule || content.length < 45) return null
  return { ...rule, source_quote: content, confidence: 0.82 }
}

// A deterministic local extractor keeps the product fully demoable without an API key.
// If OPENAI_API_KEY is configured, this is the seam to replace with a structured extractor.
function extractStoryline(userId, content) {
  const lower = content.toLowerCase()
  const rule = memoryRules.find(r => r.match.some(word => lower.includes(word)))
  if (!rule && content.length < 45) return null
  const existing = db.prepare("SELECT * FROM storylines WHERE user_id = ? AND status != 'resolved' ORDER BY last_updated_at DESC").all(userId)
  const match = rule ? existing.find(s => s.topic === rule.topic) : null
  const stamp = now()
  if (match) {
    const quotes = JSON.parse(match.source_quotes || '[]')
    if (!quotes.includes(content)) quotes.push(content)
    db.prepare("UPDATE storylines SET summary = ?, source_quotes = ?, status = 'open', last_updated_at = ?, follow_up_due = ? WHERE id = ?")
      .run(rule.summary, JSON.stringify(quotes.slice(-4)), stamp, new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(), match.id)
    return parseStoryline(db.prepare('SELECT * FROM storylines WHERE id = ?').get(match.id))
  }
  if (!rule) return null
  const result = db.prepare('INSERT INTO storylines (user_id, topic, summary, source_quotes, first_mentioned_at, last_updated_at, follow_up_due) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(userId, rule.topic, rule.summary, JSON.stringify([content]), stamp, stamp, new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString())
  return parseStoryline(db.prepare('SELECT * FROM storylines WHERE id = ?').get(result.lastInsertRowid))
}

function relevantStorylines(userId, content) {
  const all = getStorylines(userId)
  const words = new Set(content.toLowerCase().split(/\W+/).filter(w => w.length > 3))
  const scored = all.map(s => ({ s, score: [...words].filter(w => `${s.topic} ${s.summary}`.toLowerCase().includes(w)).length + (s.status === 'open' ? 1 : 0) }))
  return scored.sort((a, b) => b.score - a.score).slice(0, 3).map(x => x.s)
}

function generateLocalReply(content, storylines, userName) {
  const lower = content.toLowerCase()
  if (/(kill myself|hurt myself|end my life|suicide|self harm)/i.test(content)) {
    return `I’m really glad you said that out loud. I can stay with you here, but I can’t be the only support for something this heavy. If you might act on these thoughts, call emergency services now; in the US or Canada call or text 988, and elsewhere use findahelpline.com. Can you move somewhere you’re not alone and tell me who could be with you right now?`
  }
  const focus = storylines.find(s => s.status === 'open')
  if (lower.includes('hello') || lower.includes('hi ') || lower === 'hi') return focus ? `Hey ${userName.split(' ')[0]}. Last time, you were carrying ${focus.summary.toLowerCase()} How has that moved since we talked?` : `Hey ${userName.split(' ')[0]}. What’s on your mind today?`
  if (lower.includes('good') || lower.includes('great') || lower.includes('excited')) return focus ? `That’s good to hear. It sounds like ${focus.topic.toLowerCase()} may be finding a little momentum too — is that connected, or is this a separate win?` : `I like the sound of that. What part of it feels best right now?`
  if (lower.includes('bad') || lower.includes('hard') || lower.includes('stressed') || lower.includes('overwhelm')) return focus ? `That sounds like a lot to hold at once. With ${focus.topic.toLowerCase()} already in the background, what’s the sharpest part of today?` : `That sounds like a lot to hold. What’s the sharpest part of today?`
  if (focus) return `I’m with you. ${focus.topic} is still in the thread here, so we don’t have to start from zero. What feels most important about this today?`
  return `I’m here with you. Say a little more — what’s the part you keep coming back to?`
}

async function generateReply(content, storylines, userName) {
  const context = storylines.length ? `Known storylines:\n${storylines.map(s => `- ${s.topic}: ${s.summary}`).join('\n')}` : 'No storylines are known yet.'
  const systemPrompt = `You are River, a warm, grounded AI companion for ${userName}. Keep replies concise, human, and emotionally attentive. Use ongoing storylines when relevant, but never invent memories. Do not present yourself as a therapist. If the user may be in immediate danger, encourage emergency services and trusted human support.\n\n${context}`
  if (process.env.GROQ_API_KEY) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({ model: GROQ_MODEL, messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content }
      ], temperature: 0.7, max_completion_tokens: 280 })
    })
    if (!response.ok) throw new Error(`Groq request failed (${response.status}).`)
    const data = await response.json()
    const text = data.choices?.[0]?.message?.content?.trim()
    if (!text) throw new Error('Groq returned an empty response.')
    return text
  }
  if (process.env.GEMINI_API_KEY) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({ systemInstruction: { parts: [{ text: systemPrompt }] }, contents: [{ role: 'user', parts: [{ text: content }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 280 } })
    })
    if (!response.ok) throw new Error(`Gemini request failed (${response.status}).`)
    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim()
    if (!text) throw new Error('Gemini returned an empty response.')
    return text
  }
  if (!process.env.OPENAI_API_KEY) return generateLocalReply(content, storylines, userName)
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OPENAI_MODEL, input: [
      { role: 'system', content: [{ type: 'input_text', text: systemPrompt }] },
      { role: 'user', content: [{ type: 'input_text', text: content }] }
    ], max_output_tokens: 220 })
  })
  if (!response.ok) throw new Error(`Model request failed (${response.status}).`)
  const data = await response.json()
  const text = data.output?.flatMap(item => item.content || []).find(item => item.type === 'output_text')?.text?.trim()
  if (!text) throw new Error('Model returned an empty response.')
  return text
}

function configuredModelProvider() {
  if (process.env.GROQ_API_KEY) return 'groq'
  if (process.env.GEMINI_API_KEY) return 'gemini'
  if (process.env.OPENAI_API_KEY) return 'openai'
  return 'local-fallback'
}

app.post('/api/auth/signup', (req, res) => {
  const { name, email, password } = req.body || {}
  if (!name || !email || !password || password.length < 6) return res.status(400).json({ error: 'Name, email, and a 6+ character password are required.' })
  try {
    const result = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(name.trim(), email.toLowerCase().trim(), bcrypt.hashSync(password, 10))
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid)
    ensureThread(user.id)
    audit(req, 'auth.signup')
    respondSession(res, user, req)
  } catch { res.status(409).json({ error: 'An account with that email already exists.' }) }
})

app.post('/api/auth/login', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get((req.body.email || '').toLowerCase().trim())
  if (!user || !bcrypt.compareSync(req.body.password || '', user.password_hash)) return res.status(401).json({ error: 'That email and password don’t match.' })
  if (user.mfa_enabled_at && !verifyMfa(user, req.body?.otp)) return res.status(401).json({ error: 'Enter the current code from your authenticator app.', mfa_required: true })
  audit(req, 'auth.login')
  respondSession(res, user, req)
})
app.post('/api/auth/refresh', (req, res) => {
  const supplied = String(req.body?.refresh_token || readCookie(req, 'river_refresh') || '')
  const row = db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?').get(hashToken(supplied), now())
  if (!row) return res.status(401).json({ error: 'Refresh token is invalid or expired.' })
  revokeRefreshToken(supplied)
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id)
  audit(req, 'auth.refresh')
  respondSession(res, user, req)
})
app.post('/api/auth/logout', auth, (req, res) => {
  const supplied = String(req.body?.refresh_token || readCookie(req, 'river_refresh') || '')
  if (supplied) revokeRefreshToken(supplied)
  clearSessionCookies(res)
  audit(req, 'auth.logout')
  res.json({ ok: true })
})
app.get('/api/auth/sessions', auth, (req, res) => {
  const sessions = db.prepare('SELECT id, created_at, expires_at, revoked_at, user_agent, ip_address FROM refresh_tokens WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id)
  res.json({ sessions })
})
app.delete('/api/auth/sessions/:id', auth, (req, res) => {
  const result = db.prepare('UPDATE refresh_tokens SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL').run(now(), req.params.id, req.user.id)
  if (!result.changes) return res.status(404).json({ error: 'Active session not found.' })
  audit(req, 'auth.session_revoked', { session_id: Number(req.params.id) })
  res.json({ ok: true })
})
app.post('/api/auth/mfa/setup', auth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
  if (user.mfa_enabled_at) return res.status(409).json({ error: 'Multi-factor authentication is already enabled.' })
  const secret = new OTPAuth.Secret({ size: 20 }).base32
  const totp = new OTPAuth.TOTP({ issuer: 'River', label: user.email, secret: OTPAuth.Secret.fromBase32(secret), algorithm: 'SHA1', digits: 6, period: 30 })
  db.prepare('UPDATE users SET mfa_secret = ? WHERE id = ?').run(encryptField(secret), user.id)
  audit(req, 'auth.mfa_setup_started')
  res.json({ secret, otpauth_url: totp.toString() })
})
app.post('/api/auth/mfa/enable', auth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
  if (!user?.mfa_secret || !verifyMfa(user, req.body?.otp)) return res.status(400).json({ error: 'Enter a valid authenticator code to enable MFA.' })
  db.prepare('UPDATE users SET mfa_enabled_at = ? WHERE id = ?').run(now(), user.id)
  audit(req, 'auth.mfa_enabled')
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)) })
})
app.post('/api/auth/mfa/disable', auth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
  if (!verifyMfa(user, req.body?.otp)) return res.status(400).json({ error: 'Enter a valid authenticator code to disable MFA.' })
  db.prepare('UPDATE users SET mfa_secret = NULL, mfa_enabled_at = NULL WHERE id = ?').run(user.id)
  audit(req, 'auth.mfa_disabled')
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)) })
})
app.post('/api/auth/password-reset/request', async (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim()
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (user) {
    const raw = crypto.randomBytes(32).toString('base64url')
    db.prepare('INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)').run(user.id, hashToken(raw), new Date(Date.now() + 1000 * 60 * 30).toISOString())
    audit(req, 'auth.password_reset_requested')
    const resetUrl = `${allowedOrigin}/?reset_token=${encodeURIComponent(raw)}`
    try {
      const delivered = await sendTransactionalEmail({ to: email, subject: 'Reset your River password', text: `Use this link within 30 minutes to reset your River password: ${resetUrl}` })
      if (!delivered && process.env.NODE_ENV !== 'production') console.info(`Password reset token for user ${user.id}: ${raw}`)
    } catch (error) { console.error(`Password reset email failed: ${error.message}`) }
  }
  res.json({ message: 'If an account exists for that email, recovery instructions will be sent.' })
})
app.post('/api/auth/password-reset/complete', (req, res) => {
  const token = String(req.body?.token || '')
  const password = String(req.body?.password || '')
  if (password.length < 12) return res.status(400).json({ error: 'Password must be at least 12 characters.' })
  const row = db.prepare('SELECT * FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?').get(hashToken(token), now())
  if (!row) return res.status(400).json({ error: 'Recovery token is invalid or expired.' })
  db.transaction(() => {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 12), row.user_id)
    db.prepare('UPDATE password_reset_tokens SET used_at = ? WHERE id = ?').run(now(), row.id)
    db.prepare('UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').run(now(), row.user_id)
  })()
  audit(req, 'auth.password_reset_completed')
  res.json({ ok: true })
})
app.get('/api/auth/me', auth, (req, res) => res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) }))

app.get('/api/privacy/preferences', auth, (req, res) => {
  const user = db.prepare('SELECT memory_enabled FROM users WHERE id = ?').get(req.user.id)
  res.json({ memory_enabled: Boolean(user?.memory_enabled), retention_days: 365 })
})
app.put('/api/privacy/preferences', auth, (req, res) => {
  if (typeof req.body?.memory_enabled !== 'boolean') return res.status(400).json({ error: 'memory_enabled must be boolean.' })
  db.prepare('UPDATE users SET memory_enabled = ? WHERE id = ?').run(req.body.memory_enabled ? 1 : 0, req.user.id)
  audit(req, 'privacy.memory_preference', { enabled: req.body.memory_enabled })
  res.json({ memory_enabled: req.body.memory_enabled })
})
app.get('/api/privacy/export', auth, (req, res) => {
  const user = db.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?').get(req.user.id)
  const messages = db.prepare('SELECT role, content, created_at FROM messages WHERE user_id = ? ORDER BY id ASC').all(req.user.id)
  const storylines = getStorylines(req.user.id)
  audit(req, 'privacy.export')
  res.json({ exported_at: now(), user, messages, storylines })
})
app.delete('/api/privacy/account', auth, (req, res) => {
  const password = String(req.body?.password || '')
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
  if (!user || !bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Password confirmation failed.' })
  db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id)
  res.json({ ok: true })
})
app.get('/api/health', (req, res) => res.json({ ok: true, service: 'river', provider: configuredModelProvider(), model: process.env.GROQ_API_KEY ? GROQ_MODEL : process.env.GEMINI_API_KEY ? GEMINI_MODEL : process.env.OPENAI_API_KEY ? OPENAI_MODEL : 'local-fallback' }))
app.get('/api/readiness', (req, res) => {
  const checks = { database: Boolean(db.open), jwt_secret: process.env.NODE_ENV !== 'production' || Boolean(process.env.JWT_SECRET), model_fallback: true }
  const ready = Object.values(checks).every(Boolean)
  res.status(ready ? 200 : 503).json({ ready, checks })
})
app.get('/api/metrics', auth, (req, res) => {
  const messages = db.prepare('SELECT COUNT(*) AS count FROM messages WHERE user_id = ?').get(req.user.id).count
  const memories = db.prepare('SELECT COUNT(*) AS count FROM storylines WHERE user_id = ?').get(req.user.id).count
  const proposals = db.prepare("SELECT COUNT(*) AS count FROM memory_proposals WHERE user_id = ? AND status = 'pending'").get(req.user.id).count
  res.json({ messages, memories, pending_proposals: proposals })
})

app.get('/api/conversation', auth, (req, res) => {
  const thread = ensureThread(req.user.id, req.query.thread_id)
  db.prepare('UPDATE messages SET thread_id = ? WHERE user_id = ? AND thread_id IS NULL').run(thread.id, req.user.id)
  const messages = db.prepare('SELECT id, role, content, created_at FROM messages WHERE user_id = ? AND thread_id = ? ORDER BY id ASC').all(req.user.id, thread.id)
  res.json({ messages, storylines: getStorylines(req.user.id), proposals: getProposals(req.user.id) })
})
app.get('/api/threads', auth, (req, res) => res.json({ threads: db.prepare('SELECT id, title, created_at, updated_at FROM threads WHERE user_id = ? ORDER BY updated_at DESC').all(req.user.id) }))
app.post('/api/threads', auth, (req, res) => {
  const title = String(req.body?.title || 'New thread').trim().slice(0, 80) || 'New thread'
  const result = db.prepare('INSERT INTO threads (user_id, title) VALUES (?, ?)').run(req.user.id, title)
  audit(req, 'thread.create', { thread_id: result.lastInsertRowid })
  res.json({ thread: db.prepare('SELECT id, title, created_at, updated_at FROM threads WHERE id = ?').get(result.lastInsertRowid) })
})
app.patch('/api/threads/:id', auth, (req, res) => {
  const title = String(req.body?.title || '').trim().slice(0, 80)
  if (!title) return res.status(400).json({ error: 'Thread title is required.' })
  const result = db.prepare('UPDATE threads SET title = ?, updated_at = ? WHERE id = ? AND user_id = ?').run(title, now(), req.params.id, req.user.id)
  if (!result.changes) return res.status(404).json({ error: 'Thread not found.' })
  res.json({ thread: db.prepare('SELECT id, title, created_at, updated_at FROM threads WHERE id = ?').get(req.params.id) })
})
app.delete('/api/threads/:id', auth, (req, res) => {
  const count = db.prepare('SELECT COUNT(*) AS count FROM threads WHERE user_id = ?').get(req.user.id).count
  if (count <= 1) return res.status(400).json({ error: 'A user must keep at least one thread.' })
  const result = db.prepare('DELETE FROM threads WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id)
  if (!result.changes) return res.status(404).json({ error: 'Thread not found.' })
  res.json({ ok: true })
})
app.get('/api/search', auth, (req, res) => {
  const query = String(req.query.q || '').trim()
  if (query.length < 2) return res.json({ messages: [], storylines: [] })
  const pattern = `%${query.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`
  const messages = db.prepare("SELECT id, thread_id, role, content, created_at FROM messages WHERE user_id = ? AND content LIKE ? ESCAPE '\\' ORDER BY id DESC LIMIT 50").all(req.user.id, pattern)
  const storylines = db.prepare("SELECT * FROM storylines WHERE user_id = ? AND (topic LIKE ? ESCAPE '\\' OR summary LIKE ? ESCAPE '\\') ORDER BY last_updated_at DESC LIMIT 25").all(req.user.id, pattern, pattern).map(parseStoryline)
  audit(req, 'search.query', { query_length: query.length, result_count: messages.length + storylines.length })
  res.json({ messages, storylines })
})

app.get('/api/memory/proposals', auth, (req, res) => res.json({ proposals: getProposals(req.user.id) }))
app.post('/api/memory/proposals/:id/approve', auth, (req, res) => {
  const proposal = db.prepare("SELECT * FROM memory_proposals WHERE id = ? AND user_id = ? AND status = 'pending'").get(req.params.id, req.user.id)
  if (!proposal) return res.status(404).json({ error: 'Memory proposal not found.' })
  const existing = db.prepare("SELECT * FROM storylines WHERE user_id = ? AND topic = ? AND status != 'resolved'").get(req.user.id, proposal.topic)
  const stamp = now()
  let storyline
  if (existing) {
    const quotes = JSON.parse(existing.source_quotes || '[]'); if (!quotes.includes(proposal.source_quote)) quotes.push(proposal.source_quote)
    db.prepare("UPDATE storylines SET summary = ?, source_quotes = ?, status = 'open', last_updated_at = ? WHERE id = ?").run(proposal.summary, JSON.stringify(quotes.slice(-4)), stamp, existing.id)
    storyline = parseStoryline(db.prepare('SELECT * FROM storylines WHERE id = ?').get(existing.id))
  } else {
    const result = db.prepare('INSERT INTO storylines (user_id, topic, summary, source_quotes, first_mentioned_at, last_updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(req.user.id, proposal.topic, proposal.summary, JSON.stringify([proposal.source_quote]), stamp, stamp)
    storyline = parseStoryline(db.prepare('SELECT * FROM storylines WHERE id = ?').get(result.lastInsertRowid))
  }
  db.prepare("UPDATE memory_proposals SET status = 'approved', resolved_at = ? WHERE id = ?").run(stamp, proposal.id)
  audit(req, 'memory.proposal_approved', { proposal_id: proposal.id })
  res.json({ storyline, proposals: getProposals(req.user.id), storylines: getStorylines(req.user.id) })
})
app.post('/api/memory/proposals/:id/reject', auth, (req, res) => {
  const result = db.prepare("UPDATE memory_proposals SET status = 'rejected', resolved_at = ? WHERE id = ? AND user_id = ? AND status = 'pending'").run(now(), req.params.id, req.user.id)
  if (!result.changes) return res.status(404).json({ error: 'Memory proposal not found.' })
  audit(req, 'memory.proposal_rejected', { proposal_id: Number(req.params.id) })
  res.json({ proposals: getProposals(req.user.id) })
})

app.post('/api/chat', auth, async (req, res) => {
  const content = String(req.body.content || '').trim()
  if (!content) return res.status(400).json({ error: 'Message is empty.' })
  const thread = ensureThread(req.user.id, req.body.thread_id)
  db.prepare("INSERT INTO messages (user_id, thread_id, role, content) VALUES (?, ?, 'user', ?)").run(req.user.id, thread.id, content)
  db.prepare('UPDATE threads SET updated_at = ? WHERE id = ?').run(now(), thread.id)
  audit(req, 'chat.message', { content_length: content.length })
  const memoryEnabled = Boolean(db.prepare('SELECT memory_enabled FROM users WHERE id = ?').get(req.user.id)?.memory_enabled)
  const candidate = memoryEnabled ? detectMemoryProposal(content) : null
  let proposal = null
  if (candidate && !db.prepare("SELECT id FROM memory_proposals WHERE user_id = ? AND source_quote = ? AND status = 'pending'").get(req.user.id, content)) {
    const result = db.prepare('INSERT INTO memory_proposals (user_id, topic, summary, source_quote, confidence) VALUES (?, ?, ?, ?, ?)').run(req.user.id, candidate.topic, candidate.summary, candidate.source_quote, candidate.confidence)
    proposal = db.prepare('SELECT * FROM memory_proposals WHERE id = ?').get(result.lastInsertRowid)
  }
  const context = relevantStorylines(req.user.id, content)
  let reply
  let provider = configuredModelProvider()
  try { reply = await generateReply(content, context, req.user.name) } catch (error) {
    console.error(error.message)
    provider = 'local-fallback'
    reply = generateLocalReply(content, context, req.user.name)
  }
  db.prepare("INSERT INTO messages (user_id, thread_id, role, content) VALUES (?, ?, 'assistant', ?)").run(req.user.id, thread.id, reply)
  res.json({ reply, provider, thread, storyline: null, proposal, proposals: getProposals(req.user.id), storylines: getStorylines(req.user.id), context })
})

app.post('/api/storylines/seed', auth, (req, res) => {
  const seed = [
    ['The Lisbon idea', 'open', 'You were sketching out a two-week Lisbon trip for late summer, with a tiny notebook and no over-planned itinerary.', ['I think I want to go to Lisbon alone for two weeks this summer.']],
    ['The thing you are making', 'open', 'You started building a tiny photo journal for your grandmother’s recipes, and wanted it to feel like a little book rather than an app.', ['I keep thinking about making a photo journal of my grandmother’s recipes.']],
    ['Work & direction', 'stale', 'You were unsure whether to take on a bigger client project or keep more room for your own work.', ['The bigger project sounds good, but I’m worried it will swallow all my time.']]
  ]
  const stamp = new Date(Date.now() - 1000 * 60 * 60 * 24 * 61).toISOString()
  const due = new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString()
  const insert = db.prepare('INSERT INTO storylines (user_id, topic, status, summary, source_quotes, first_mentioned_at, last_updated_at, follow_up_due) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  const transaction = db.transaction(() => seed.forEach(([topic, status, summary, quotes]) => {
    const exists = db.prepare('SELECT id FROM storylines WHERE user_id = ? AND topic = ?').get(req.user.id, topic)
    if (!exists) insert.run(req.user.id, topic, status, summary, JSON.stringify(quotes), stamp, stamp, due)
  }))
  transaction()
  res.json({ storylines: getStorylines(req.user.id) })
})

app.put('/api/storylines/:id', auth, (req, res) => {
  const { topic, summary, status, source_quotes } = req.body
  const result = db.prepare('UPDATE storylines SET topic = COALESCE(?, topic), summary = COALESCE(?, summary), status = COALESCE(?, status), source_quotes = COALESCE(?, source_quotes), last_updated_at = ? WHERE id = ? AND user_id = ?')
    .run(topic, summary, status, source_quotes ? JSON.stringify(source_quotes) : null, now(), req.params.id, req.user.id)
  if (!result.changes) return res.status(404).json({ error: 'Memory not found.' })
  audit(req, 'memory.update', { storyline_id: Number(req.params.id) })
  res.json({ storyline: parseStoryline(db.prepare('SELECT * FROM storylines WHERE id = ?').get(req.params.id)) })
})
app.delete('/api/storylines/:id', auth, (req, res) => {
  db.prepare('DELETE FROM storylines WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id)
  audit(req, 'memory.delete', { storyline_id: Number(req.params.id) })
  res.json({ ok: true })
})

app.get('/api/voice/session', auth, (req, res) => {
  if (process.env.GROQ_API_KEY) return res.json({ enabled: true, provider: 'groq', transcription_model: GROQ_TRANSCRIPTION_MODEL, speech_model: GROQ_SPEECH_MODEL, message: 'Groq voice is ready.' })
  res.json({ enabled: Boolean(process.env.OPENAI_API_KEY), provider: process.env.OPENAI_API_KEY ? 'openai-realtime' : null, model: REALTIME_MODEL, message: process.env.OPENAI_API_KEY ? 'Voice is ready to connect.' : 'Voice is not configured for this environment.' })
})
app.post('/api/voice/transcribe', auth, express.raw({ type: 'audio/*', limit: '25mb' }), async (req, res) => {
  if (!process.env.GROQ_API_KEY) return res.status(503).json({ error: 'Groq voice is not configured for this environment.' })
  if (!Buffer.isBuffer(req.body) || req.body.length < 32) return res.status(400).json({ error: 'A short audio recording is required.' })
  try {
    const form = new FormData()
    form.append('file', new Blob([req.body], { type: req.headers['content-type'] || 'audio/webm' }), 'river-voice.webm')
    form.append('model', GROQ_TRANSCRIPTION_MODEL)
    form.append('response_format', 'json')
    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` }, body: form, signal: AbortSignal.timeout(45_000) })
    if (!response.ok) throw new Error(`Groq transcription failed (${response.status}).`)
    const data = await response.json()
    const transcript = String(data.text || '').trim()
    if (!transcript) return res.status(422).json({ error: 'River could not hear any speech. Try again in a quieter place.' })
    audit(req, 'voice.transcribed', { audio_bytes: req.body.length, transcript_length: transcript.length })
    res.json({ transcript })
  } catch (error) { console.error(error.message); res.status(502).json({ error: 'River could not transcribe this recording. Please try again.' }) }
})
app.post('/api/voice/speak', auth, async (req, res) => {
  if (!process.env.GROQ_API_KEY) return res.status(503).json({ error: 'Groq voice is not configured for this environment.' })
  const text = String(req.body?.text || '').trim().slice(0, 200)
  if (!text) return res.status(400).json({ error: 'Text is required for speech.' })
  try {
    const response = await fetch('https://api.groq.com/openai/v1/audio/speech', { method: 'POST', headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: GROQ_SPEECH_MODEL, voice: 'hannah', input: text, response_format: 'wav' }), signal: AbortSignal.timeout(45_000) })
    if (!response.ok) {
      const failure = await response.json().catch(() => ({}))
      if (failure.error?.code === 'model_terms_required') return res.status(412).json({ error: 'Groq requires one-time acceptance for its Orpheus voice model. Open the Groq playground, select Orpheus English, accept its terms, then try voice again.' })
      throw new Error(`Groq speech failed (${response.status}).`)
    }
    const audio = Buffer.from(await response.arrayBuffer())
    audit(req, 'voice.spoken', { text_length: text.length })
    res.setHeader('Content-Type', 'audio/wav').setHeader('Cache-Control', 'no-store').send(audio)
  } catch (error) { console.error(error.message); res.status(502).json({ error: 'River could not create spoken audio. Your text reply is still available.' }) }
})
app.post('/api/voice/call', auth, async (req, res) => {
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'Voice is not configured for this environment.' })
  const sdp = String(req.body?.sdp || '')
  if (!sdp.startsWith('v=') || sdp.length > 100_000) return res.status(400).json({ error: 'A valid WebRTC offer is required.' })
  const session = { type: 'realtime', model: REALTIME_MODEL, output_modalities: ['audio'], max_output_tokens: 512 }
  try {
    const form = new FormData()
    form.append('sdp', new Blob([sdp], { type: 'application/sdp' }), 'offer.sdp')
    form.append('session', new Blob([JSON.stringify(session)], { type: 'application/json' }), 'session.json')
    const response = await fetch('https://api.openai.com/v1/realtime/calls', { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'X-Client-Request-Id': req.requestId }, body: form })
    const answer = await response.text()
    if (!response.ok) { console.error(`Realtime call failed: ${response.status}`); return res.status(502).json({ error: 'River could not start a voice session. Please try again.' }) }
    audit(req, 'voice.session_started', { model: REALTIME_MODEL })
    res.json({ sdp: answer, call_id: response.headers.get('location')?.split('/').pop() || null })
  } catch (error) { console.error(`Realtime request failed: ${error.message}`); res.status(502).json({ error: 'River could not reach the voice provider. Please try again.' }) }
})

app.use(express.static(path.join(__dirname, 'dist')))
app.get('*', (req, res, next) => req.path.startsWith('/api') ? next() : res.sendFile(path.join(__dirname, 'dist', 'index.html')))
app.listen(PORT, () => console.log(`River API listening on http://127.0.0.1:${PORT}`))
