import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { logAction } from '@/lib/audit'
import { prisma } from '@/lib/prisma'

// GET /api/admin/work-schedules?companyId=...&year=...&month=...&departmentId=...
export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    const year = searchParams.get('year')
    const month = searchParams.get('month')
    const departmentId = searchParams.get('departmentId')

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'companyId は必須です' } },
        { status: 400 }
      )
    }

    const where: any = { companyId }

    if (year && month) {
      const y = parseInt(year)
      const m = parseInt(month)
      const startDate = new Date(y, m - 1, 1)
      const endDate = new Date(y, m, 0)
      endDate.setHours(23, 59, 59, 999)
      where.targetDate = { gte: startDate, lte: endDate }
    }

    if (departmentId) {
      where.OR = [
        { departmentId },
        { departmentId: null },
      ]
    }

    const workSchedules = await prisma.workSchedule.findMany({
      where,
      include: {
        department: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ targetDate: 'asc' }, { departmentId: 'asc' }],
    })

    return NextResponse.json({ success: true, data: workSchedules })
  } catch (error: any) {
    if (error.message?.includes('権限') || error.message?.includes('認証')) {
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

// POST /api/admin/work-schedules - Upsert one or multiple schedules
export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin()
    const body = await request.json()

    const entries: Array<{
      companyId: string
      departmentId?: string | null
      targetDate: string
      dayType: string
      note?: string | null
    }> = Array.isArray(body) ? body : [body]

    if (entries.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'スケジュールデータが空です' } },
        { status: 400 }
      )
    }

    // Use findFirst + create/update to handle nullable departmentId in compound unique
    const results = []
    for (const entry of entries) {
      const deptId = entry.departmentId ?? null
      const targetDate = new Date(entry.targetDate)

      const existing = await prisma.workSchedule.findFirst({
        where: {
          companyId: entry.companyId,
          departmentId: deptId,
          targetDate,
        },
      })

      let result
      if (existing) {
        result = await prisma.workSchedule.update({
          where: { id: existing.id },
          data: {
            dayType: entry.dayType as any,
            note: entry.note ?? null,
          },
        })
      } else {
        result = await prisma.workSchedule.create({
          data: {
            companyId: entry.companyId,
            departmentId: deptId,
            targetDate,
            dayType: entry.dayType as any,
            note: entry.note ?? null,
          },
        })
      }
      results.push(result)
    }

    await logAction(user, 'UPSERT_WORK_SCHEDULES', 'work_schedule', 'batch', {
      metadataJson: { count: results.length },
    })

    return NextResponse.json({ success: true, data: results }, { status: 201 })
  } catch (error: any) {
    if (error.message?.includes('権限') || error.message?.includes('認証')) {
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
