import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { generatePayslipPdf, type PayslipData } from '@/lib/pdf'

interface RouteParams {
    params: Promise<{ yearMonth: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await requireAuth()
        const { yearMonth } = await params

        const payrollItem = await prisma.payrollItem.findFirst({
            where: {
                employeeId: user.id,
                payrollRun: {
                    yearMonth,
                    status: 'CONFIRMED',
                },
            },
            include: {
                employee: true,
                payrollRun: true,
            },
        })

        if (!payrollItem) {
            return NextResponse.json(
                { error: '給与明細が見つかりません' },
                { status: 404 }
            )
        }

        const data: PayslipData = {
            employeeCode: payrollItem.employee.employeeCode,
            employeeName: payrollItem.employee.name,
            yearMonth,
            workHours: Number(payrollItem.workHours),
            overtimeHours: Number(payrollItem.overtimeHours),
            holidayHours: Number(payrollItem.holidayHours),
            baseSalary: Number(payrollItem.baseSalary),
            overtimePay: Number(payrollItem.overtimePay),
            holidayPay: Number(payrollItem.holidayPay),
            deemedOvertimePay: Number(payrollItem.deemedOvertimePay),
            grossSalary: Number(payrollItem.grossSalary),
            socialInsurance: Number(payrollItem.socialInsurance),
            employmentInsurance: Number(payrollItem.employmentInsurance),
            incomeTax: Number(payrollItem.incomeTax),
            totalDeductions: Number(payrollItem.totalDeductions),
            netSalary: Number(payrollItem.netSalary),
        }

        const pdfBuffer = await generatePayslipPdf(data)

        return new NextResponse(pdfBuffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="payslip_${yearMonth}.pdf"`,
            },
        })
    } catch (error) {
        console.error('Get payslip PDF error:', error)
        return NextResponse.json(
            { error: 'PDF生成中にエラーが発生しました' },
            { status: 500 }
        )
    }
}
