import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { logAction } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { calculateMonthlyPayroll } from '@/server/services/payroll/PayrollCalculationService'

// POST /api/admin/payroll-runs/calculate
// Body: { companyId, year, month, departmentId?, employeeId? }
export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin()
    const body = await request.json()

    const { companyId, year, month, departmentId, employeeId } = body

    if (!companyId || !year || !month) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: '必須項目が不足しています (companyId, year, month)' } },
        { status: 400 }
      )
    }

    const y = parseInt(year)
    const m = parseInt(month)

    if (m < 1 || m > 12) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: '月は1〜12の範囲で指定してください' } },
        { status: 400 }
      )
    }

    // Run payroll calculation
    const results = await calculateMonthlyPayroll(companyId, y, m, departmentId, employeeId)

    // Upsert PayrollRun header
    const payrollRun = await prisma.payrollRun.upsert({
      where: { companyId_year_month: { companyId, year: y, month: m } },
      create: {
        companyId,
        year: y,
        month: m,
        status: 'calculated',
        calculatedAt: new Date(),
      },
      update: {
        status: 'calculated',
        calculatedAt: new Date(),
      },
    })

    // Save PayrollItem results (upsert per employee)
    const savedItems = await prisma.$transaction(
      results.map((item) =>
        prisma.payrollItem.upsert({
          where: {
            payrollRunId_employeeId: {
              payrollRunId: payrollRun.id,
              employeeId: item.employeeId,
            },
          },
          create: {
            payrollRunId: payrollRun.id,
            employeeId: item.employeeId,
            departmentSnapshotJson: item.departmentSnapshotJson,
            salarySettingSnapshotJson: item.salarySettingSnapshotJson,
            baseHourlyWage: item.baseHourlyWage,
            baseSalary: item.baseSalary,
            allowanceTotal: item.allowanceTotal,
            fixedOvertimeAllowance: item.fixedOvertimeAllowance,
            withinScheduledOvertimePay: item.withinScheduledOvertimePay,
            overtimePay: item.overtimePay,
            scheduledHolidayPay: item.scheduledHolidayPay,
            legalHolidayPay: item.legalHolidayPay,
            lateNightPay: item.lateNightPay,
            incentivePay: item.incentivePay,
            commutingPay: item.commutingPay,
            grossPay: item.grossPay,
            lateDeduction: item.lateDeduction,
            earlyLeaveDeduction: item.earlyLeaveDeduction,
            absenceDeduction: item.absenceDeduction,
            healthInsurance: item.healthInsurance,
            nursingCareInsurance: item.nursingCareInsurance,
            welfarePension: item.welfarePension,
            employmentInsurance: item.employmentInsurance,
            incomeTax: item.incomeTax,
            residentTax: item.residentTax,
            otherDeductions: item.otherDeductions,
            totalDeductions: item.totalDeductions,
            netPay: item.netPay,
            fixedOvertimeMinutes: item.fixedOvertimeMinutes,
            fixedOvertimeExcessMinutes: item.fixedOvertimeExcessMinutes,
            fixedOvertimeExcessPay: item.fixedOvertimeExcessPay,
            totalWorkDays: item.totalWorkDays,
            totalWorkedMinutes: item.totalWorkedMinutes,
            totalOvertimeMinutes: item.totalOvertimeMinutes,
            totalLateNightMinutes: item.totalLateNightMinutes,
            totalHolidayMinutes: item.totalHolidayMinutes,
            totalLateMinutes: item.totalLateMinutes,
            totalEarlyLeaveMinutes: item.totalEarlyLeaveMinutes,
            totalAbsenceMinutes: item.totalAbsenceMinutes,
          },
          update: {
            departmentSnapshotJson: item.departmentSnapshotJson,
            salarySettingSnapshotJson: item.salarySettingSnapshotJson,
            baseHourlyWage: item.baseHourlyWage,
            baseSalary: item.baseSalary,
            allowanceTotal: item.allowanceTotal,
            fixedOvertimeAllowance: item.fixedOvertimeAllowance,
            withinScheduledOvertimePay: item.withinScheduledOvertimePay,
            overtimePay: item.overtimePay,
            scheduledHolidayPay: item.scheduledHolidayPay,
            legalHolidayPay: item.legalHolidayPay,
            lateNightPay: item.lateNightPay,
            incentivePay: item.incentivePay,
            commutingPay: item.commutingPay,
            grossPay: item.grossPay,
            lateDeduction: item.lateDeduction,
            earlyLeaveDeduction: item.earlyLeaveDeduction,
            absenceDeduction: item.absenceDeduction,
            healthInsurance: item.healthInsurance,
            nursingCareInsurance: item.nursingCareInsurance,
            welfarePension: item.welfarePension,
            employmentInsurance: item.employmentInsurance,
            incomeTax: item.incomeTax,
            residentTax: item.residentTax,
            otherDeductions: item.otherDeductions,
            totalDeductions: item.totalDeductions,
            netPay: item.netPay,
            fixedOvertimeMinutes: item.fixedOvertimeMinutes,
            fixedOvertimeExcessMinutes: item.fixedOvertimeExcessMinutes,
            fixedOvertimeExcessPay: item.fixedOvertimeExcessPay,
            totalWorkDays: item.totalWorkDays,
            totalWorkedMinutes: item.totalWorkedMinutes,
            totalOvertimeMinutes: item.totalOvertimeMinutes,
            totalLateNightMinutes: item.totalLateNightMinutes,
            totalHolidayMinutes: item.totalHolidayMinutes,
            totalLateMinutes: item.totalLateMinutes,
            totalEarlyLeaveMinutes: item.totalEarlyLeaveMinutes,
            totalAbsenceMinutes: item.totalAbsenceMinutes,
          },
        })
      )
    )

    // Collect any warnings
    const warnings = results.flatMap((r) =>
      r.warnings.length > 0 ? [{ employeeId: r.employeeId, warnings: r.warnings }] : []
    )

    await logAction(user, 'CALCULATE_PAYROLL', 'payroll_run', payrollRun.id, {
      metadataJson: {
        companyId,
        year: y,
        month: m,
        employeeCount: savedItems.length,
        warnings,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        payrollRun,
        itemCount: savedItems.length,
        warnings,
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
