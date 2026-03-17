import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { logAction } from '@/lib/audit'
import { prisma } from '@/lib/prisma'

// PATCH /api/admin/statutory-rates/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdmin()
    const { id } = await params
    const body = await request.json()

    const existing = await prisma.statutoryRateMaster.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '法定控除率が見つかりません' } },
        { status: 404 }
      )
    }

    const updateData: any = { ...body }
    if (updateData.effectiveFrom) updateData.effectiveFrom = new Date(updateData.effectiveFrom)
    if (updateData.effectiveTo) updateData.effectiveTo = new Date(updateData.effectiveTo)

    const updated = await prisma.statutoryRateMaster.update({
      where: { id },
      data: updateData,
    })

    await logAction(user, 'UPDATE_STATUTORY_RATE', 'statutory_rate_master', id, {
      beforeJson: existing as Record<string, unknown>,
      afterJson: updated as Record<string, unknown>,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error: any) {
    if (error.message.includes('権限') || error.message.includes('認証')) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: error.message } },
        { status: 401 }
      )
    }
    if (error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message: 'この年度の法定控除率は既に登録されています' } },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    )
  }
}
