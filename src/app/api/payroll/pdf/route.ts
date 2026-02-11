import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { generatePayslipPdf, savePayslipPdf, type PayslipData } from '@/lib/pdf'

export async function POST(request: NextRequest) {
    try {
        await requireAdmin()

        const body = await request.json()
        const { yearMonth, employeeId, save } = body

        if (!yearMonth || !employeeId) {
            return NextResponse.json(
                { error: '対象年月と従業員IDが必要です' },
                { status: 400 }
            )
        }

        // PayrollItemを取得
        const payrollItem = await prisma.payrollItem.findFirst({
            where: {
                payrollRun: { yearMonth },
                employeeId,
            },
            include: {
                employee: true,
            },
        })

        if (!payrollItem) {
            return NextResponse.json(
                { error: '給与データが見つかりません' },
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

        if (save) {
            // PDFを保存
            const filePath = await savePayslipPdf(data)

            // パスを更新
            await prisma.payrollItem.update({
                where: { id: payrollItem.id },
                data: { pdfPath: filePath },
            })

            return NextResponse.json({ success: true, filePath })
        } else {
            // PDFを生成して返す
            const pdfBuffer = await generatePayslipPdf(data)

            return new NextResponse(pdfBuffer, {
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `inline; filename="${data.employeeCode}_${yearMonth}.pdf"`,
                },
            })
        }
    } catch (error) {
        console.error('PDF generation error:', error)
        if (error instanceof Error && error.message === '管理者権限が必要です') {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        return NextResponse.json(
            { error: 'PDF生成中にエラーが発生しました' },
            { status: 500 }
        )
    }
}
