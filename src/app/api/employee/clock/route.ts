import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { logAction } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { calculateAttendance, type DepartmentSettings } from '@/server/services/attendance/AttendanceCalculationService'

// POST /api/employee/clock - 出勤/退勤
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    if (!user.employeeId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: '従業員情報がありません' } },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { type, note } = body

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const employee = await prisma.employee.findUnique({
      where: { id: user.employeeId },
      include: { department: true },
    })
    if (!employee) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '従業員が見つかりません' } },
        { status: 404 }
      )
    }

    if (type === 'clock_in') {
      const existing = await prisma.attendanceRecord.findUnique({
        where: { employeeId_workDate: { employeeId: employee.id, workDate: today } },
      })
      if (existing) {
        return NextResponse.json(
          { success: false, error: { code: 'DUPLICATE', message: '本日は既に出勤打刻済みです' } },
          { status: 409 }
        )
      }

      const record = await prisma.attendanceRecord.create({
        data: {
          employeeId: employee.id,
          workDate: today,
          clockInAt: now,
          breakMinutes: employee.department.breakMinutes,
          status: 'draft',
          notes: note || null,
        },
      })

      await logAction(user, 'CLOCK_IN', 'attendance_record', record.id)

      return NextResponse.json({ success: true, data: { record }, message: '出勤打刻しました' })
    }

    if (type === 'clock_out') {
      const existing = await prisma.attendanceRecord.findUnique({
        where: { employeeId_workDate: { employeeId: employee.id, workDate: today } },
      })
      if (!existing) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: '本日の出勤記録がありません' } },
          { status: 404 }
        )
      }
      if (existing.clockOutAt) {
        return NextResponse.json(
          { success: false, error: { code: 'DUPLICATE', message: '本日は既に退勤打刻済みです' } },
          { status: 409 }
        )
      }

      const dept = employee.department
      const schedule = await prisma.workSchedule.findFirst({
        where: {
          companyId: employee.companyId,
          targetDate: today,
          OR: [{ departmentId: employee.departmentId }, { departmentId: null }],
        },
        orderBy: { departmentId: 'desc' },
      })

      const dayType = schedule?.dayType ?? 'business_day'
      const deptSettings: DepartmentSettings = {
        startTime: dept.startTime,
        endTime: dept.endTime,
        breakStartTime: dept.breakStartTime,
        breakEndTime: dept.breakEndTime,
        breakMinutes: dept.breakMinutes,
        scheduledWorkMinutesPerDay: dept.scheduledWorkMinutesPerDay,
        allowWithinScheduledOvertime: dept.allowWithinScheduledOvertime,
        overtimeBoundaryType: dept.overtimeBoundaryType,
        overtimeBoundaryMinutes: dept.overtimeBoundaryMinutes,
        lateDeductionStartTime: dept.lateDeductionStartTime,
        earlyLeaveDeductionBeforeTime: dept.earlyLeaveDeductionBeforeTime,
        noEarlyLeaveDeductionAfterTime: dept.noEarlyLeaveDeductionAfterTime,
        lateNightEnabled: dept.lateNightEnabled,
      }

      const calc = calculateAttendance(deptSettings, {
        clockInAt: existing.clockInAt!,
        clockOutAt: now,
        dayType: dayType as any,
      })

      const record = await prisma.attendanceRecord.update({
        where: { id: existing.id },
        data: {
          clockOutAt: now,
          breakMinutes: calc.breakMinutes,
          workedMinutesRaw: calc.workedMinutesRaw,
          workedMinutesNet: calc.workedMinutesNet,
          lateMinutes: calc.lateMinutes,
          earlyLeaveMinutes: calc.earlyLeaveMinutes,
          absenceMinutes: calc.absenceMinutes,
          withinScheduledOvertimeMinutes: calc.withinScheduledOvertimeMinutes,
          normalOvertimeMinutes: calc.normalOvertimeMinutes,
          scheduledHolidayMinutes: calc.scheduledHolidayMinutes,
          legalHolidayMinutes: calc.legalHolidayMinutes,
          lateNightMinutes: calc.lateNightMinutes,
          notes: note ? `${existing.notes ?? ''}\n${note}`.trim() : existing.notes,
        },
      })

      await logAction(user, 'CLOCK_OUT', 'attendance_record', record.id)

      return NextResponse.json({ success: true, data: { record }, message: '退勤打刻しました' })
    }

    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'typeは clock_in または clock_out を指定してください' } },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('Clock error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const user = await requireAuth()
    if (!user.employeeId) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: '従業員情報がありません' } }, { status: 403 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const record = await prisma.attendanceRecord.findUnique({
      where: { employeeId_workDate: { employeeId: user.employeeId, workDate: today } },
    })

    return NextResponse.json({
      success: true,
      data: {
        record,
        status: !record ? 'not_clocked_in' : !record.clockOutAt ? 'clocked_in' : 'clocked_out',
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    )
  }
}
