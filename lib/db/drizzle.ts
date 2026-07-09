import { drizzle } from 'drizzle-orm/better-sqlite3'
import { getSqliteDatabase } from '@/lib/db/sqlite'

export const db = drizzle(getSqliteDatabase())
