import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { logAction } from '@/lib/audit'
import { prisma } from '@/lib/prisma'

// POST /api/admin/payroll-runs/[id]/finalize
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdmin()
    const { id } = await params

    const payrollRun = await prisma.payrollRun.findUnique({ where: { id } })
    if (!payrollRun) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '給与計算が見つかりません' } },
        { status: 404 }
      )
    }

    if (payrollRun.status === 'finalized') {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message: 'この給与計算は既に確定済みです' } },
        { status: 409 }
      )
    }

    if (payrollRun.status !== 'calculated') {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message: '確定するには先に給与計算を実行してください (status: calculated が必要)' } },
        { status: 409 }
      )
    }

    const updated = await prisma.payrollRun.update({
      where: { id },
      data: {
        status: 'finalized',
        finalizedAt: new Date(),
        finalizedBy: user.id,
      },
    })

    await logAction(user, 'FINALIZE_PAYROLL', 'payroll_run', id, {
      beforeJson: { status: payrollRun.status },
      afterJson: { status: 'finalized', finalizedAt: updated.finalizedAt?.toISOString() },
    })

    return NextResponse.json({ success: true, data: updated })
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
