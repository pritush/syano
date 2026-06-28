import { createError } from 'h3'
import { sql } from 'drizzle-orm'
import type { useDrizzle } from '~/server/utils/db'

export const MIGRATION_VERSION = 2

type DrizzleDb = Awaited<ReturnType<typeof useDrizzle>>

export interface MigrationItem {
  id: string
  label: string
}

export interface SchemaCheckResult {
  status: 'connected' | 'empty' | 'error'
  upToDate: boolean
  missing: string[]
  migrationVersion: number
  normalizeSlugsOnUpgrade: boolean
  error?: string
}

export interface UpgradeResult {
  success: boolean
  message: string
  error?: string
  warnings?: string[]
  appliedBaseSchema?: boolean
  migrationVersion: number
}

const globalStore = globalThis as typeof globalThis & {
  __syanoUpgradeInProgress?: boolean
}

const REQUIRED_TABLES: MigrationItem[] = [
  { id: 'links', label: 'Links table' },
  { id: 'tags', label: 'Tags table' },
  { id: 'access_logs', label: 'Access logs table' },
  { id: 'site_settings', label: 'Site settings table' },
  { id: 'qr_scans', label: 'QR code scans table' },
  { id: 'users', label: 'Users table' },
  { id: 'audit_logs', label: 'Audit logs table' },
  { id: 'api_keys', label: 'API keys table' },
  { id: 'webhooks', label: 'Webhooks table' },
  { id: 'webhook_deliveries', label: 'Webhook deliveries table' },
  { id: 'api_rate_limits', label: 'API rate limits table' },
  { id: 'sender_ids', label: 'Sender IDs table (TRAI SMS)' },
]

const REQUIRED_COLUMNS: Array<MigrationItem & { table: string; column: string }> = [
  { id: 'redirect_timeout', table: 'site_settings', column: 'redirect_timeout', label: 'Redirect delay configuration' },
  { id: 'trai_sms_enabled', table: 'site_settings', column: 'trai_sms_enabled', label: 'TRAI SMS compliance setting' },
  { id: 'utm_source', table: 'access_logs', column: 'utm_source', label: 'Analytics UTM parameters' },
  { id: 'key_encrypted', table: 'api_keys', column: 'key_encrypted', label: 'API key encryption column' },
  { id: 'sender_id', table: 'links', column: 'sender_id', label: 'Link sender ID column (TRAI SMS)' },
  { id: 'is_default', table: 'sender_ids', column: 'is_default', label: 'Default sender ID flag' },
]

const REQUIRED_INDEXES: MigrationItem[] = [
  { id: 'idx_access_logs_link_date', label: 'Analytics query indexes' },
  { id: 'idx_qr_scans_link_date', label: 'QR scan analytics indexes' },
]

const PERFORMANCE_INDEXES = [
  ['idx_access_logs_slug_date', 'CREATE INDEX IF NOT EXISTS idx_access_logs_slug_date ON access_logs(slug, created_at DESC)'],
  ['idx_access_logs_link_date', 'CREATE INDEX IF NOT EXISTS idx_access_logs_link_date ON access_logs(link_id, created_at DESC)'],
  ['idx_access_logs_browser', 'CREATE INDEX IF NOT EXISTS idx_access_logs_browser ON access_logs(browser_type) WHERE browser_type IS NOT NULL'],
  ['idx_access_logs_device', 'CREATE INDEX IF NOT EXISTS idx_access_logs_device ON access_logs(device_type) WHERE device_type IS NOT NULL'],
  ['idx_access_logs_os', 'CREATE INDEX IF NOT EXISTS idx_access_logs_os ON access_logs(os) WHERE os IS NOT NULL'],
  ['idx_access_logs_referer', 'CREATE INDEX IF NOT EXISTS idx_access_logs_referer ON access_logs(referer) WHERE referer IS NOT NULL'],
  ['idx_qr_scans_link_date', 'CREATE INDEX IF NOT EXISTS idx_qr_scans_link_date ON qr_scans(link_id, created_at DESC)'],
  ['idx_qr_scans_slug', 'CREATE INDEX IF NOT EXISTS idx_qr_scans_slug ON qr_scans(slug)'],
  ['idx_links_tag_id_filter', 'CREATE INDEX IF NOT EXISTS idx_links_tag_id_filter ON links(tag_id) WHERE tag_id IS NOT NULL'],
  ['idx_links_expiration', 'CREATE INDEX IF NOT EXISTS idx_links_expiration ON links(expiration) WHERE expiration IS NOT NULL'],
  ['idx_api_rate_limits_key_endpoint', 'CREATE INDEX IF NOT EXISTS idx_api_rate_limits_key_endpoint ON api_rate_limits(api_key_id, endpoint, window_start)'],
  ['idx_links_id_tag', 'CREATE INDEX IF NOT EXISTS idx_links_id_tag ON links(id DESC, tag_id)'],
] as const

const STANDARD_INDEXES = [
  ['idx_users_username', 'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)'],
  ['idx_audit_logs_created_at', 'CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC)'],
  ['idx_audit_logs_action', 'CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)'],
  ['idx_audit_logs_entity_type', 'CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type)'],
  ['idx_audit_logs_actor', 'CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id)'],
  ['idx_api_keys_user_id', 'CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id)'],
  ['idx_api_keys_key_hash', 'CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash)'],
  ['idx_webhooks_user_id', 'CREATE INDEX IF NOT EXISTS idx_webhooks_user_id ON webhooks(user_id)'],
  ['idx_webhook_deliveries_webhook_id', 'CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id)'],
  ['idx_webhook_deliveries_delivered_at', 'CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_delivered_at ON webhook_deliveries(delivered_at DESC)'],
  ['idx_api_rate_limits_api_key_id', 'CREATE INDEX IF NOT EXISTS idx_api_rate_limits_api_key_id ON api_rate_limits(api_key_id)'],
  ['idx_api_rate_limits_window_start', 'CREATE INDEX IF NOT EXISTS idx_api_rate_limits_window_start ON api_rate_limits(window_start)'],
] as const

async function createIndexSafe(db: DrizzleDb, name: string, statement: string, warnings: string[]) {
  try {
    await db.execute(sql.raw(statement))
  } catch (err: any) {
    warnings.push(`${name}: ${err.message || 'Unknown error'}`)
  }
}

async function tableExists(db: DrizzleDb, tableName: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${tableName}
    ) AS exists
  `)
  return Boolean(result.rows[0]?.exists)
}

async function executeStatement(
  db: DrizzleDb,
  statement: string,
  warnings: string[],
  label: string,
  options: { critical?: boolean } = {},
) {
  try {
    await db.execute(sql.raw(statement))
  } catch (err: any) {
    if (err.code === '42710' || err.message?.includes('already exists')) {
      return
    }

    const message = `${label}: ${err.message || 'Unknown error'}`
    if (options.critical) {
      throw new Error(message)
    }
    warnings.push(message)
  }
}

export async function isDatabaseEmpty(db: DrizzleDb): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
    ) AS is_empty
  `)
  return Boolean(result.rows[0]?.is_empty)
}

export async function checkSchema(db: DrizzleDb, caseSensitive: boolean): Promise<SchemaCheckResult> {
  if (await isDatabaseEmpty(db)) {
    return {
      status: 'empty',
      upToDate: false,
      missing: ['Core database schema (empty database)'],
      migrationVersion: 0,
      normalizeSlugsOnUpgrade: !caseSensitive,
    }
  }

  const tableNames = REQUIRED_TABLES.map((item) => item.id)
  const tableList = tableNames.map((name) => `'${name}'`).join(', ')

  const tablesResult = await db.execute(sql.raw(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (${tableList})
  `))
  const existingTables = new Set(
    tablesResult.rows.map((row) => String((row as { table_name: string }).table_name)),
  )

  const columnChecks = REQUIRED_COLUMNS.map(
    (item) =>
      `EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = '${item.table}'
          AND column_name = '${item.column}'
      ) AS "${item.id}"`,
  ).join(',\n')

  const columnsResult = await db.execute(sql.raw(`SELECT ${columnChecks}`))
  const columnRow = (columnsResult.rows[0] || {}) as Record<string, boolean>

  const indexNames = REQUIRED_INDEXES.map((item) => item.id)
  const indexList = indexNames.map((name) => `'${name}'`).join(', ')

  const indexesResult = await db.execute(sql.raw(`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname IN (${indexList})
  `))
  const existingIndexes = new Set(
    indexesResult.rows.map((row) => String((row as { indexname: string }).indexname)),
  )

  const missing: string[] = []

  for (const table of REQUIRED_TABLES) {
    if (!existingTables.has(table.id)) {
      missing.push(table.label)
    }
  }

  for (const column of REQUIRED_COLUMNS) {
    if (!columnRow[column.id]) {
      missing.push(column.label)
    }
  }

  for (const index of REQUIRED_INDEXES) {
    if (!existingIndexes.has(index.id)) {
      missing.push(index.label)
    }
  }

  return {
    status: 'connected',
    upToDate: missing.length === 0,
    missing,
    migrationVersion: MIGRATION_VERSION,
    normalizeSlugsOnUpgrade: !caseSensitive,
  }
}

async function ensureMigrationTracking(db: DrizzleDb) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id varchar(64) PRIMARY KEY NOT NULL,
      applied_at timestamp with time zone DEFAULT now()
    )
  `)
}

async function recordMigration(db: DrizzleDb, id: string) {
  await ensureMigrationTracking(db)
  const escaped = id.replace(/'/g, "''")
  await db.execute(sql.raw(`
    INSERT INTO schema_migrations (id)
    VALUES ('${escaped}')
    ON CONFLICT (id) DO NOTHING
  `))
}

async function createUpdatedAtTrigger(db: DrizzleDb, warnings: string[]) {
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `)

  for (const statement of [
    `CREATE TRIGGER update_links_updated_at
      BEFORE UPDATE ON links
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()`,
    `CREATE TRIGGER update_links_updated_at
      BEFORE UPDATE ON links
      FOR EACH ROW
      EXECUTE PROCEDURE update_updated_at_column()`,
  ]) {
    try {
      await db.execute(sql.raw(statement))
      return
    } catch (err: any) {
      if (err.code === '42710' || err.message?.includes('already exists')) {
        return
      }
    }
  }

  warnings.push('update_links_updated_at trigger: could not be created')
}

async function runBaseSchema(db: DrizzleDb, warnings: string[]) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS tags (
        id varchar(64) PRIMARY KEY NOT NULL,
        name varchar(120) NOT NULL,
        created_at timestamp with time zone DEFAULT now()
      )
    `)

    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS sender_ids (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(6) NOT NULL,
        description text,
        is_active boolean DEFAULT true,
        is_default boolean DEFAULT false,
        created_at timestamp with time zone DEFAULT now()
      )
    `)

    await tx.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_sender_ids_name_unique ON sender_ids(name)
    `)

    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS links (
        id varchar(64) PRIMARY KEY NOT NULL,
        slug varchar(128) NOT NULL UNIQUE,
        url text NOT NULL,
        comment text,
        created_at timestamp with time zone DEFAULT now(),
        updated_at timestamp with time zone DEFAULT now(),
        expiration bigint,
        title text,
        description text,
        image text,
        apple text,
        google text,
        cloaking boolean DEFAULT false,
        redirect_with_query boolean DEFAULT false,
        password text,
        unsafe boolean DEFAULT false,
        tag_id varchar(64) REFERENCES tags(id) ON DELETE SET NULL,
        sender_id uuid REFERENCES sender_ids(id) ON DELETE SET NULL
      )
    `)

    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS access_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        link_id varchar(64) REFERENCES links(id) ON DELETE SET NULL,
        slug varchar(128),
        url text,
        ua text,
        ip inet,
        referer text,
        country varchar(120),
        region text,
        city text,
        timezone text,
        language text,
        os text,
        browser text,
        browser_type text,
        device text,
        device_type text,
        latitude double precision DEFAULT 0,
        longitude double precision DEFAULT 0,
        utm_source varchar(128),
        utm_medium varchar(128),
        utm_campaign varchar(128),
        utm_term varchar(128),
        utm_content varchar(128),
        created_at timestamp with time zone DEFAULT now()
      )
    `)

    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS qr_scans (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        link_id varchar(64) REFERENCES links(id) ON DELETE CASCADE,
        slug varchar(128),
        created_at timestamp with time zone DEFAULT now()
      )
    `)

    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS site_settings (
        id varchar(8) PRIMARY KEY NOT NULL,
        homepage_mode varchar(20),
        redirect_url varchar(2048),
        redirect_timeout bigint DEFAULT 3,
        bio_content jsonb,
        trai_sms_enabled boolean DEFAULT false
      )
    `)

    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        username varchar(64) NOT NULL UNIQUE,
        display_name varchar(120),
        password_hash text NOT NULL,
        permissions text[] NOT NULL DEFAULT '{}',
        is_active boolean DEFAULT true,
        created_at timestamp with time zone DEFAULT now(),
        updated_at timestamp with time zone DEFAULT now()
      )
    `)

    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_id varchar(64) NOT NULL,
        actor_username varchar(128) NOT NULL,
        action varchar(32) NOT NULL,
        entity_type varchar(32) NOT NULL,
        entity_id varchar(128),
        entity_label varchar(256),
        details jsonb,
        ip inet,
        created_at timestamp with time zone DEFAULT now()
      )
    `)

    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS api_keys (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid REFERENCES users(id) ON DELETE CASCADE,
        name varchar(128) NOT NULL,
        key_prefix varchar(16) NOT NULL,
        key_hash text NOT NULL,
        key_encrypted text,
        permissions text[] NOT NULL DEFAULT '{}',
        is_active boolean DEFAULT true,
        last_used_at timestamp with time zone,
        expires_at timestamp with time zone,
        created_at timestamp with time zone DEFAULT now(),
        updated_at timestamp with time zone DEFAULT now()
      )
    `)

    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS webhooks (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid REFERENCES users(id) ON DELETE CASCADE,
        name varchar(128) NOT NULL,
        url text NOT NULL,
        events text[] NOT NULL DEFAULT '{}',
        secret text NOT NULL,
        is_active boolean DEFAULT true,
        failure_count bigint DEFAULT 0,
        last_triggered_at timestamp with time zone,
        created_at timestamp with time zone DEFAULT now(),
        updated_at timestamp with time zone DEFAULT now()
      )
    `)

    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS webhook_deliveries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        webhook_id uuid REFERENCES webhooks(id) ON DELETE CASCADE,
        event_type varchar(64) NOT NULL,
        payload jsonb NOT NULL,
        response_status bigint,
        response_body text,
        error text,
        delivered_at timestamp with time zone DEFAULT now()
      )
    `)

    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS api_rate_limits (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        api_key_id uuid REFERENCES api_keys(id) ON DELETE CASCADE,
        endpoint varchar(256) NOT NULL,
        request_count bigint DEFAULT 0,
        window_start timestamp with time zone DEFAULT now(),
        created_at timestamp with time zone DEFAULT now()
      )
    `)

    await tx.execute(sql`
      INSERT INTO site_settings (id, homepage_mode, redirect_url, redirect_timeout, bio_content)
      VALUES (
        'default',
        'DEFAULT',
        NULL,
        3,
        '{"profile": {"name": "Syano", "bio": null, "initials": "SY", "avatar_url": null}, "links": [], "socials": []}'::jsonb
      )
      ON CONFLICT (id) DO NOTHING
    `)
  })

  await createUpdatedAtTrigger(db, warnings)
}

async function runIncrementalSchema(db: DrizzleDb, warnings: string[]) {
  if (await tableExists(db, 'links')) {
    await executeStatement(
      db,
      `CREATE TABLE IF NOT EXISTS qr_scans (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        link_id varchar(64) REFERENCES links(id) ON DELETE cascade,
        slug varchar(128),
        created_at timestamp with time zone DEFAULT now()
      )`,
      warnings,
      'qr_scans table',
      { critical: true },
    )
  }

  if (await tableExists(db, 'site_settings')) {
    await executeStatement(
      db,
      'ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS redirect_timeout bigint DEFAULT 3',
      warnings,
      'site_settings.redirect_timeout',
    )
    await executeStatement(
      db,
      'ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS trai_sms_enabled boolean DEFAULT false',
      warnings,
      'site_settings.trai_sms_enabled',
    )
  } else {
    warnings.push('site_settings table: missing — skipped column updates')
  }

  if (await tableExists(db, 'access_logs')) {
    await executeStatement(
      db,
      `ALTER TABLE access_logs
        ADD COLUMN IF NOT EXISTS utm_source varchar(128),
        ADD COLUMN IF NOT EXISTS utm_medium varchar(128),
        ADD COLUMN IF NOT EXISTS utm_campaign varchar(128),
        ADD COLUMN IF NOT EXISTS utm_term varchar(128),
        ADD COLUMN IF NOT EXISTS utm_content varchar(128)`,
      warnings,
      'access_logs UTM columns',
    )
  } else {
    warnings.push('access_logs table: missing — skipped UTM columns')
  }

  await executeStatement(
    db,
    `CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      username varchar(64) NOT NULL UNIQUE,
      display_name varchar(120),
      password_hash text NOT NULL,
      permissions text[] NOT NULL DEFAULT '{}',
      is_active boolean DEFAULT true,
      created_at timestamp with time zone DEFAULT now(),
      updated_at timestamp with time zone DEFAULT now()
    )`,
    warnings,
    'users table',
    { critical: true },
  )

  await executeStatement(
    db,
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      actor_id varchar(64) NOT NULL,
      actor_username varchar(128) NOT NULL,
      action varchar(32) NOT NULL,
      entity_type varchar(32) NOT NULL,
      entity_id varchar(128),
      entity_label varchar(256),
      details jsonb,
      ip inet,
      created_at timestamp with time zone DEFAULT now()
    )`,
    warnings,
    'audit_logs table',
    { critical: true },
  )

  await executeStatement(
    db,
    `CREATE TABLE IF NOT EXISTS api_keys (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      user_id uuid REFERENCES users(id) ON DELETE CASCADE,
      name varchar(128) NOT NULL,
      key_prefix varchar(16) NOT NULL,
      key_hash text NOT NULL,
      key_encrypted text,
      permissions text[] NOT NULL DEFAULT '{}',
      is_active boolean DEFAULT true,
      last_used_at timestamp with time zone,
      expires_at timestamp with time zone,
      created_at timestamp with time zone DEFAULT now(),
      updated_at timestamp with time zone DEFAULT now()
    )`,
    warnings,
    'api_keys table',
    { critical: true },
  )

  if (await tableExists(db, 'api_keys')) {
    await executeStatement(
      db,
      'ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_encrypted text',
      warnings,
      'api_keys.key_encrypted',
    )
  }

  await executeStatement(
    db,
    `CREATE TABLE IF NOT EXISTS webhooks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      user_id uuid REFERENCES users(id) ON DELETE CASCADE,
      name varchar(128) NOT NULL,
      url text NOT NULL,
      events text[] NOT NULL DEFAULT '{}',
      secret text NOT NULL,
      is_active boolean DEFAULT true,
      failure_count bigint DEFAULT 0,
      last_triggered_at timestamp with time zone,
      created_at timestamp with time zone DEFAULT now(),
      updated_at timestamp with time zone DEFAULT now()
    )`,
    warnings,
    'webhooks table',
    { critical: true },
  )

  await executeStatement(
    db,
    `CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      webhook_id uuid REFERENCES webhooks(id) ON DELETE CASCADE,
      event_type varchar(64) NOT NULL,
      payload jsonb NOT NULL,
      response_status bigint,
      response_body text,
      error text,
      delivered_at timestamp with time zone DEFAULT now()
    )`,
    warnings,
    'webhook_deliveries table',
    { critical: true },
  )

  await executeStatement(
    db,
    `CREATE TABLE IF NOT EXISTS api_rate_limits (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      api_key_id uuid REFERENCES api_keys(id) ON DELETE CASCADE,
      endpoint varchar(256) NOT NULL,
      request_count bigint DEFAULT 0,
      window_start timestamp with time zone DEFAULT now(),
      created_at timestamp with time zone DEFAULT now()
    )`,
    warnings,
    'api_rate_limits table',
    { critical: true },
  )

  await executeStatement(
    db,
    `CREATE TABLE IF NOT EXISTS sender_ids (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      name varchar(6) NOT NULL,
      description text,
      is_active boolean DEFAULT true,
      is_default boolean DEFAULT false,
      created_at timestamp with time zone DEFAULT now()
    )`,
    warnings,
    'sender_ids table',
    { critical: true },
  )

  if (await tableExists(db, 'sender_ids')) {
    await executeStatement(
      db,
      'ALTER TABLE sender_ids ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false',
      warnings,
      'sender_ids.is_default',
    )
    await executeStatement(
      db,
      'CREATE UNIQUE INDEX IF NOT EXISTS sender_ids_name_unique ON sender_ids USING btree (name)',
      warnings,
      'sender_ids_name_unique index',
    )
  }

  if (await tableExists(db, 'links')) {
    await executeStatement(
      db,
      'ALTER TABLE links ADD COLUMN IF NOT EXISTS sender_id uuid',
      warnings,
      'links.sender_id',
    )
  }

  if (await tableExists(db, 'links') && await tableExists(db, 'sender_ids')) {
    await executeStatement(
      db,
      `ALTER TABLE links ADD CONSTRAINT links_sender_id_sender_ids_id_fk
        FOREIGN KEY (sender_id) REFERENCES public.sender_ids(id)
        ON DELETE SET NULL ON UPDATE NO ACTION`,
      warnings,
      'links_sender_id_sender_ids_id_fk',
    )
  }
}

async function runIndexes(db: DrizzleDb, warnings: string[]) {
  for (const [name, statement] of STANDARD_INDEXES) {
    await createIndexSafe(db, name, statement, warnings)
  }

  await executeStatement(db, 'DROP INDEX IF EXISTS idx_links_slug_lower', warnings, 'drop idx_links_slug_lower')

  for (const [name, statement] of PERFORMANCE_INDEXES) {
    await createIndexSafe(db, name, statement, warnings)
  }
}

async function normalizeLinkSlugs(db: DrizzleDb, warnings: string[]) {
  if (!(await tableExists(db, 'links'))) {
    return
  }

  try {
    const conflicts = await db.execute(sql`
      SELECT LOWER(TRIM(slug)) AS normalized, COUNT(*)::int AS count
      FROM links
      GROUP BY LOWER(TRIM(slug))
      HAVING COUNT(*) > 1
    `)

    if (conflicts.rows.length > 0) {
      warnings.push(
        `Slug normalization skipped: ${conflicts.rows.length} slug group(s) differ only by case. Resolve duplicates manually.`,
      )
      return
    }

    await db.execute(sql`
      UPDATE links SET slug = LOWER(TRIM(slug)) WHERE slug <> LOWER(TRIM(slug))
    `)
  } catch (err: any) {
    warnings.push(`Slug normalization: ${err.message || 'Unknown error'}`)
  }
}

async function analyzeTables(db: DrizzleDb, warnings: string[]) {
  for (const table of ['links', 'access_logs', 'qr_scans', 'tags', 'api_keys', 'api_rate_limits'] as const) {
    if (!(await tableExists(db, table))) {
      continue
    }
    await executeStatement(db, `ANALYZE ${table}`, warnings, `ANALYZE ${table}`)
  }
}

export function acquireUpgradeLock() {
  if (globalStore.__syanoUpgradeInProgress) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Database upgrade already in progress',
      message: 'Another upgrade request is running. Wait for it to finish and try again.',
    })
  }
  globalStore.__syanoUpgradeInProgress = true
}

export function releaseUpgradeLock() {
  globalStore.__syanoUpgradeInProgress = false
}

export async function runDatabaseUpgrade(db: DrizzleDb, caseSensitive: boolean): Promise<UpgradeResult> {
  const warnings: string[] = []
  let appliedBaseSchema = false

  const empty = await isDatabaseEmpty(db)
  if (empty) {
    await runBaseSchema(db, warnings)
    appliedBaseSchema = true
    await recordMigration(db, 'base_schema')
  }

  await runIncrementalSchema(db, warnings)

  if (!caseSensitive) {
    await normalizeLinkSlugs(db, warnings)
  }

  await runIndexes(db, warnings)
  await analyzeTables(db, warnings)
  await recordMigration(db, `v${MIGRATION_VERSION}`)

  const message = appliedBaseSchema
    ? warnings.length
      ? `Database populated with ${warnings.length} index warning(s).`
      : 'Database populated successfully!'
    : warnings.length
      ? `Database schema upgraded with ${warnings.length} index warning(s).`
      : 'Database schema upgraded successfully!'

  return {
    success: true,
    message,
    warnings: warnings.length ? warnings : undefined,
    appliedBaseSchema,
    migrationVersion: MIGRATION_VERSION,
  }
}
