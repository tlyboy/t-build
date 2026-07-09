import Database from 'better-sqlite3'
import { getDatabasePath } from '@/lib/db/paths'

type GlobalWithSqlite = typeof globalThis & {
  __tbuildSqlite?: Database.Database
}

const globalForSqlite = globalThis as GlobalWithSqlite

export function getSqliteDatabase(): Database.Database {
  if (!globalForSqlite.__tbuildSqlite) {
    const sqlite = new Database(getDatabasePath())
    sqlite.pragma('journal_mode = WAL')
    sqlite.pragma('foreign_keys = ON')
    globalForSqlite.__tbuildSqlite = sqlite
  }

  return globalForSqlite.__tbuildSqlite
}
