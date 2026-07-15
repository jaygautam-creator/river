import fs from 'fs/promises'
import path from 'path'
import Database from 'better-sqlite3'

const source = process.env.RIVER_DB_PATH || path.resolve('kindred.db')
const destination = process.env.RIVER_BACKUP_PATH || path.resolve('backups', `river-${new Date().toISOString().replaceAll(':', '-')}.db`)
await fs.mkdir(path.dirname(destination), { recursive: true })
const db = new Database(source, { readonly: true })
await db.backup(destination)
db.close()
console.log(`River database backup created at ${destination}`)
