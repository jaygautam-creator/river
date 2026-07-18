import pg from 'pg'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is required to migrate River to PostgreSQL.')

const pool = new pg.Pool({
  connectionString,
  ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
  max: 1,
})

const schema = `
  CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    memory_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    retention_days INTEGER NOT NULL DEFAULT 365,
    mfa_secret TEXT,
    mfa_enabled_at TIMESTAMPTZ,
    email_verified_at TIMESTAMPTZ,
    session_version INTEGER NOT NULL DEFAULT 1,
    failed_login_count INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS threads (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Today',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS messages (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    thread_id BIGINT REFERENCES threads(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS storylines (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'resolved', 'stale')),
    summary TEXT NOT NULL,
    source_quotes JSONB NOT NULL DEFAULT '[]'::jsonb,
    first_mentioned_at TIMESTAMPTZ NOT NULL,
    last_updated_at TIMESTAMPTZ NOT NULL,
    follow_up_due TIMESTAMPTZ
  );
  CREATE TABLE IF NOT EXISTS memory_proposals (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    summary TEXT NOT NULL,
    source_quote TEXT NOT NULL,
    confidence DOUBLE PRECISION NOT NULL,
    sensitivity TEXT NOT NULL DEFAULT 'standard' CHECK(sensitivity IN ('standard', 'sensitive')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
    related_storyline_id BIGINT REFERENCES storylines(id) ON DELETE SET NULL,
    conflict_storyline_id BIGINT REFERENCES storylines(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
  );
  CREATE TABLE IF NOT EXISTS memory_events (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    storyline_id BIGINT REFERENCES storylines(id) ON DELETE SET NULL,
    event TEXT NOT NULL,
    detail JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    user_agent TEXT,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS audit_events (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    event TEXT NOT NULL,
    request_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    window_started_at BIGINT NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS threads_user_updated_idx ON threads(user_id, updated_at DESC);
  CREATE INDEX IF NOT EXISTS messages_user_thread_idx ON messages(user_id, thread_id, id);
  CREATE INDEX IF NOT EXISTS storylines_user_updated_idx ON storylines(user_id, last_updated_at DESC);
  CREATE INDEX IF NOT EXISTS memory_proposals_pending_idx ON memory_proposals(user_id, status, created_at DESC);
  CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON refresh_tokens(user_id, expires_at);
`

try {
  await pool.query(schema)
  console.log('River PostgreSQL schema is ready.')
} finally {
  await pool.end()
}
