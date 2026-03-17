import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/admin/audit-logs?actorId=...&targetType=...&targetId=...&action=...&from=...&to=...&page=...&limit=...
export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const actorId = searchParams.get('actorId')
    const actorType = searchParams.get('actorType')
    const targetType = searchParams.get('targetType')
    const targetId = searchParams.get('targetId')
    const action = searchParams.get('action')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50')))

    const where: any = {}
    if (actorId) where.actorId = actorId
    if (actorType) where.actorType = actorType
    if (targetType) where.targetType = targetType
    if (targetId) where.targetId = targetId
    if (action) where.action = { contains: action, mode: 'insensitive' }

    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = new Date(from)
      if (to) {
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999)
        where.createdAt.lte = toDate
      }
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: {
          actor: {
            select: {
              id: true,
              email: true,
              role: true,
              employee: { select: { id: true, employeeCode: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    // Parse JSON fields for response convenience
    const logsWithParsed = logs.map((log) => ({
      ...log,
      beforeJson: log.beforeJson ? (() => {
        try { return JSON.parse(log.beforeJson) } catch { return log.beforeJson }
      })() : null,
      afterJson: log.afterJson ? (() => {
        try { return JSON.parse(log.afterJson) } catch { return log.afterJson }
      })() : null,
      metadataJson: log.metadataJson ? (() => {
        try { return JSON.parse(log.metadataJson) } catch { return log.metadataJson }
      })() : null,
    }))

    return NextResponse.json({
      success: true,
      data: {
        logs: logsWithParsed,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error: any) {
    if (error.message.includes('権限') || error.message.includes('認証')) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: error.message } },
        { status: 401 }
      )
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    )
  }
}
