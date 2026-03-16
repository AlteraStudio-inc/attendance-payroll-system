import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { generateWageLedgerPdf, type WageLedgerData, type WageLedgerEntry } from '@/lib/pdf'

export async function POST(request: NextRequest) {
    try {
        await requireAdmin()

        const body = await request.json()
        const { employeeId, yearMonth } = body

        if (!employeeId || !yearMonth) {
            return NextResponse.json(
                { error: '従業員IDと対象年月が必要です' },
                { status: 400 }
            )
        }

        // 従業員情報を取得
        const employee = await prisma.employee.findUnique({
            where: { id: employeeId },
            select: { name: true, employeeCode: true, jobType: true },
        })

        if (!employee) {
            return NextResponse.json(
                { error: '従業員が見つかりません' },
                { status: 404 }
            )
        }

        // 対象年月を含む年度の全PayrollItemを取得（最大12ヶ月分）
        const [year, month] = yearMonth.split('-').map(Number)
        // 当該月から過去12ヶ月分のデータを取得
        const startYearMonth = `${month <= 12 ? year - 1 : year}-${String(((month - 1 + 12) % 12) + 1).padStart(2, '0')}`

        const payrollItems = await prisma.payrollItem.findMany({
            where: {
                employeeId,
                payrollRun: {
                    yearMonth: {
                        gte: startYearMonth,
                        lte: yearMonth,
                    },
                },
            },
            include: {
                payrollRun: {
                    select: { yearMonth: true },
                },
            },
            orderBy: {
                payrollRun: { yearMonth: 'asc' },
            },
        })

        const entries: WageLedgerEntry[] = payrollItems.map((item) => ({
            yearMonth: item.payrollRun.yearMonth,
            workDays: Math.ceil(Number(item.workHours) / 8) || 0,
            workHours: Number(item.workHours),
            overtimeHours: Number(item.overtimeHours),
            holidayHours: Number(item.holidayHours),
            lateNightHours: 0,
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
        }))

        if (entries.length === 0) {
            return NextResponse.json(
                { error: 'この従業員の給与データがありません' },
                { status: 404 }
            )
        }

        const data: WageLedgerData = {
            employeeCode: employee.employeeCode,
            employeeName: employee.name,
            jobType: employee.jobType,
            entries,
        }

        const pdfBuffer = await generateWageLedgerPdf(data)

        return new NextResponse(new Uint8Array(pdfBuffer), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="wage_ledger_${employee.employeeCode}_${yearMonth}.pdf"`,
            },
        })
    } catch (error) {
        console.error('Wage ledger PDF error:', error)
        if (error instanceof Error && error.message === '管理者権限が必要です') {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        return NextResponse.json(
            { error: '賃金台帳の生成中にエラーが発生しました: ' + (error instanceof Error ? error.message : String(error)) },
            { status: 500 }
        )
    }
}
