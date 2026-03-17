import { prisma } from './prisma'
import type { AuthUser } from './auth'
import type { ActorType } from '@prisma/client'

export interface AuditLogData {
  actorType: ActorType
  actorId: string
  action: string
  targetType: string
  targetId: string
  beforeJson?: Record<string, unknown> | null
  afterJson?: Record<string, unknown> | null
  metadataJson?: Record<string, unknown> | null
}

export async function createAuditLog(data: AuditLogData): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorType: data.actorType,
      actorId: data.actorId,
      action: data.action,
      targetType: data.targetType,
      targetId: data.targetId,
      beforeJson: data.beforeJson ? JSON.stringify(data.beforeJson) : null,
      afterJson: data.afterJson ? JSON.stringify(data.afterJson) : null,
      metadataJson: data.metadataJson ? JSON.stringify(data.metadataJson) : null,
    },
  })
}

export async function logAction(
  user: AuthUser,
  action: string,
  targetType: string,
  targetId: string,
  options?: {
    beforeJson?: Record<string, unknown> | null
    afterJson?: Record<string, unknown> | null
    metadataJson?: Record<string, unknown> | null
  }
): Promise<void> {
  await createAuditLog({
    actorType: user.role === 'admin' ? 'admin' : 'employee',
    actorId: user.id,
    action,
    targetType,
    targetId,
    beforeJson: options?.beforeJson,
    afterJson: options?.afterJson,
    metadataJson: options?.metadataJson,
  })
}
