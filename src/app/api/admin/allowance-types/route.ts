import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { logAction } from '@/lib/audit'
import { prisma } from '@/lib/prisma'

// GET /api/admin/allowance-types
export async function GET() {
  try {
    await requireAdmin()

    const allowanceTypes = await prisma.allowanceType.findMany({
      include: {
        _count: { select: { employeeAllowances: true } },
      },
      orderBy: { code: 'asc' },
    })

    return NextResponse.json({ success: true, data: allowanceTypes })
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

// POST /api/admin/allowance-types
export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin()
    const body = await request.json()

    const {
      code,
      name,
      category,
      includedInBaseWage,
      exclusionReason,
      calculationType,
      isUniformPayment,
      isActualCostBased,
      taxable,
      socialInsuranceApplicable,
      notes,
    } = body

    if (!code || !name || !category) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: '必須項目が不足しています (code, name, category)' } },
        { status: 400 }
      )
    }

    const allowanceType = await prisma.allowanceType.create({
      data: {
        code,
        name,
        category,
        includedInBaseWage: includedInBaseWage ?? true,
        exclusionReason: exclusionReason ?? null,
        calculationType: calculationType ?? 'fixed',
        isUniformPayment: isUniformPayment ?? false,
        isActualCostBased: isActualCostBased ?? false,
        taxable: taxable ?? true,
        socialInsuranceApplicable: socialInsuranceApplicable ?? true,
        notes: notes ?? null,
      },
    })

    await logAction(user, 'CREATE_ALLOWANCE_TYPE', 'allowance_type', allowanceType.id, {
      afterJson: { code, name, category },
    })

    return NextResponse.json({ success: true, data: allowanceType }, { status: 201 })
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
