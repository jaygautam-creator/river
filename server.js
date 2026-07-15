import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 8787
const JWT_SECRET = process.env.JWT_SECRET || 'kindred-local-demo-secret'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5'
const allowedOrigin = process.env.APP_ORIGIN || `http://127.0.0.1:${PORT}`
const requestWindow = new Map()
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) throw new Error('JWT_SECRET must be configured in production.')
const db = new Database(path.join(__dirname, 'kindred.db'))
db.pragma('journal_mode = WAL')
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
`)

const app = express()
app.use(cors({ origin: allowedOrigin }))
app.use(express.json({ limit: '32kb' }))

app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) return next()
  const key = req.ip || 'unknown'
  const current = requestWindow.get(key) || { start: Date.now(), count: 0 }
  if (Date.now() - current.start > 60_000) { current.start = Date.now(); current.count = 0 }
  current.count += 1
  requestWindow.set(key, current)
  if (current.count > 120) return res.status(429).json({ error: 'Too many requests. Please try again shortly.' })
  next()
})

const now = () => new Date().toISOString()
const tokenFor = (user) => jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '30d' })
const publicUser = (user) => ({ id: user.id, name: user.name, email: user.email })

function auth(req, res, next) {
  const header = req.headers.authorization || ''
  try {
    req.user = jwt.verify(header.replace('Bearer ', ''), JWT_SECRET)
    next()
  } catch { res.status(401).json({ error: 'Please sign in again.' }) }
}

function getStorylines(userId) {
  return db.prepare("SELECT * FROM storylines WHERE user_id = ? ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'stale' THEN 1 ELSE 2 END, last_updated_at DESC").all(userId).map(parseStoryline)
}
function parseStoryline(row) { return { ...row, source_quotes: JSON.parse(row.source_quotes || '[]') } }

// A deterministic local extractor keeps the product fully demoable without an API key.
// If OPENAI_API_KEY is configured, this is the seam to replace with a structured extractor.
function extractStoryline(userId, content) {
  const lower = content.toLowerCase()
  const rules = [
    { match: ['lisbon'], topic: 'The Lisbon idea', summary: 'You are planning a two-week Lisbon trip for late summer, with a tiny notebook and no over-planned itinerary.' },
    { match: ['work', 'job', 'interview', 'client', 'promotion'], topic: 'Work & direction', summary: 'Navigating a work decision or professional next step.' },
    { match: ['friend', 'partner', 'date', 'relationship', 'someone important'], topic: 'People on your mind', summary: 'Something is unfolding with someone important.' },
    { match: ['trip', 'travel', 'visit', 'flight', 'weekend away'], topic: 'A trip to look forward to', summary: 'Making plans for a trip or time away.' },
    { match: ['sleep', 'tired', 'energy', 'morning', 'routine'], topic: 'Energy & routine', summary: 'Trying to find a steadier rhythm and protect your energy.' },
    { match: ['learn', 'build', 'project', 'idea', 'write', 'creative'], topic: 'The thing you are making', summary: 'A personal project or idea you want to keep moving.' }
  ]
  const rule = rules.find(r => r.match.some(word => lower.includes(word)))
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
  if (!process.env.OPENAI_API_KEY) return generateLocalReply(content, storylines, userName)
  const context = storylines.length ? `Known storylines:\n${storylines.map(s => `- ${s.topic}: ${s.summary}`).join('\n')}` : 'No storylines are known yet.'
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OPENAI_MODEL, input: [
      { role: 'system', content: [{ type: 'input_text', text: `You are River, a warm, grounded AI companion for ${userName}. Keep replies concise, human, and emotionally attentive. Use ongoing storylines when relevant, but never invent memories. Do not present yourself as a therapist. If the user may be in immediate danger, encourage emergency services and trusted human support.\n\n${context}` }] },
      { role: 'user', content: [{ type: 'input_text', text: content }] }
    ], max_output_tokens: 220 })
  })
  if (!response.ok) throw new Error(`Model request failed (${response.status}).`)
  const data = await response.json()
  const text = data.output?.flatMap(item => item.content || []).find(item => item.type === 'output_text')?.text?.trim()
  if (!text) throw new Error('Model returned an empty response.')
  return text
}

app.post('/api/auth/signup', (req, res) => {
  const { name, email, password } = req.body || {}
  if (!name || !email || !password || password.length < 6) return res.status(400).json({ error: 'Name, email, and a 6+ character password are required.' })
  try {
    const result = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(name.trim(), email.toLowerCase().trim(), bcrypt.hashSync(password, 10))
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid)
    res.json({ token: tokenFor(user), user: publicUser(user) })
  } catch { res.status(409).json({ error: 'An account with that email already exists.' }) }
})

app.post('/api/auth/login', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get((req.body.email || '').toLowerCase().trim())
  if (!user || !bcrypt.compareSync(req.body.password || '', user.password_hash)) return res.status(401).json({ error: 'That email and password don’t match.' })
  res.json({ token: tokenFor(user), user: publicUser(user) })
})
app.get('/api/auth/me', auth, (req, res) => res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) }))
app.get('/api/health', (req, res) => res.json({ ok: true, service: 'river', model: Boolean(process.env.OPENAI_API_KEY) ? OPENAI_MODEL : 'local-fallback' }))

app.get('/api/conversation', auth, (req, res) => {
  const messages = db.prepare('SELECT id, role, content, created_at FROM messages WHERE user_id = ? ORDER BY id ASC').all(req.user.id)
  res.json({ messages, storylines: getStorylines(req.user.id) })
})

app.post('/api/chat', auth, async (req, res) => {
  const content = String(req.body.content || '').trim()
  if (!content) return res.status(400).json({ error: 'Message is empty.' })
  db.prepare("INSERT INTO messages (user_id, role, content) VALUES (?, 'user', ?)").run(req.user.id, content)
  const storyline = extractStoryline(req.user.id, content)
  const context = relevantStorylines(req.user.id, content)
  let reply
  try { reply = await generateReply(content, context, req.user.name) } catch (error) {
    console.error(error.message)
    reply = generateLocalReply(content, context, req.user.name)
  }
  db.prepare("INSERT INTO messages (user_id, role, content) VALUES (?, 'assistant', ?)").run(req.user.id, reply)
  res.json({ reply, storyline, storylines: getStorylines(req.user.id), context })
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
  res.json({ storyline: parseStoryline(db.prepare('SELECT * FROM storylines WHERE id = ?').get(req.params.id)) })
})
app.delete('/api/storylines/:id', auth, (req, res) => {
  db.prepare('DELETE FROM storylines WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id)
  res.json({ ok: true })
})

app.get('/api/voice/session', auth, (req, res) => res.json({ enabled: Boolean(process.env.OPENAI_API_KEY), message: 'Voice session handoff is ready for an OpenAI Realtime session.' }))

app.use(express.static(path.join(__dirname, 'dist')))
app.get('*', (req, res, next) => req.path.startsWith('/api') ? next() : res.sendFile(path.join(__dirname, 'dist', 'index.html')))
app.listen(PORT, () => console.log(`River API listening on http://127.0.0.1:${PORT}`))
