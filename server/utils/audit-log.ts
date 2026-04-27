import type { H3Event } from 'h3'
import { getRequestIP } from 'h3'
import { useDrizzle } from '~/server/utils/db'
import { audit_logs } from '~/server/database/schema'
import type { AuthUser } from '~/server/utils/auth'

// ── Types ─────────────────────────────────────────────────

export type AuditAction = 'create' | 'update' | 'delete'

export type AuditEntityType =
  | 'link'
  | 'tag'
  | 'user'
  | 'settings'

export interface AuditEntry {
  actor: AuthUser
  action: AuditAction
  entityType: AuditEntityType
  entityId?: string
  entityLabel?: string
  details?: Record<string, unknown>
}

// ── Recording ─────────────────────────────────────────────

/**
 * Record an immutable audit log entry.
 * This runs fire-and-forget so it never blocks the primary request flow.
 */
export function recordAudit(event: H3Event, entry: AuditEntry): void {
  const ip = getRequestIP(event, { xForwardedFor: true }) || null

  // Fire-and-forget – errors are logged but never propagated
  _writeAudit(event, entry, ip).catch((err) => {
    console.error('[Audit] Failed to write audit log:', err)
  })
}

async function _writeAudit(event: H3Event, entry: AuditEntry, ip: string | null) {
  const db = await useDrizzle(event)

  await db.insert(audit_logs).values({
    actor_id: entry.actor.id,
    actor_username: entry.actor.displayName || entry.actor.username,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    entity_label: entry.entityLabel ?? null,
    details: entry.details ?? null,
    ip: ip,
  })
}
