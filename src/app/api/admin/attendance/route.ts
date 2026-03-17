import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/admin/attendance?year=...&month=...&employeeId=...&departmentId=...&page=...&limit=...
export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
    const month = searchParams.get('month')
    const employeeId = searchParams.get('employeeId')
    const departmentId = searchParams.get('departmentId')
    const status = searchParams.get('status')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50')))

    const where: any = {}

    if (year && month) {
      const y = parseInt(year)
      const m = parseInt(month)
      const startDate = new Date(y, m - 1, 1)
      const endDate = new Date(y, m, 0)
      endDate.setHours(23, 59, 59, 999)
      where.workDate = { gte: startDate, lte: endDate }
    }

    if (employeeId) {
      where.employeeId = employeeId
    }

    if (status) {
      where.status = status
    }

    if (departmentId) {
      where.employee = { departmentId }
    }

    const [total, records] = await Promise.all([
      prisma.attendanceRecord.count({ where }),
      prisma.attendanceRecord.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              name: true,
              departmentId: true,
              department: { select: { id: true, code: true, name: true } },
            },
          },
        },
        orderBy: [{ workDate: 'desc' }, { employee: { employeeCode: 'asc' } }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        records,
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
