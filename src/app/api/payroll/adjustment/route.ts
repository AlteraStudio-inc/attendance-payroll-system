import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { logAction, getIpAddress } from '@/lib/audit'
import { format, subMonths } from 'date-fns'

// 前月の給与データ取得
export async function GET(request: NextRequest) {
    try {
        await requireAdmin()

        const { searchParams } = new URL(request.url)
        const targetMonth = searchParams.get('month') || format(subMonths(new Date(), 1), 'yyyy-MM')

        // PayrollRunを取得
        const payrollRun = await prisma.payrollRun.findUnique({
            where: { yearMonth: targetMonth },
            include: {
                payrollItems: {
                    include: {
                        employee: {
                            select: { name: true, employeeCode: true, isActive: true },
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
                yearMonth: targetMonth,
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
                isActive: item.employee.isActive,
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
            })),
            yearMonth: targetMonth,
        })
    } catch (error) {
        console.error('Get payroll adjustment error:', error)
        if (error instanceof Error && error.message === '管理者権限が必要です') {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        return NextResponse.json(
            { error: '給与データの取得中にエラーが発生しました' },
            { status: 500 }
        )
    }
}

// 給与明細の個別修正
export async function PATCH(request: NextRequest) {
    try {
        const user = await requireAdmin()
        const body = await request.json()
        const { payrollItemId, updates } = body

        if (!payrollItemId || !updates) {
            return NextResponse.json(
                { error: '修正対象と修正内容を指定してください' },
                { status: 400 }
            )
        }

        // 既存のPayrollItemを取得
        const existing = await prisma.payrollItem.findUnique({
            where: { id: payrollItemId },
            include: {
                payrollRun: true,
                employee: { select: { name: true } },
            },
        })

        if (!existing) {
            return NextResponse.json(
                { error: '給与明細が見つかりません' },
                { status: 404 }
            )
        }

        // 許可されたフィールドのみ更新
        const allowedFields = [
            'baseSalary', 'overtimePay', 'holidayPay', 'deemedOvertimePay',
            'grossSalary', 'socialInsurance', 'employmentInsurance', 'incomeTax',
            'totalDeductions', 'netSalary', 'workHours', 'overtimeHours', 'holidayHours',
        ]

        const updateData: Record<string, number> = {}
        const oldValues: Record<string, number> = {}

        for (const field of allowedFields) {
            if (field in updates && updates[field] !== undefined) {
                updateData[field] = Number(updates[field])
                oldValues[field] = Number((existing as Record<string, unknown>)[field])
            }
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json(
                { error: '修正する項目がありません' },
                { status: 400 }
            )
        }

        // 更新実行
        const updated = await prisma.payrollItem.update({
            where: { id: payrollItemId },
            data: updateData,
        })

        // 監査ログ
        await logAction(user, 'UPDATE', 'PayrollItem', payrollItemId, {
            oldValue: oldValues,
            newValue: updateData,
            ipAddress: getIpAddress(request),
        })

        return NextResponse.json({
            success: true,
            item: {
                id: updated.id,
                baseSalary: Number(updated.baseSalary),
                overtimePay: Number(updated.overtimePay),
                holidayPay: Number(updated.holidayPay),
                deemedOvertimePay: Number(updated.deemedOvertimePay),
                grossSalary: Number(updated.grossSalary),
                socialInsurance: Number(updated.socialInsurance),
                employmentInsurance: Number(updated.employmentInsurance),
                incomeTax: Number(updated.incomeTax),
                totalDeductions: Number(updated.totalDeductions),
                netSalary: Number(updated.netSalary),
                workHours: Number(updated.workHours),
                overtimeHours: Number(updated.overtimeHours),
                holidayHours: Number(updated.holidayHours),
            },
        })
    } catch (error) {
        console.error('Payroll adjustment error:', error)
        if (error instanceof Error && error.message === '管理者権限が必要です') {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        return NextResponse.json(
            { error: '給与修正中にエラーが発生しました' },
            { status: 500 }
        )
    }
}
