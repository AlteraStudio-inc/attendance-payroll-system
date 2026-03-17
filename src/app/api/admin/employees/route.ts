import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, hashPassword } from '@/lib/auth'
import { logAction } from '@/lib/audit'
import { prisma } from '@/lib/prisma'

// GET /api/admin/employees - List with pagination, search, department filter
export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20')))
    const search = searchParams.get('search') ?? ''
    const departmentId = searchParams.get('departmentId') ?? ''
    const active = searchParams.get('active')

    const where: any = {}
    if (departmentId) where.departmentId = departmentId
    if (active !== null && active !== '') where.active = active === 'true'
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { employeeCode: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [total, employees] = await Promise.all([
      prisma.employee.count({ where }),
      prisma.employee.findMany({
        where,
        include: {
          department: { select: { id: true, code: true, name: true } },
          user: { select: { id: true, email: true, role: true, isActive: true, lastLoginAt: true } },
          salarySettings: {
            orderBy: { effectiveFrom: 'desc' },
            take: 1,
          },
        },
        orderBy: { employeeCode: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        employees,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
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

// POST /api/admin/employees - Create employee + user + initial salary setting
export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin()
    const body = await request.json()

    const {
      // Employee fields
      companyId,
      departmentId,
      employeeCode,
      name,
      email,
      employmentType,
      payType,
      joinDate,
      // User fields
      password,
      userRole,
      // Initial salary setting (optional)
      salarySetting,
    } = body

    if (!companyId || !departmentId || !employeeCode || !name || !password) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: '必須項目が不足しています (companyId, departmentId, employeeCode, name, password)' } },
        { status: 400 }
      )
    }

    const passwordHash = await hashPassword(password)

    const employee = await prisma.$transaction(async (tx) => {
      const emp = await tx.employee.create({
        data: {
          companyId,
          departmentId,
          employeeCode,
          name,
          email: email ?? null,
          employmentType: employmentType ?? 'full_time',
          payType: payType ?? 'monthly',
          active: true,
          joinDate: joinDate ? new Date(joinDate) : null,
        },
      })

      await tx.user.create({
        data: {
          role: userRole ?? 'employee',
          email: email ?? null,
          passwordHash,
          employeeId: emp.id,
          isActive: true,
        },
      })

      if (salarySetting) {
        await tx.employeeSalarySetting.create({
          data: {
            employeeId: emp.id,
            effectiveFrom: salarySetting.effectiveFrom
              ? new Date(salarySetting.effectiveFrom)
              : new Date(),
            effectiveTo: salarySetting.effectiveTo
              ? new Date(salarySetting.effectiveTo)
              : null,
            monthlySalary: salarySetting.monthlySalary ?? null,
            hourlyRate: salarySetting.hourlyRate ?? null,
            baseSalary: salarySetting.baseSalary ?? null,
            positionAllowance: salarySetting.positionAllowance ?? null,
            jobAllowance: salarySetting.jobAllowance ?? null,
            familyAllowance: salarySetting.familyAllowance ?? null,
            commutingAllowance: salarySetting.commutingAllowance ?? null,
            incentiveDefault: salarySetting.incentiveDefault ?? null,
            fixedOvertimeAllowance: salarySetting.fixedOvertimeAllowance ?? null,
            fixedOvertimeMinutes: salarySetting.fixedOvertimeMinutes ?? null,
            socialInsuranceEnrolled: salarySetting.socialInsuranceEnrolled ?? true,
            nursingCareInsuranceApplicable: salarySetting.nursingCareInsuranceApplicable ?? false,
            employmentInsuranceEnrolled: salarySetting.employmentInsuranceEnrolled ?? true,
            taxWithholdingType: salarySetting.taxWithholdingType ?? null,
            dependentsCount: salarySetting.dependentsCount ?? 0,
            residentTaxMonthly: salarySetting.residentTaxMonthly ?? null,
            standardMonthlyRemuneration: salarySetting.standardMonthlyRemuneration ?? null,
          },
        })
      }

      return emp
    })

    const created = await prisma.employee.findUnique({
      where: { id: employee.id },
      include: {
        department: { select: { id: true, code: true, name: true } },
        user: { select: { id: true, email: true, role: true, isActive: true } },
        salarySettings: { orderBy: { effectiveFrom: 'desc' }, take: 1 },
      },
    })

    await logAction(user, 'CREATE_EMPLOYEE', 'employee', employee.id, {
      afterJson: { employeeCode, name, departmentId },
    })

    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (error: any) {
    if (error.message.includes('権限') || error.message.includes('認証')) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: error.message } },
        { status: 401 }
      )
    }
    if (error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message: '従業員コードまたはメールアドレスが既に存在します' } },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    )
  }
}
