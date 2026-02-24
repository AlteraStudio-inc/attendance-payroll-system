import { prisma } from './prisma'
import { type AuthUser } from './auth'

export type AuditAction =
    | 'CREATE'
    | 'UPDATE'
    | 'DELETE'
    | 'LOGIN'
    | 'LOGOUT'
    | 'CLOCK_IN'
    | 'CLOCK_OUT'
    | 'APPROVE'
    | 'REJECT'
    | 'CONFIRM'
    | 'REVERT'
    | 'BULK_SEND'
    | 'RETRY'

export interface AuditLogData {
    userId: string
    action: AuditAction
    targetType: string
    targetId: string
    oldValue?: Record<string, unknown> | null
    newValue?: Record<string, unknown> | null
    ipAddress?: string | null
}

// 監査ログを作成（SQLite対応: オブジェクトをJSON文字列に変換）
export async function createAuditLog(data: AuditLogData): Promise<void> {
    await prisma.auditLog.create({
        data: {
            userId: data.userId,
            action: data.action,
            targetType: data.targetType,
            targetId: data.targetId,
            oldValue: data.oldValue ? JSON.stringify(data.oldValue) : null,
            newValue: data.newValue ? JSON.stringify(data.newValue) : null,
            ipAddress: data.ipAddress ?? null,
        },
    })
}

// リクエストからIPアドレスを取得
export function getIpAddress(request: Request): string | null {
    const forwarded = request.headers.get('x-forwarded-for')
    if (forwarded) {
        return forwarded.split(',')[0].trim()
    }
    return request.headers.get('x-real-ip') ?? null
}

// ユーザー情報から監査ログを作成するヘルパー
export async function logAction(
    user: AuthUser,
    action: AuditAction,
    targetType: string,
    targetId: string,
    options?: {
        oldValue?: Record<string, unknown> | null
        newValue?: Record<string, unknown> | null
        ipAddress?: string | null
    }
): Promise<void> {
    await createAuditLog({
        userId: user.id,
        action,
        targetType,
        targetId,
        oldValue: options?.oldValue,
        newValue: options?.newValue,
        ipAddress: options?.ipAddress,
    })
}
