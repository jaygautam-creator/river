import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import Database from 'better-sqlite3'

const source = process.env.RIVER_DB_PATH || process.env.DATABASE_PATH || path.resolve('kindred.db')
const destination = process.env.RIVER_BACKUP_PATH || path.resolve('backups', `river-${new Date().toISOString().replaceAll(':', '-')}.db`)
const encryptionKey = process.env.RIVER_BACKUP_ENCRYPTION_KEY
if (process.env.NODE_ENV === 'production' && !encryptionKey) throw new Error('RIVER_BACKUP_ENCRYPTION_KEY is required for production backups.')
await fs.mkdir(path.dirname(destination), { recursive: true, mode: 0o700 })
const temporary = `${destination}.${crypto.randomUUID()}.tmp`
const db = new Database(source, { readonly: true })
await db.backup(temporary)
db.close()
await fs.chmod(temporary, 0o600)
if (encryptionKey) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', crypto.createHash('sha256').update(encryptionKey).digest(), iv)
  const ciphertext = Buffer.concat([cipher.update(await fs.readFile(temporary)), cipher.final()])
  await fs.writeFile(destination, Buffer.concat([iv, cipher.getAuthTag(), ciphertext]), { mode: 0o600 })
  await fs.rm(temporary, { force: true })
} else await fs.rename(temporary, destination)
await fs.chmod(destination, 0o600)
console.log(`River database backup created at ${destination}`)
