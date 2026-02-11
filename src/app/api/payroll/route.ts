import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { calculateMonthlyPayroll, savePayrollItems, confirmPayroll, revertPayroll } from '@/lib/payroll'
import { logAction, getIpAddress } from '@/lib/audit'
import { format } from 'date-fns'

// 給与一覧・計算結果取得
export async function GET(request: NextRequest) {
    try {
        await requireAdmin()

        const { searchParams } = new URL(request.url)
        const yearMonth = searchParams.get('month') || format(new Date(), 'yyyy-MM')
        const action = searchParams.get('action')

        if (action === 'calculate') {
            // 給与計算を実行
            const results = await calculateMonthlyPayroll(yearMonth)
            return NextResponse.json({ results, yearMonth })
        }

        // 既存のPayrollRunを取得
        const payrollRun = await prisma.payrollRun.findUnique({
            where: { yearMonth },
            include: {
                payrollItems: {
                    include: {
                        employee: {
                            select: { name: true, employeeCode: true },
                        },
                    },
                },
                confirmedBy: {
                    select: { name: true },
                },
            },
        })

        if (!payrollRun) {
            return NextResponse.json({
                payrollRun: null,
                items: [],
                yearMonth,
            })
        }

        return NextResponse.json({
            payrollRun: {
                id: payrollRun.id,
                yearMonth: payrollRun.yearMonth,
                status: payrollRun.status,
                confirmedBy: payrollRun.confirmedBy?.name,
                confirmedAt: payrollRun.confirmedAt,
            },
            items: payrollRun.payrollItems.map((item) => ({
                id: item.id,
                employeeId: item.employeeId,
                employeeName: item.employee.name,
                employeeCode: item.employee.employeeCode,
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
                workHours: Number(item.workHours),
                overtimeHours: Number(item.overtimeHours),
                holidayHours: Number(item.holidayHours),
                pdfPath: item.pdfPath,
            })),
            yearMonth,
        })
    } catch (error) {
        console.error('Get payroll error:', error)
        if (error instanceof Error && error.message === '管理者権限が必要です') {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        return NextResponse.json(
            { error: '給与データの取得中にエラーが発生しました' },
            { status: 500 }
        )
    }
}

// 給与計算実行・保存・確定・差し戻し
export async function POST(request: NextRequest) {
    try {
        const user = await requireAdmin()
        const body = await request.json()
        const { action, yearMonth } = body

        if (!yearMonth) {
            return NextResponse.json(
                { error: '対象年月を指定してください' },
                { status: 400 }
            )
        }

        switch (action) {
            case 'calculate': {
                // 給与計算を実行して保存
                const results = await calculateMonthlyPayroll(yearMonth)
                const payrollRunId = await savePayrollItems(yearMonth, results)

                await logAction(user, 'CREATE', 'PayrollRun', payrollRunId, {
                    newValue: { yearMonth, itemCount: results.length },
                    ipAddress: getIpAddress(request),
                })

                return NextResponse.json({
                    success: true,
                    payrollRunId,
                    itemCount: results.length,
                })
            }

            case 'confirm': {
                const { payrollRunId } = body
                if (!payrollRunId) {
                    return NextResponse.json(
                        { error: '給与データIDが必要です' },
                        { status: 400 }
                    )
                }

                await confirmPayroll(payrollRunId, user.id)

                await logAction(user, 'CONFIRM', 'PayrollRun', payrollRunId, {
                    newValue: { status: 'CONFIRMED' },
                    ipAddress: getIpAddress(request),
                })

                return NextResponse.json({ success: true })
            }

            case 'revert': {
                const { payrollRunId } = body
                if (!payrollRunId) {
                    return NextResponse.json(
                        { error: '給与データIDが必要です' },
                        { status: 400 }
                    )
                }

                await revertPayroll(payrollRunId)

                await logAction(user, 'REVERT', 'PayrollRun', payrollRunId, {
                    newValue: { status: 'REVERTED' },
                    ipAddress: getIpAddress(request),
                })

                return NextResponse.json({ success: true })
            }

            default:
                return NextResponse.json(
                    { error: '無効なアクションです' },
                    { status: 400 }
                )
        }
    } catch (error) {
        console.error('Payroll action error:', error)
        if (error instanceof Error) {
            if (error.message === '管理者権限が必要です') {
                return NextResponse.json({ error: error.message }, { status: 403 })
            }
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        return NextResponse.json(
            { error: '給与処理中にエラーが発生しました' },
            { status: 500 }
        )
    }
}
