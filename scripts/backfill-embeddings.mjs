import pg from 'pg'

// One-time backfill: give every approved memory a semantic embedding so recall
// ranks by meaning from the first request, instead of waiting for the lazy
// backfill that runs as users chat. Safe to re-run — it only touches rows whose
// embedding is still NULL. Uses the same free providers as production
// (Gemini text-embedding-004, or OpenAI text-embedding-3-small if that key is
// present instead), so it costs nothing beyond the existing free tier.

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is required to backfill River memory embeddings.')
if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
  throw new Error('Set GEMINI_API_KEY (or OPENAI_API_KEY) to backfill memory embeddings.')
}

const pool = new pg.Pool({
  connectionString,
  ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
  max: 1,
})

const storylineEmbeddingText = story => `${story.topic}. ${story.summary}`.slice(0, 2000)

async function embedText(text) {
  const input = String(text || '').trim().slice(0, 2000)
  if (!input) return null
  if (process.env.OPENAI_API_KEY) {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({ model: process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small', input }),
    })
    if (!response.ok) throw new Error(`OpenAI embedding failed (${response.status}).`)
    const vector = (await response.json()).data?.[0]?.embedding
    return Array.isArray(vector) ? vector : null
  }
  const model = process.env.GEMINI_EMBED_MODEL || 'text-embedding-004'
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:embedContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({ model: `models/${model}`, content: { parts: [{ text: input }] } }),
  })
  if (!response.ok) throw new Error(`Gemini embedding failed (${response.status}).`)
  const vector = (await response.json()).embedding?.values
  return Array.isArray(vector) ? vector : null
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

try {
  // Ensure the column exists even if the app has not booted against this DB yet.
  await pool.query('ALTER TABLE storylines ADD COLUMN IF NOT EXISTS embedding JSONB')
  const { rows } = await pool.query('SELECT id, topic, summary FROM storylines WHERE embedding IS NULL ORDER BY id')
  if (!rows.length) {
    console.log('All River memories already have embeddings. Nothing to do.')
  } else {
    console.log(`Embedding ${rows.length} memories...`)
    let done = 0, skipped = 0
    for (const story of rows) {
      try {
        const vector = await embedText(storylineEmbeddingText(story))
        if (!vector) { skipped += 1; continue }
        await pool.query('UPDATE storylines SET embedding=$1::jsonb WHERE id=$2', [JSON.stringify(vector), story.id])
        done += 1
      } catch (error) {
        skipped += 1
        console.warn(`  memory ${story.id} skipped: ${error.message}`)
      }
      // Stay gently within free-tier request rates.
      await sleep(120)
    }
    console.log(`Done. Embedded ${done}, skipped ${skipped}.`)
  }
} finally {
  await pool.end()
}
