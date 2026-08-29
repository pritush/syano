import { createError } from 'h3'
import { sql } from 'drizzle-orm'
import type { useDrizzle } from '~/server/utils/db'

export const MIGRATION_VERSION = 2

type DrizzleDb = Awaited<ReturnType<typeof useDrizzle>>
type DbExecutor = Pick<DrizzleDb, 'execute'>

export interface MigrationItem {
  id: string
  label: string
}

export interface SchemaCheckResult {
  status: 'connected' | 'empty' | 'error'
  upToDate: boolean
  missing: string[]
  missingIndexes: string[]
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
  schemaCheck?: SchemaCheckResult
}

const globalStore = globalThis as typeof globalThis & {
  __syanoUpgradeInProgress?: boolean
}

// This lock is held for the lifetime of the upgrade transaction. Unlike the
// in-process lock below, it also protects deployments running multiple app
// instances against applying the same DDL concurrently.
const DATABASE_UPGRADE_LOCK_KEY = 709_714_118_533

// ---------------------------------------------------------------------------
// Schema definitions (single source of truth)
// ---------------------------------------------------------------------------

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
  { id: 'click_count', table: 'links', column: 'click_count', label: 'Denormalized click counter' },
]

/**
 * Sentinel indexes used to verify that the full index set was applied.
 * Missing indexes are reported separately and do NOT block upToDate.
 */
const SENTINEL_INDEXES: MigrationItem[] = [
  { id: 'idx_access_logs_link_date', label: 'Analytics query indexes' },
  { id: 'idx_qr_scans_link_date', label: 'QR scan analytics indexes' },
]

const PERFORMANCE_INDEXES = [
  ['idx_access_logs_created_at', 'CREATE INDEX IF NOT EXISTS idx_access_logs_created_at ON access_logs(created_at DESC)'],
  ['idx_access_logs_slug_date', 'CREATE INDEX IF NOT EXISTS idx_access_logs_slug_date ON access_logs(slug, created_at DESC)'],
  ['idx_access_logs_link_date', 'CREATE INDEX IF NOT EXISTS idx_access_logs_link_date ON access_logs(link_id, created_at DESC)'],
  ['idx_access_logs_country', 'CREATE INDEX IF NOT EXISTS idx_access_logs_country ON access_logs(country) WHERE country IS NOT NULL'],
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
  ['idx_api_keys_key_prefix', 'CREATE INDEX IF NOT EXISTS idx_api_keys_key_prefix ON api_keys(key_prefix)'],
  ['idx_api_keys_key_hash', 'CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash)'],
  ['idx_webhooks_user_id', 'CREATE INDEX IF NOT EXISTS idx_webhooks_user_id ON webhooks(user_id)'],
  ['idx_webhook_deliveries_webhook_id', 'CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id)'],
  ['idx_webhook_deliveries_delivered_at', 'CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_delivered_at ON webhook_deliveries(delivered_at DESC)'],
  ['idx_api_rate_limits_api_key_id', 'CREATE INDEX IF NOT EXISTS idx_api_rate_limits_api_key_id ON api_rate_limits(api_key_id)'],
  ['idx_api_rate_limits_window_start', 'CREATE INDEX IF NOT EXISTS idx_api_rate_limits_window_start ON api_rate_limits(window_start)'],
] as const

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

async function createIndexSafe(db: DbExecutor, name: string, statement: string, warnings: string[]) {
  try {
    await db.execute(sql.raw(statement))
  } catch (err: any) {
    warnings.push(`${name}: ${err.message || 'Unknown error'}`)
  }
}

async function tableExists(db: DbExecutor, tableName: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${tableName}
    ) AS exists
  `)
  return Boolean(result.rows[0]?.exists)
}

async function executeStatement(
  db: DbExecutor,
  statement: string,
  warnings: string[],
  label: string,
  options: { critical?: boolean } = {},
) {
  try {
    await db.execute(sql.raw(statement))
  } catch (err: any) {
    const message = `${label}: ${err.message || 'Unknown error'}`
    if (options.critical) {
      throw new Error(message)
    }
    warnings.push(message)
  }
}

// ---------------------------------------------------------------------------
// Schema check
// ---------------------------------------------------------------------------

export async function isDatabaseEmpty(db: DrizzleDb): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
    ) AS is_empty
  `)
  return Boolean(result.rows[0]?.is_empty)
}

/**
 * A database can contain unrelated tables (for example, a provider's own
 * bookkeeping table) and still be a fresh Syano installation. This is more
 * useful than treating every non-empty public schema as an existing install.
 */
async function hasApplicationSchema(db: DbExecutor): Promise<boolean> {
  const tableList = REQUIRED_TABLES.map((item) => `'${item.id}'`).join(', ')
  const result = await db.execute(sql.raw(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (${tableList})
    ) AS exists
  `))
  return Boolean(result.rows[0]?.exists)
}

/**
 * Checks the current database schema against required tables, columns, and
 * sentinel indexes. Tables + columns determine `upToDate`. Missing indexes
 * are reported in `missingIndexes` separately — they do NOT block `upToDate`
 * since restricted providers may silently prevent index creation.
 */
export async function checkSchema(db: DrizzleDb, caseSensitive: boolean): Promise<SchemaCheckResult> {
  if (await isDatabaseEmpty(db)) {
    return {
      status: 'empty',
      upToDate: false,
      missing: ['Core database schema (empty database)'],
      missingIndexes: [],
      migrationVersion: 0,
      normalizeSlugsOnUpgrade: !caseSensitive,
    }
  }

  // Batch query 1: check tables
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

  // Batch query 2: check columns
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

  // Batch query 3: check sentinel indexes
  const indexNames = SENTINEL_INDEXES.map((item) => item.id)
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

  // Collect missing items — tables and columns are "core" (block upToDate)
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

  // Missing indexes are informational — they do NOT block upToDate
  const missingIndexes: string[] = []
  for (const index of SENTINEL_INDEXES) {
    if (!existingIndexes.has(index.id)) {
      missingIndexes.push(index.label)
    }
  }

  return {
    status: 'connected',
    upToDate: missing.length === 0,
    missing,
    missingIndexes,
    migrationVersion: MIGRATION_VERSION,
    normalizeSlugsOnUpgrade: !caseSensitive,
  }
}

// ---------------------------------------------------------------------------
// Migration tracking
// ---------------------------------------------------------------------------

async function ensureMigrationTracking(db: DbExecutor) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id varchar(64) PRIMARY KEY NOT NULL,
      applied_at timestamp with time zone DEFAULT now()
    )
  `)
}

async function recordMigration(db: DbExecutor, id: string) {
  const escaped = id.replace(/'/g, "''")
  await db.execute(sql.raw(`
    INSERT INTO schema_migrations (id)
    VALUES ('${escaped}')
    ON CONFLICT (id) DO NOTHING
  `))
}

// ---------------------------------------------------------------------------
// Schema application (unified — handles both empty and existing databases)
// ---------------------------------------------------------------------------

async function createUpdatedAtTrigger(db: DbExecutor, warnings: string[]) {
  // Some managed/restricted PostgreSQL providers (e.g. Neon, Supabase,
  // CockroachDB, connection poolers) disallow CREATE FUNCTION / PL/pgSQL
  // for non-superusers.
  // This operation is executed outside the core transaction because PostgreSQL
  // automatically aborts a transaction on any error (even if caught in JS).
  // The trigger is a convenience that keeps updated_at current automatically;
  // application code also sets updated_at directly on updates.
  try {
    await db.execute(sql.raw(`
      CREATE OR REPLACE FUNCTION public.update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `))
  } catch (err: any) {
    warnings.push(
      `update_updated_at_column function: ${err.message || 'Unknown error'} — updated_at will not be maintained automatically by DB trigger`,
    )
    return
  }

  try {
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.links'::regclass
          AND tgname = 'update_links_updated_at'
          AND NOT tgisinternal
      ) AS exists
    `)

    if (Boolean(result.rows[0]?.exists)) {
      return
    }

    await db.execute(sql.raw(`
      CREATE TRIGGER update_links_updated_at
        BEFORE UPDATE ON public.links
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column()
    `))
  } catch (err: any) {
    warnings.push(`update_links_updated_at trigger: ${err.message || 'Unknown error'}`)
  }
}

async function hasLinksSenderIdForeignKey(db: DbExecutor): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE contype = 'f'
        AND conrelid = 'public.links'::regclass
        AND confrelid = 'public.sender_ids'::regclass
        AND conkey = ARRAY[
          (
            SELECT attnum
            FROM pg_attribute
            WHERE attrelid = 'public.links'::regclass
              AND attname = 'sender_id'
              AND NOT attisdropped
          )
        ]
    ) AS exists
  `)
  return Boolean(result.rows[0]?.exists)
}

async function ensureLinksSenderIdForeignKey(db: DbExecutor, warnings: string[]) {
  if (await hasLinksSenderIdForeignKey(db)) {
    return
  }

  try {
    await db.execute(sql.raw(`
      ALTER TABLE links ADD CONSTRAINT links_sender_id_sender_ids_id_fk
        FOREIGN KEY (sender_id) REFERENCES public.sender_ids(id)
        ON DELETE SET NULL ON UPDATE NO ACTION
    `))
  } catch (err: any) {
    // A correctly named constraint may have been created by a previous
    // attempt, or the relationship may use a provider-generated name.
    if (await hasLinksSenderIdForeignKey(db)) {
      return
    }
    warnings.push(`links.sender_id foreign key: ${err.message || 'Unknown error'}`)
  }
}

/**
 * Ensure tags.name has unique constraint
 */
async function hasTagsNameUniqueConstraint(db: DbExecutor): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE contype = 'u'
        AND conrelid = 'public.tags'::regclass
        AND conkey = ARRAY[
          (
            SELECT attnum
            FROM pg_attribute
            WHERE attrelid = 'public.tags'::regclass
              AND attname = 'name'
              AND NOT attisdropped
          )
        ]
    ) AS exists
  `)
  return Boolean(result.rows[0]?.exists)
}

async function ensureTagsNameUniqueConstraint(db: DbExecutor, warnings: string[]) {
  if (await hasTagsNameUniqueConstraint(db)) {
    return
  }

  try {
    // First remove duplicates (keep oldest)
    await db.execute(sql.raw(`
      DELETE FROM tags
      WHERE id IN (
        SELECT id
        FROM (
          SELECT 
            id,
            name,
            ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at ASC) as rn
          FROM tags
        ) t
        WHERE rn > 1
      )
    `))

    // Add unique constraint
    await db.execute(sql.raw(`
      ALTER TABLE tags ADD CONSTRAINT tags_name_unique UNIQUE (name)
    `))
  } catch (err: any) {
    // Check if constraint was added despite error
    if (await hasTagsNameUniqueConstraint(db)) {
      return
    }
    warnings.push(`tags.name unique constraint: ${err.message || 'Unknown error'}`)
  }
}

/**
 * Single unified function that applies the full schema.
 * Safe for both empty databases and existing databases with partial schema.
 *
 * 1. Creates all tables with CREATE TABLE IF NOT EXISTS
 * 2. Adds missing columns with ALTER TABLE ADD COLUMN IF NOT EXISTS
 * 3. Adds foreign keys (skipped if already present)
 * 4. Inserts default data
 * 5. Creates trigger
 */
async function applySchema(db: DbExecutor, warnings: string[]) {
  // --- Step 1: Create all tables (order matters for foreign keys) ---

  await executeStatement(db, `
    CREATE TABLE IF NOT EXISTS tags (
      id varchar(64) PRIMARY KEY NOT NULL,
      name varchar(120) NOT NULL UNIQUE,
      created_at timestamp with time zone DEFAULT now()
    )
  `, warnings, 'tags table', { critical: true })

  await executeStatement(db, `
    CREATE TABLE IF NOT EXISTS sender_ids (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name varchar(6) NOT NULL,
      description text,
      is_active boolean DEFAULT true,
      is_default boolean DEFAULT false,
      created_at timestamp with time zone DEFAULT now()
    )
  `, warnings, 'sender_ids table', { critical: true })

  await executeStatement(db, `
    CREATE UNIQUE INDEX IF NOT EXISTS sender_ids_name_unique ON sender_ids(name)
  `, warnings, 'sender_ids_name_unique index', { critical: true })

  await executeStatement(db, `
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
      click_count integer NOT NULL DEFAULT 0,
      tag_id varchar(64) REFERENCES tags(id) ON DELETE SET NULL,
      sender_id uuid REFERENCES sender_ids(id) ON DELETE SET NULL
    )
  `, warnings, 'links table', { critical: true })

  await executeStatement(db, `
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
  `, warnings, 'access_logs table', { critical: true })

  await executeStatement(db, `
    CREATE TABLE IF NOT EXISTS qr_scans (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      link_id varchar(64) REFERENCES links(id) ON DELETE CASCADE,
      slug varchar(128),
      created_at timestamp with time zone DEFAULT now()
    )
  `, warnings, 'qr_scans table', { critical: true })

  await executeStatement(db, `
    CREATE TABLE IF NOT EXISTS site_settings (
      id varchar(8) PRIMARY KEY NOT NULL,
      homepage_mode varchar(20),
      redirect_url varchar(2048),
      redirect_timeout bigint DEFAULT 3,
      bio_content jsonb,
      trai_sms_enabled boolean DEFAULT false
    )
  `, warnings, 'site_settings table', { critical: true })

  await executeStatement(db, `
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
  `, warnings, 'users table', { critical: true })

  await executeStatement(db, `
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
  `, warnings, 'audit_logs table', { critical: true })

  await executeStatement(db, `
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
  `, warnings, 'api_keys table', { critical: true })

  await executeStatement(db, `
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
  `, warnings, 'webhooks table', { critical: true })

  await executeStatement(db, `
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
  `, warnings, 'webhook_deliveries table', { critical: true })

  await executeStatement(db, `
    CREATE TABLE IF NOT EXISTS api_rate_limits (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      api_key_id uuid REFERENCES api_keys(id) ON DELETE CASCADE,
      endpoint varchar(256) NOT NULL,
      request_count bigint DEFAULT 0,
      window_start timestamp with time zone DEFAULT now(),
      created_at timestamp with time zone DEFAULT now()
    )
  `, warnings, 'api_rate_limits table', { critical: true })

  // --- Step 2: Add missing columns for existing databases ---

  // Tables are all created above, so these ALTERs cover both old installations
  // and partially provisioned schemas. They are critical: recording a version
  // while a required column is absent makes a failed upgrade look successful.
  await executeStatement(db,
    'ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS redirect_timeout bigint DEFAULT 3',
    warnings, 'site_settings.redirect_timeout', { critical: true },
  )
  await executeStatement(db,
    'ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS trai_sms_enabled boolean DEFAULT false',
    warnings, 'site_settings.trai_sms_enabled', { critical: true },
  )
  await executeStatement(db,
    `ALTER TABLE access_logs
      ADD COLUMN IF NOT EXISTS utm_source varchar(128),
      ADD COLUMN IF NOT EXISTS utm_medium varchar(128),
      ADD COLUMN IF NOT EXISTS utm_campaign varchar(128),
      ADD COLUMN IF NOT EXISTS utm_term varchar(128),
      ADD COLUMN IF NOT EXISTS utm_content varchar(128)`,
    warnings, 'access_logs UTM columns', { critical: true },
  )
  await executeStatement(db,
    'ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_encrypted text',
    warnings, 'api_keys.key_encrypted', { critical: true },
  )
  await executeStatement(db,
    'ALTER TABLE sender_ids ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false',
    warnings, 'sender_ids.is_default', { critical: true },
  )
  await executeStatement(db,
    'ALTER TABLE links ADD COLUMN IF NOT EXISTS sender_id uuid',
    warnings, 'links.sender_id', { critical: true },
  )
  await executeStatement(db,
    'ALTER TABLE links ADD COLUMN IF NOT EXISTS click_count integer NOT NULL DEFAULT 0',
    warnings, 'links.click_count', { critical: true },
  )

  // Backfill click_count from access_logs for existing databases.
  // Only runs when there are links stuck at 0 that actually have logged clicks,
  // which means the column was freshly added to an existing database.
  const needsBackfill = await db.execute(sql`
    SELECT EXISTS (
      SELECT 1
      FROM links l
      WHERE l.click_count = 0
        AND EXISTS (SELECT 1 FROM access_logs a WHERE a.link_id = l.id)
    ) AS needs
  `)
  if (Boolean(needsBackfill.rows[0]?.needs)) {
    await executeStatement(db, `
      UPDATE links SET click_count = sub.cnt
      FROM (
        SELECT link_id, COUNT(*)::int AS cnt
        FROM access_logs
        WHERE link_id IS NOT NULL
        GROUP BY link_id
      ) sub
      WHERE links.id = sub.link_id AND links.click_count = 0
    `, warnings, 'backfill links.click_count')
  }

  // --- Step 3: Add foreign keys (safe — skipped if already present) ---

  // Deferred until after the required-schema transaction so legacy data that
  // violates the new relationship cannot roll back a successful core upgrade.

  // --- Step 4: Insert default data ---

  await executeStatement(db, `
    INSERT INTO site_settings (id, homepage_mode, redirect_url, redirect_timeout, bio_content)
    VALUES (
      'default',
      'DEFAULT',
      NULL,
      3,
      '{"profile": {"name": "Syano", "bio": null, "initials": "SY", "avatar_url": null}, "links": [], "socials": []}'::jsonb
    )
    ON CONFLICT (id) DO NOTHING
  `, warnings, 'default site_settings row', { critical: true })

  // Note: updated_at trigger creation is executed outside the core transaction
  // so that environments lacking CREATE FUNCTION privileges do not abort the transaction.
}

// ---------------------------------------------------------------------------
// Index application
// ---------------------------------------------------------------------------

async function runIndexes(db: DbExecutor, warnings: string[]) {
  for (const [name, statement] of STANDARD_INDEXES) {
    await createIndexSafe(db, name, statement, warnings)
  }

  await executeStatement(db, 'DROP INDEX IF EXISTS idx_sender_ids_name_unique', warnings, 'legacy sender_ids_name_unique index cleanup')
  await executeStatement(db, 'DROP INDEX IF EXISTS idx_links_slug_lower', warnings, 'drop idx_links_slug_lower')

  for (const [name, statement] of PERFORMANCE_INDEXES) {
    await createIndexSafe(db, name, statement, warnings)
  }
}

// ---------------------------------------------------------------------------
// Data normalization
// ---------------------------------------------------------------------------

async function normalizeLinkSlugs(db: DbExecutor, warnings: string[]) {
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
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

async function analyzeTables(db: DbExecutor, warnings: string[]) {
  for (const table of ['links', 'access_logs', 'qr_scans', 'tags', 'api_keys', 'api_rate_limits'] as const) {
    if (!(await tableExists(db, table))) {
      continue
    }
    await executeStatement(db, `ANALYZE ${table}`, warnings, `ANALYZE ${table}`)
  }
}

// ---------------------------------------------------------------------------
// Upgrade lock
// ---------------------------------------------------------------------------

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

async function isAdvisoryLockSupported(db: DbExecutor): Promise<boolean> {
  try {
    const result = await db.execute(sql`
      SELECT pg_try_advisory_lock(${DATABASE_UPGRADE_LOCK_KEY}::bigint) AS locked
    `)
    if (Boolean(result.rows[0]?.locked)) {
      await db.execute(sql`
        SELECT pg_advisory_unlock(${DATABASE_UPGRADE_LOCK_KEY}::bigint)
      `)
    }
    return true
  } catch {
    return false
  }
}

async function acquireDatabaseUpgradeLock(db: DbExecutor) {
  const result = await db.execute(sql`
    SELECT pg_try_advisory_xact_lock(${DATABASE_UPGRADE_LOCK_KEY}::bigint) AS locked
  `)

  if (!Boolean(result.rows[0]?.locked)) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Database upgrade already in progress',
      message: 'Another application instance is upgrading this database. Wait for it to finish and try again.',
    })
  }
}

// ---------------------------------------------------------------------------
// Main upgrade entry point
// ---------------------------------------------------------------------------

export async function runDatabaseUpgrade(db: DrizzleDb, caseSensitive: boolean): Promise<UpgradeResult> {
  const warnings: string[] = []

  const freshInstall = !(await hasApplicationSchema(db))
  const advisoryLockSupported = await isAdvisoryLockSupported(db)

  // PostgreSQL DDL is transactional. Keeping required schema work and the
  // migration marker in one transaction guarantees that a failed fresh
  // install leaves no half-applied Syano schema or misleading version record.
  // Best-effort indexes run afterwards: PostgreSQL marks a transaction failed
  // after any index error, even when that error is caught in application code.
  await db.transaction(async (tx) => {
    if (advisoryLockSupported) {
      await acquireDatabaseUpgradeLock(tx)
    }
    await ensureMigrationTracking(tx)
    await applySchema(tx, warnings)

    if (!caseSensitive) {
      await normalizeLinkSlugs(tx, warnings)
    }

    if (freshInstall) {
      await recordMigration(tx, 'base_schema')
    }
    await recordMigration(tx, `v${MIGRATION_VERSION}`)
  })

  // PostgreSQL marks an entire transaction aborted upon any error, even if
  // caught in application code. Non-critical features like triggers/functions,
  // foreign keys over existing data, and indexes run outside the core transaction.
  await createUpdatedAtTrigger(db, warnings)
  await ensureLinksSenderIdForeignKey(db, warnings)
  await ensureTagsNameUniqueConstraint(db, warnings)

  await runIndexes(db, warnings)

  // ANALYZE is deliberately outside the schema transaction. Its failure only
  // affects planner statistics, never the validity of the applied schema.
  await analyzeTables(db, warnings)

  // Post-upgrade validation: re-check schema to provide accurate status
  let schemaCheck: SchemaCheckResult | undefined
  try {
    schemaCheck = await checkSchema(db, caseSensitive)
  } catch {
    // Non-critical — the upgrade itself succeeded
  }

  const message = freshInstall
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
    appliedBaseSchema: freshInstall,
    migrationVersion: MIGRATION_VERSION,
    schemaCheck,
  }
}
