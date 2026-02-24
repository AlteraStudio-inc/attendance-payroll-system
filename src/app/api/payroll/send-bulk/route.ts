import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { generatePayslipPdf, type PayslipData } from '@/lib/pdf'
import { sendPayslipEmail } from '@/lib/mail'

export async function POST(request: NextRequest) {
    try {
        await requireAdmin()

        const body = await request.json()
        const { yearMonth } = body

        if (!yearMonth) {
            return NextResponse.json(
                { error: '対象年月が必要です' },
                { status: 400 }
            )
        }

        // Get confirmed payroll run
        const payrollRun = await prisma.payrollRun.findUnique({
            where: { yearMonth },
        })

        if (!payrollRun || payrollRun.status !== 'CONFIRMED') {
            return NextResponse.json(
                { error: '対象月の給与計算が確定されていません' },
                { status: 400 }
            )
        }

        // Get all payroll items for the month with employee email
        const payrollItems = await prisma.payrollItem.findMany({
            where: {
                payrollRunId: payrollRun.id,
            },
            include: {
                employee: true,
            },
        })

        if (!payrollItems.length) {
            return NextResponse.json(
                { error: '給与データが見つかりません' },
                { status: 404 }
            )
        }

        let sentCount = 0
        const errors: string[] = []

        // Process each employee
        for (const item of payrollItems) {
            try {
                if (!item.employee.email) continue // Skip if no email

                const data: PayslipData = {
                    employeeCode: item.employee.employeeCode,
                    employeeName: item.employee.name,
                    jobType: item.employee.jobType,
                    yearMonth,
                    workHours: Number(item.workHours),
                    overtimeHours: Number(item.overtimeHours),
                    holidayHours: Number(item.holidayHours),
                    baseSalary: Number(item.baseSalary),
                    overtimePay: Number(item.overtimePay),
                    holidayPay: Number(item.holidayPay),
                    deemedOvertimePay: Number(item.deemedOvertimePay),
                    grossSalary: Number(item.grossSalary),
                    socialInsurance: Number(item.socialInsurance),
                    employmentInsurance: Number(item.employmentInsurance),
                    incomeTax: Number(item.incomeTax),
                    totalDeductions: Number(item.totalDeductions),
                    netSalary: Number(item.netSalary),
                }

                // Generate PDF
                const pdfBuffer = await generatePayslipPdf(data)

                // Send email
                await sendPayslipEmail({
                    employeeId: item.employeeId,
                    employeeEmail: item.employee.email,
                    employeeName: item.employee.name,
                    yearMonth,
                    pdfBuffer,
                    pdfFilename: `payslip_${yearMonth}_${item.employee.employeeCode}.pdf`,
                })

                sentCount++
            } catch (err) {
                console.error(`Failed to send email to ${item.employee.email}:`, err)
                errors.push(`${item.employee.name}様への送信に失敗しました`)
            }
        }

        if (sentCount === 0 && errors.length > 0) {
            return NextResponse.json(
                { error: '全員へのメール送信に失敗しました', details: errors },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            sentCount,
            warnings: errors.length > 0 ? errors : undefined
        })
    } catch (error) {
        console.error('Bulk email send error:', error)
        if (error instanceof Error && error.message === '管理者権限が必要です') {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        return NextResponse.json(
            { error: '一括送信処理中にエラーが発生しました' },
            { status: 500 }
        )
    }
}
