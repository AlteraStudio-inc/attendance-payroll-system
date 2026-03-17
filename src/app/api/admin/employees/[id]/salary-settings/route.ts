import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { logAction } from '@/lib/audit'
import { prisma } from '@/lib/prisma'

// GET /api/admin/employees/[id]/salary-settings
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params

    const employee = await prisma.employee.findUnique({ where: { id } })
    if (!employee) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '従業員が見つかりません' } },
        { status: 404 }
      )
    }

    const salarySettings = await prisma.employeeSalarySetting.findMany({
      where: { employeeId: id },
      orderBy: { effectiveFrom: 'desc' },
    })

    return NextResponse.json({ success: true, data: salarySettings })
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

// POST /api/admin/employees/[id]/salary-settings
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdmin()
    const { id } = await params
    const body = await request.json()

    const employee = await prisma.employee.findUnique({ where: { id } })
    if (!employee) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '従業員が見つかりません' } },
        { status: 404 }
      )
    }

    const { effectiveFrom, effectiveTo, ...rest } = body

    if (!effectiveFrom) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: '適用開始日は必須です' } },
        { status: 400 }
      )
    }

    const salarySetting = await prisma.employeeSalarySetting.create({
      data: {
        employeeId: id,
        effectiveFrom: new Date(effectiveFrom),
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
        monthlySalary: rest.monthlySalary ?? null,
        hourlyRate: rest.hourlyRate ?? null,
        baseSalary: rest.baseSalary ?? null,
        positionAllowance: rest.positionAllowance ?? null,
        jobAllowance: rest.jobAllowance ?? null,
        familyAllowance: rest.familyAllowance ?? null,
        commutingAllowance: rest.commutingAllowance ?? null,
        incentiveDefault: rest.incentiveDefault ?? null,
        fixedOvertimeAllowance: rest.fixedOvertimeAllowance ?? null,
        fixedOvertimeMinutes: rest.fixedOvertimeMinutes ?? null,
        fixedOvertimeMinutesOverride: rest.fixedOvertimeMinutesOverride ?? null,
        includeJobAllowanceInBaseWage: rest.includeJobAllowanceInBaseWage ?? false,
        standardMonthlyRemuneration: rest.standardMonthlyRemuneration ?? null,
        socialInsuranceEnrolled: rest.socialInsuranceEnrolled ?? true,
        nursingCareInsuranceApplicable: rest.nursingCareInsuranceApplicable ?? false,
        employmentInsuranceEnrolled: rest.employmentInsuranceEnrolled ?? true,
        taxWithholdingType: rest.taxWithholdingType ?? null,
        dependentsCount: rest.dependentsCount ?? 0,
        residentTaxMonthly: rest.residentTaxMonthly ?? null,
        notes: rest.notes ?? null,
      },
    })

    await logAction(user, 'CREATE_SALARY_SETTING', 'employee_salary_setting', salarySetting.id, {
      afterJson: { employeeId: id, effectiveFrom },
    })

    return NextResponse.json({ success: true, data: salarySetting }, { status: 201 })
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
