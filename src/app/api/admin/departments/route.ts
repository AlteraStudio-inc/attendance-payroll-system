import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { logAction } from '@/lib/audit'
import { prisma } from '@/lib/prisma'

// GET /api/admin/departments - List all departments
export async function GET() {
  try {
    const user = await requireAdmin()

    const departments = await prisma.department.findMany({
      include: {
        company: { select: { id: true, name: true } },
        _count: { select: { employees: true } },
      },
      orderBy: { code: 'asc' },
    })

    return NextResponse.json({ success: true, data: departments })
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

// POST /api/admin/departments - Create a department
export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin()
    const body = await request.json()

    const {
      companyId,
      code,
      name,
      startTime,
      endTime,
      breakStartTime,
      breakEndTime,
      breakMinutes,
      scheduledWorkMinutesPerDay,
      annualWorkDays,
      annualHolidays,
      annualWorkMinutes,
      monthlyAverageWorkMinutes,
      allowWithinScheduledOvertime,
      overtimeBoundaryType,
      overtimeBoundaryMinutes,
      lateDeductionStartTime,
      earlyLeaveDeductionBeforeTime,
      noEarlyLeaveDeductionAfterTime,
      fixedOvertimeEnabled,
      fixedOvertimeMinutes,
      fixedOvertimeAllowanceName,
      averageWorkTimeRoundingRule,
      payRoundingRule,
      deductionRoundingRule,
      lateNightEnabled,
      notes,
    } = body

    if (!companyId || !code || !name || !startTime || !endTime) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: '必須項目が不足しています' } },
        { status: 400 }
      )
    }

    const department = await prisma.department.create({
      data: {
        companyId,
        code,
        name,
        startTime,
        endTime,
        breakStartTime: breakStartTime ?? null,
        breakEndTime: breakEndTime ?? null,
        breakMinutes: breakMinutes ?? 60,
        scheduledWorkMinutesPerDay: scheduledWorkMinutesPerDay ?? 480,
        annualWorkDays: annualWorkDays ?? 260,
        annualHolidays: annualHolidays ?? 105,
        annualWorkMinutes: annualWorkMinutes ?? 124800,
        monthlyAverageWorkMinutes: monthlyAverageWorkMinutes ?? 10400,
        allowWithinScheduledOvertime: allowWithinScheduledOvertime ?? false,
        overtimeBoundaryType: overtimeBoundaryType ?? 'daily_8h',
        overtimeBoundaryMinutes: overtimeBoundaryMinutes ?? null,
        lateDeductionStartTime: lateDeductionStartTime ?? startTime,
        earlyLeaveDeductionBeforeTime: earlyLeaveDeductionBeforeTime ?? endTime,
        noEarlyLeaveDeductionAfterTime: noEarlyLeaveDeductionAfterTime ?? null,
        fixedOvertimeEnabled: fixedOvertimeEnabled ?? false,
        fixedOvertimeMinutes: fixedOvertimeMinutes ?? 0,
        fixedOvertimeAllowanceName: fixedOvertimeAllowanceName ?? null,
        averageWorkTimeRoundingRule: averageWorkTimeRoundingRule ?? 'floor',
        payRoundingRule: payRoundingRule ?? 'round',
        deductionRoundingRule: deductionRoundingRule ?? 'floor',
        lateNightEnabled: lateNightEnabled ?? false,
        notes: notes ?? null,
      },
    })

    await logAction(user, 'CREATE_DEPARTMENT', 'department', department.id, {
      afterJson: { code, name },
    })

    return NextResponse.json({ success: true, data: department }, { status: 201 })
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
