import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function GET() {
    try {
        const user = await requireAuth()

        const payrollItems = await prisma.payrollItem.findMany({
            where: {
                employeeId: user.id,
                payrollRun: {
                    status: 'CONFIRMED',
                },
            },
            include: {
                payrollRun: true,
            },
            orderBy: {
                payrollRun: {
                    yearMonth: 'desc',
                },
            },
        })

        return NextResponse.json({
            payslips: payrollItems.map((item) => ({
                id: item.id,
                yearMonth: item.payrollRun.yearMonth,
                grossSalary: Number(item.grossSalary),
                netSalary: Number(item.netSalary),
                status: item.payrollRun.status,
            })),
        })
    } catch (error) {
        console.error('Get payslips error:', error)
        return NextResponse.json(
            { error: '給与明細の取得中にエラーが発生しました' },
            { status: 500 }
        )
    }
}
