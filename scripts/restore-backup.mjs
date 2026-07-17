import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

const source = process.env.RIVER_RESTORE_SOURCE
const destination = process.env.DATABASE_PATH || path.resolve('kindred.db')
const encryptionKey = process.env.RIVER_BACKUP_ENCRYPTION_KEY

if (!source) throw new Error('RIVER_RESTORE_SOURCE must point to an encrypted River backup.')
if (!encryptionKey) throw new Error('RIVER_BACKUP_ENCRYPTION_KEY is required to restore an encrypted backup.')
if (!process.env.RIVER_RESTORE_OVERWRITE) throw new Error('Set RIVER_RESTORE_OVERWRITE=true only after stopping River and confirming the destination may be replaced.')

const encrypted = await fs.readFile(source)
if (encrypted.length < 29) throw new Error('Backup is not a valid encrypted River backup.')
const iv = encrypted.subarray(0, 12)
const tag = encrypted.subarray(12, 28)
const ciphertext = encrypted.subarray(28)
const decipher = crypto.createDecipheriv('aes-256-gcm', crypto.createHash('sha256').update(encryptionKey).digest(), iv)
decipher.setAuthTag(tag)
const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
const temporary = `${destination}.${crypto.randomUUID()}.restore.tmp`

await fs.mkdir(path.dirname(destination), { recursive: true, mode: 0o700 })
await fs.writeFile(temporary, plaintext, { mode: 0o600 })
await fs.rename(temporary, destination)
await fs.chmod(destination, 0o600)
console.log(`River database restored to ${destination}`)
