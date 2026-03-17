import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { logAction } from '@/lib/audit'
import { prisma } from '@/lib/prisma'

// GET /api/admin/attendance/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params

    const record = await prisma.attendanceRecord.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            name: true,
            department: { select: { id: true, code: true, name: true } },
          },
        },
        attendanceAdjustmentRequests: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!record) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '勤怠記録が見つかりません' } },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: record })
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

// PATCH /api/admin/attendance/[id] - Update with audit log
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdmin()
    const { id } = await params
    const body = await request.json()

    const existing = await prisma.attendanceRecord.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '勤怠記録が見つかりません' } },
        { status: 404 }
      )
    }

    // Parse datetime fields if provided as strings
    const updateData: any = { ...body }
    if (updateData.clockInAt && typeof updateData.clockInAt === 'string') {
      updateData.clockInAt = new Date(updateData.clockInAt)
    }
    if (updateData.clockOutAt && typeof updateData.clockOutAt === 'string') {
      updateData.clockOutAt = new Date(updateData.clockOutAt)
    }

    const updated = await prisma.attendanceRecord.update({
      where: { id },
      data: updateData,
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            name: true,
          },
        },
      },
    })

    // Record audit log with before/after
    await logAction(user, 'UPDATE_ATTENDANCE', 'attendance_record', id, {
      beforeJson: {
        clockInAt: existing.clockInAt?.toISOString() ?? null,
        clockOutAt: existing.clockOutAt?.toISOString() ?? null,
        breakMinutes: existing.breakMinutes,
        workedMinutesRaw: existing.workedMinutesRaw,
        workedMinutesNet: existing.workedMinutesNet,
        lateMinutes: existing.lateMinutes,
        earlyLeaveMinutes: existing.earlyLeaveMinutes,
        absenceMinutes: existing.absenceMinutes,
        normalOvertimeMinutes: existing.normalOvertimeMinutes,
        status: existing.status,
        notes: existing.notes,
      },
      afterJson: {
        clockInAt: updated.clockInAt?.toISOString() ?? null,
        clockOutAt: updated.clockOutAt?.toISOString() ?? null,
        breakMinutes: updated.breakMinutes,
        workedMinutesRaw: updated.workedMinutesRaw,
        workedMinutesNet: updated.workedMinutesNet,
        lateMinutes: updated.lateMinutes,
        earlyLeaveMinutes: updated.earlyLeaveMinutes,
        absenceMinutes: updated.absenceMinutes,
        normalOvertimeMinutes: updated.normalOvertimeMinutes,
        status: updated.status,
        notes: updated.notes,
      },
      metadataJson: {
        employeeId: existing.employeeId,
        workDate: existing.workDate.toISOString(),
      },
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
