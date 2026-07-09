import fs from 'fs'
import os from 'os'
import path from 'path'

const DEFAULT_DATA_DIR = path.join(os.homedir(), '.t-build')

export function getDataDir(): string {
  return process.env.T_BUILD_DATA_DIR
    ? path.resolve(process.env.T_BUILD_DATA_DIR)
    : DEFAULT_DATA_DIR
}

export function ensureDataDir(): string {
  const dataDir = getDataDir()
  fs.mkdirSync(dataDir, { recursive: true })
  return dataDir
}

export function getDatabasePath(): string {
  if (process.env.T_BUILD_DATABASE_PATH) {
    const dbPath = path.resolve(process.env.T_BUILD_DATABASE_PATH)
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
    return dbPath
  }

  if (process.env.DATABASE_URL?.startsWith('file:')) {
    const dbPath = path.resolve(process.env.DATABASE_URL.slice('file:'.length))
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
    return dbPath
  }

  return path.join(ensureDataDir(), 't-build.sqlite')
}
