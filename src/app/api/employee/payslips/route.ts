import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function GET() {
    try {
        const user = await requireAuth()

        if (!user.employeeId) {
            return NextResponse.json(
                { success: false, error: { code: 'NO_EMPLOYEE', message: '従業員情報が見つかりません' } },
                { status: 403 }
            )
        }

        const payrollItems = await prisma.payrollItem.findMany({
            where: {
                employeeId: user.employeeId,
                payrollRun: {
                    status: 'finalized',
                },
            },
            include: {
                payrollRun: {
                    select: {
                        year: true,
                        month: true,
                        status: true,
                        paymentDate: true,
                    },
                },
            },
            orderBy: [
                { payrollRun: { year: 'desc' } },
                { payrollRun: { month: 'desc' } },
            ],
        })

        return NextResponse.json({
            success: true,
            data: {
                payslips: payrollItems.map((item) => ({
                    id: item.id,
                    year: item.payrollRun.year,
                    month: item.payrollRun.month,
                    yearMonth: `${item.payrollRun.year}-${String(item.payrollRun.month).padStart(2, '0')}`,
                    status: item.payrollRun.status,
                    paymentDate: item.payrollRun.paymentDate?.toISOString() ?? null,
                    grossPay: item.grossPay,
                    netPay: item.netPay,
                    totalDeductions: item.totalDeductions,
                    baseSalary: item.baseSalary,
                    allowanceTotal: item.allowanceTotal,
                    overtimePay: item.overtimePay,
                    totalWorkDays: item.totalWorkDays,
                    totalWorkedMinutes: item.totalWorkedMinutes,
                    totalOvertimeMinutes: item.totalOvertimeMinutes,
                    pdfFilePath: item.pdfFilePath,
                })),
            },
        })
    } catch (error) {
        console.error('Get payslips error:', error)
        if (error instanceof Error && error.message.includes('認証')) {
            return NextResponse.json(
                { success: false, error: { code: 'UNAUTHORIZED', message: error.message } },
                { status: 401 }
            )
        }
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: '給与明細の取得中にエラーが発生しました' } },
            { status: 500 }
        )
    }
}
