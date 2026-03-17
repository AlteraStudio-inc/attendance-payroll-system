import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { logAction } from '@/lib/audit'
import { prisma } from '@/lib/prisma'

// GET /api/admin/statutory-rates
export async function GET() {
  try {
    await requireAdmin()

    const rates = await prisma.statutoryRateMaster.findMany({
      orderBy: { fiscalYear: 'desc' },
    })

    return NextResponse.json({ success: true, data: rates })
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

// POST /api/admin/statutory-rates
export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin()
    const body = await request.json()

    const {
      fiscalYear,
      healthInsuranceRate,
      nursingCareInsuranceRate,
      welfarePensionRate,
      childSupportRate,
      employmentInsuranceEmployeeRate,
      employmentInsuranceEmployerRate,
      effectiveFrom,
      effectiveTo,
    } = body

    if (
      fiscalYear == null ||
      healthInsuranceRate == null ||
      nursingCareInsuranceRate == null ||
      welfarePensionRate == null ||
      childSupportRate == null ||
      employmentInsuranceEmployeeRate == null ||
      employmentInsuranceEmployerRate == null ||
      !effectiveFrom
    ) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: '必須項目が不足しています' } },
        { status: 400 }
      )
    }

    const rate = await prisma.statutoryRateMaster.create({
      data: {
        fiscalYear: parseInt(fiscalYear),
        healthInsuranceRate,
        nursingCareInsuranceRate,
        welfarePensionRate,
        childSupportRate,
        employmentInsuranceEmployeeRate,
        employmentInsuranceEmployerRate,
        effectiveFrom: new Date(effectiveFrom),
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
      },
    })

    await logAction(user, 'CREATE_STATUTORY_RATE', 'statutory_rate_master', rate.id, {
      afterJson: { fiscalYear },
    })

    return NextResponse.json({ success: true, data: rate }, { status: 201 })
  } catch (error: any) {
    if (error.message.includes('権限') || error.message.includes('認証')) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: error.message } },
        { status: 401 }
      )
    }
    if (error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message: 'この年度の法定控除率は既に登録されています' } },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    )
  }
}
