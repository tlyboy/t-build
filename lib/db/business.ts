import fs from 'fs'
import path from 'path'
import type Database from 'better-sqlite3'
import { getDataDir } from '@/lib/db/paths'
import { getSqliteDatabase } from '@/lib/db/sqlite'

type JsonValue = unknown

type MigrationFile =
  | 'projects.json'
  | 'builds.json'
  | 'settings.json'
  | 'env-vars.json'
  | 'webhooks.json'

const legacyJsonFiles: MigrationFile[] = [
  'projects.json',
  'builds.json',
  'settings.json',
  'env-vars.json',
  'webhooks.json',
]

type GlobalWithBusinessDb = typeof globalThis & {
  __tbuildBusinessDbReady?: boolean
}

const globalForBusinessDb = globalThis as GlobalWithBusinessDb

function readJsonFile<T extends JsonValue>(fileName: MigrationFile): T | null {
  const filePath = path.join(/* turbopackIgnore: true */ getDataDir(), fileName)

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T
  } catch {
    return null
  }
}

function readBuildLogFile(buildId: string): string[] {
  const filePath = path.join(
    /* turbopackIgnore: true */ getDataDir(),
    'logs',
    `${buildId}.jsonl`,
  )

  try {
    return fs
      .readFileSync(filePath, 'utf-8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as string)
  } catch {
    return []
  }
}

function createBusinessTables(db: Database.Database) {
  db.exec(`
    create table if not exists tbuild_meta (
      key text primary key,
      value text not null,
      updatedAt text not null
    );

    create table if not exists tbuild_project (
      id text primary key,
      name text not null,
      path text not null,
      buildCommand text not null,
      deployCommand text,
      gitPullBeforeBuild integer not null default 0,
      outputPaths text,
      gitCredentialId text,
      createdAt text not null,
      updatedAt text not null
    );

    create table if not exists tbuild_build (
      id text primary key,
      projectId text not null,
      status text not null,
      startedAt text not null,
      finishedAt text,
      exitCode integer,
      gitCommitHash text,
      gitCommitMessage text,
      foreign key(projectId) references tbuild_project(id) on delete cascade
    );

    create index if not exists tbuild_build_project_idx
      on tbuild_build(projectId, startedAt desc);

    create table if not exists tbuild_build_log (
      id integer primary key autoincrement,
      buildId text not null,
      line text not null,
      createdAt text not null,
      foreign key(buildId) references tbuild_build(id) on delete cascade
    );

    create index if not exists tbuild_build_log_build_idx
      on tbuild_build_log(buildId, id);

    create table if not exists tbuild_setting (
      key text primary key,
      value text not null,
      updatedAt text not null
    );

    create table if not exists tbuild_git_credential (
      id text primary key,
      name text not null,
      type text not null,
      username text,
      password text,
      sshKey text,
      createdAt text not null,
      updatedAt text not null
    );

    create table if not exists tbuild_env_var (
      projectId text not null,
      key text not null,
      value text not null,
      createdAt text not null,
      updatedAt text not null,
      primary key(projectId, key),
      foreign key(projectId) references tbuild_project(id) on delete cascade
    );

    create table if not exists tbuild_webhook (
      id text primary key,
      name text not null,
      provider text not null,
      projectId text not null,
      secret text not null,
      branch text,
      enabled integer not null default 1,
      createdAt text not null,
      updatedAt text not null,
      lastTriggeredAt text,
      lastBuildId text,
      foreign key(projectId) references tbuild_project(id) on delete cascade,
      foreign key(lastBuildId) references tbuild_build(id) on delete set null
    );

    create index if not exists tbuild_webhook_project_idx
      on tbuild_webhook(projectId);
  `)
}

function metaValue(db: Database.Database, key: string) {
  return (
    db.prepare('select value from tbuild_meta where key = ?').get(key) as
      | { value: string }
      | undefined
  )?.value
}

function setMeta(db: Database.Database, key: string, value: string) {
  db.prepare(
    `insert into tbuild_meta (key, value, updatedAt)
     values (?, ?, ?)
     on conflict(key) do update set value = excluded.value, updatedAt = excluded.updatedAt`,
  ).run(key, value, new Date().toISOString())
}

function hasColumn(
  db: Database.Database,
  tableName: string,
  columnName: string,
) {
  const rows = db.prepare(`pragma table_info(${tableName})`).all() as Array<{
    name: string
  }>
  return rows.some((row) => row.name === columnName)
}

function migrateBusinessSchema(db: Database.Database) {
  if (!hasColumn(db, 'tbuild_project', 'deployCommand')) {
    db.exec('alter table tbuild_project add column deployCommand text')
  }
}

function archiveLegacyJsonData(db: Database.Database) {
  if (
    !metaValue(db, 'jsonMigratedAt') ||
    metaValue(db, 'legacyJsonArchivedAt')
  ) {
    return
  }

  const dataDir = getDataDir()
  const timestamp = new Date().toISOString().replace(/[^0-9A-Za-z]/g, '-')
  const backupDir = path.join(
    /* turbopackIgnore: true */ dataDir,
    `legacy-json-backup-${timestamp}`,
  )
  const candidates = [
    ...legacyJsonFiles.map((fileName) =>
      path.join(/* turbopackIgnore: true */ dataDir, fileName),
    ),
    path.join(/* turbopackIgnore: true */ dataDir, 'logs'),
  ]
  const existing = candidates.filter((candidate) => fs.existsSync(candidate))

  if (existing.length > 0) {
    fs.mkdirSync(backupDir, { recursive: true })

    for (const source of existing) {
      fs.renameSync(source, path.join(backupDir, path.basename(source)))
    }
  }

  setMeta(db, 'legacyJsonArchivedAt', new Date().toISOString())
}

function migrateJsonData(db: Database.Database) {
  if (metaValue(db, 'jsonMigratedAt')) {
    archiveLegacyJsonData(db)
    return
  }

  const now = new Date().toISOString()

  db.transaction(() => {
    const projects = readJsonFile<
      Array<{
        id: string
        name: string
        path: string
        buildCommand: string
        deployCommand?: string
        gitPullBeforeBuild?: boolean
        outputPaths?: string[]
        gitCredentialId?: string
        createdAt: string
        updatedAt: string
      }>
    >('projects.json')

    if (projects) {
      const insertProject = db.prepare(
        `insert or ignore into tbuild_project (
          id, name, path, buildCommand, deployCommand, gitPullBeforeBuild,
          outputPaths, gitCredentialId, createdAt, updatedAt
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )

      for (const project of projects) {
        insertProject.run(
          project.id,
          project.name,
          project.path,
          project.buildCommand,
          project.deployCommand?.trim() || null,
          project.gitPullBeforeBuild ? 1 : 0,
          project.outputPaths ? JSON.stringify(project.outputPaths) : null,
          project.gitCredentialId ?? null,
          project.createdAt,
          project.updatedAt,
        )
      }
    }

    const settings = readJsonFile<{
      workDir?: string
      gitCredentials?: Array<{
        id: string
        name: string
        type: 'https' | 'ssh'
        username?: string
        password?: string
        sshKey?: string
      }>
    }>('settings.json')

    if (settings?.workDir) {
      db.prepare(
        `insert or ignore into tbuild_setting (key, value, updatedAt)
         values (?, ?, ?)`,
      ).run('workDir', settings.workDir, now)
    }

    if (settings?.gitCredentials) {
      const insertCredential = db.prepare(
        `insert or ignore into tbuild_git_credential (
          id, name, type, username, password, sshKey, createdAt, updatedAt
        ) values (?, ?, ?, ?, ?, ?, ?, ?)`,
      )

      for (const credential of settings.gitCredentials) {
        insertCredential.run(
          credential.id,
          credential.name,
          credential.type,
          credential.username ?? null,
          credential.password ?? null,
          credential.sshKey ?? null,
          now,
          now,
        )
      }
    }

    const builds = readJsonFile<
      Array<{
        id: string
        projectId: string
        status: string
        startedAt: string
        finishedAt?: string
        exitCode?: number
        gitCommitHash?: string
        gitCommitMessage?: string
      }>
    >('builds.json')

    if (builds) {
      const insertBuild = db.prepare(
        `insert or ignore into tbuild_build (
          id, projectId, status, startedAt, finishedAt, exitCode,
          gitCommitHash, gitCommitMessage
        ) values (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      const insertLog = db.prepare(
        `insert into tbuild_build_log (buildId, line, createdAt)
         values (?, ?, ?)`,
      )

      for (const build of builds) {
        const projectExists = db
          .prepare('select id from tbuild_project where id = ?')
          .get(build.projectId)
        if (!projectExists) continue

        insertBuild.run(
          build.id,
          build.projectId,
          build.status,
          build.startedAt,
          build.finishedAt ?? null,
          build.exitCode ?? null,
          build.gitCommitHash ?? null,
          build.gitCommitMessage ?? null,
        )

        const existingLog = db
          .prepare('select id from tbuild_build_log where buildId = ? limit 1')
          .get(build.id)
        if (!existingLog) {
          for (const line of readBuildLogFile(build.id)) {
            insertLog.run(build.id, line, build.startedAt)
          }
        }
      }
    }

    const envVars = readJsonFile<
      Array<{
        projectId: string
        key: string
        value: string
      }>
    >('env-vars.json')

    if (envVars) {
      const insertEnvVar = db.prepare(
        `insert or ignore into tbuild_env_var (
          projectId, key, value, createdAt, updatedAt
        ) values (?, ?, ?, ?, ?)`,
      )

      for (const envVar of envVars) {
        const projectExists = db
          .prepare('select id from tbuild_project where id = ?')
          .get(envVar.projectId)
        if (!projectExists) continue

        insertEnvVar.run(envVar.projectId, envVar.key, envVar.value, now, now)
      }
    }

    const webhooks = readJsonFile<
      Array<{
        id: string
        name: string
        provider: string
        projectId: string
        secret: string
        branch?: string
        enabled: boolean
        createdAt: string
        updatedAt: string
        lastTriggeredAt?: string
        lastBuildId?: string
      }>
    >('webhooks.json')

    if (webhooks) {
      const insertWebhook = db.prepare(
        `insert or ignore into tbuild_webhook (
          id, name, provider, projectId, secret, branch, enabled,
          createdAt, updatedAt, lastTriggeredAt, lastBuildId
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )

      for (const webhook of webhooks) {
        const projectExists = db
          .prepare('select id from tbuild_project where id = ?')
          .get(webhook.projectId)
        if (!projectExists) continue

        const lastBuildExists = webhook.lastBuildId
          ? db
              .prepare('select id from tbuild_build where id = ?')
              .get(webhook.lastBuildId)
          : null

        insertWebhook.run(
          webhook.id,
          webhook.name,
          webhook.provider,
          webhook.projectId,
          webhook.secret,
          webhook.branch ?? null,
          webhook.enabled ? 1 : 0,
          webhook.createdAt,
          webhook.updatedAt,
          webhook.lastTriggeredAt ?? null,
          lastBuildExists ? webhook.lastBuildId : null,
        )
      }
    }

    setMeta(db, 'jsonMigratedAt', now)
  })()

  archiveLegacyJsonData(db)
}

export function getBusinessDatabase(): Database.Database {
  const db = getSqliteDatabase()

  if (!globalForBusinessDb.__tbuildBusinessDbReady) {
    createBusinessTables(db)
    migrateBusinessSchema(db)
    migrateJsonData(db)
    globalForBusinessDb.__tbuildBusinessDbReady = true
  }

  return db
}
