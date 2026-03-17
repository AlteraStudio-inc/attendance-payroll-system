import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { logAction } from '@/lib/audit'
import { prisma } from '@/lib/prisma'

// GET /api/admin/allowance-types/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params

    const allowanceType = await prisma.allowanceType.findUnique({
      where: { id },
      include: {
        _count: { select: { employeeAllowances: true } },
      },
    })

    if (!allowanceType) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '手当種別が見つかりません' } },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: allowanceType })
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

// PATCH /api/admin/allowance-types/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdmin()
    const { id } = await params
    const body = await request.json()

    const existing = await prisma.allowanceType.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '手当種別が見つかりません' } },
        { status: 404 }
      )
    }

    const allowanceType = await prisma.allowanceType.update({
      where: { id },
      data: body,
    })

    await logAction(user, 'UPDATE_ALLOWANCE_TYPE', 'allowance_type', id, {
      beforeJson: existing as Record<string, unknown>,
      afterJson: allowanceType as Record<string, unknown>,
    })

    return NextResponse.json({ success: true, data: allowanceType })
  } catch (error: any) {
    if (error.message.includes('権限') || error.message.includes('認証')) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: error.message } },
        { status: 401 }
      )
    }
    if (error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message: '手当コードが既に存在します' } },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/allowance-types/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdmin()
    const { id } = await params

    const existing = await prisma.allowanceType.findUnique({
      where: { id },
      include: { _count: { select: { employeeAllowances: true } } },
    })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '手当種別が見つかりません' } },
        { status: 404 }
      )
    }

    if (existing._count.employeeAllowances > 0) {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message: 'この手当種別は従業員手当で使用されているため削除できません' } },
        { status: 409 }
      )
    }

    await prisma.allowanceType.delete({ where: { id } })

    await logAction(user, 'DELETE_ALLOWANCE_TYPE', 'allowance_type', id, {
      beforeJson: existing as Record<string, unknown>,
    })

    return NextResponse.json({ success: true, data: { id } })
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
