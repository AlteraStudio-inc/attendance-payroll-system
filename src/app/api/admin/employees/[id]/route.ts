import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { logAction } from '@/lib/audit'
import { prisma } from '@/lib/prisma'

// GET /api/admin/employees/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        department: true,
        user: { select: { id: true, email: true, role: true, isActive: true, lastLoginAt: true } },
        salarySettings: { orderBy: { effectiveFrom: 'desc' } },
        allowances: { include: { allowanceType: true } },
      },
    })

    if (!employee) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '従業員が見つかりません' } },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: employee })
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

// PATCH /api/admin/employees/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdmin()
    const { id } = await params
    const body = await request.json()

    const existing = await prisma.employee.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '従業員が見つかりません' } },
        { status: 404 }
      )
    }

    // Prevent updating fields that should not be changed via this endpoint
    const { salarySetting: _ignoredSalarySetting, password: _ignoredPwd, ...employeeData } = body

    // Handle date fields
    if (employeeData.joinDate) employeeData.joinDate = new Date(employeeData.joinDate)
    if (employeeData.leaveDate) employeeData.leaveDate = new Date(employeeData.leaveDate)

    const updated = await prisma.employee.update({
      where: { id },
      data: employeeData,
      include: {
        department: { select: { id: true, code: true, name: true } },
        user: { select: { id: true, email: true, role: true, isActive: true } },
      },
    })

    await logAction(user, 'UPDATE_EMPLOYEE', 'employee', id, {
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
        { success: false, error: { code: 'CONFLICT', message: '従業員コードが既に存在します' } },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/employees/[id] - Logical delete (set active = false)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdmin()
    const { id } = await params

    const existing = await prisma.employee.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '従業員が見つかりません' } },
        { status: 404 }
      )
    }

    const updated = await prisma.employee.update({
      where: { id },
      data: {
        active: false,
        leaveDate: existing.leaveDate ?? new Date(),
      },
    })

    // Also deactivate user account
    await prisma.user.updateMany({
      where: { employeeId: id },
      data: { isActive: false },
    })

    await logAction(user, 'DEACTIVATE_EMPLOYEE', 'employee', id, {
      beforeJson: { active: existing.active },
      afterJson: { active: false },
    })

    return NextResponse.json({ success: true, data: { id, active: false } })
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
