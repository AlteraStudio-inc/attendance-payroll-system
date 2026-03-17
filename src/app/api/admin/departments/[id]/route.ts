import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { logAction } from '@/lib/audit'
import { prisma } from '@/lib/prisma'

// GET /api/admin/departments/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params

    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true } },
        _count: { select: { employees: true } },
      },
    })

    if (!department) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '部門が見つかりません' } },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: department })
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

// PATCH /api/admin/departments/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdmin()
    const { id } = await params
    const body = await request.json()

    const existing = await prisma.department.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '部門が見つかりません' } },
        { status: 404 }
      )
    }

    const department = await prisma.department.update({
      where: { id },
      data: body,
    })

    await logAction(user, 'UPDATE_DEPARTMENT', 'department', id, {
      beforeJson: existing as Record<string, unknown>,
      afterJson: department as Record<string, unknown>,
    })

    return NextResponse.json({ success: true, data: department })
  } catch (error: any) {
    if (error.message.includes('権限') || error.message.includes('認証')) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: error.message } },
        { status: 401 }
      )
    }
    if (error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message: '部門コードが既に存在します' } },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/departments/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdmin()
    const { id } = await params

    const existing = await prisma.department.findUnique({
      where: { id },
      include: { _count: { select: { employees: true } } },
    })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '部門が見つかりません' } },
        { status: 404 }
      )
    }

    if (existing._count.employees > 0) {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message: 'この部門には従業員が所属しているため削除できません' } },
        { status: 409 }
      )
    }

    await prisma.department.delete({ where: { id } })

    await logAction(user, 'DELETE_DEPARTMENT', 'department', id, {
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
