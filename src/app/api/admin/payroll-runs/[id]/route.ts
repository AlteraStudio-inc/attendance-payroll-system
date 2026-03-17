import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/admin/payroll-runs/[id] - Get payroll run with all items
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params

    const payrollRun = await prisma.payrollRun.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true } },
        payrollItems: {
          include: {
            employee: {
              select: {
                id: true,
                employeeCode: true,
                name: true,
                department: { select: { id: true, code: true, name: true } },
              },
            },
          },
          orderBy: { employee: { employeeCode: 'asc' } },
        },
      },
    })

    if (!payrollRun) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '給与計算が見つかりません' } },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: payrollRun })
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
