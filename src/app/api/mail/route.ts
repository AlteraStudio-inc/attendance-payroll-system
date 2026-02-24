import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { generatePayslipPdf, type PayslipData } from '@/lib/pdf'
import {
    sendPayslipEmail,
    createEmailLog,
    markEmailSent,
    markEmailFailed,
    getPendingEmails,
} from '@/lib/mail'
import { logAction, getIpAddress } from '@/lib/audit'

// メール送信履歴取得・送信実行
export async function GET(request: NextRequest) {
    try {
        await requireAdmin()

        const { searchParams } = new URL(request.url)
        const yearMonth = searchParams.get('month')

        let logs
        if (yearMonth) {
            logs = await prisma.emailLog.findMany({
                where: {
                    payrollItem: {
                        payrollRun: { yearMonth },
                    },
                },
                include: {
                    employee: { select: { name: true, employeeCode: true, email: true } },
                },
                orderBy: { createdAt: 'desc' },
            })
        } else {
            logs = await prisma.emailLog.findMany({
                take: 100,
                include: {
                    employee: { select: { name: true, employeeCode: true, email: true } },
                },
                orderBy: { createdAt: 'desc' },
            })
        }

        return NextResponse.json({
            logs: logs.map((log) => ({
                id: log.id,
                employee: log.employee,
                status: log.status,
                sentAt: log.sentAt,
                errorMessage: log.errorMessage,
                retryCount: log.retryCount,
                createdAt: log.createdAt,
            })),
        })
    } catch (error) {
        console.error('Get email logs error:', error)
        if (error instanceof Error && error.message === '管理者権限が必要です') {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        return NextResponse.json(
            { error: 'メール履歴の取得中にエラーが発生しました' },
            { status: 500 }
        )
    }
}

// メール送信
export async function POST(request: NextRequest) {
    try {
        const user = await requireAdmin()
        const body = await request.json()
        const { action, yearMonth, employeeId, logId } = body

        if (action === 'send') {
            // 単一の従業員に送信
            if (!yearMonth || !employeeId) {
                return NextResponse.json(
                    { error: '対象年月と従業員IDが必要です' },
                    { status: 400 }
                )
            }

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

            // メールログ作成
            const emailLogId = await createEmailLog(payrollItem.id, employeeId)

            try {
                // PDF生成
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

                // メール送信
                await sendPayslipEmail({
                    employeeId,
                    employeeEmail: payrollItem.employee.email,
                    employeeName: payrollItem.employee.name,
                    yearMonth,
                    pdfBuffer,
                    pdfFilename: `給与明細_${yearMonth}_${payrollItem.employee.employeeCode}.pdf`,
                })

                await markEmailSent(emailLogId)

                await logAction(user, 'CREATE', 'EmailLog', emailLogId, {
                    newValue: { employeeId, yearMonth, status: 'SENT' },
                    ipAddress: getIpAddress(request),
                })

                return NextResponse.json({ success: true })
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error'
                await markEmailFailed(emailLogId, errorMessage)
                throw error
            }
        } else if (action === 'sendAll') {
            // 全従業員に送信
            if (!yearMonth) {
                return NextResponse.json(
                    { error: '対象年月が必要です' },
                    { status: 400 }
                )
            }

            const payrollItems = await prisma.payrollItem.findMany({
                where: {
                    payrollRun: { yearMonth },
                },
                include: {
                    employee: true,
                },
            })

            if (payrollItems.length === 0) {
                return NextResponse.json(
                    { error: '給与データが見つかりません' },
                    { status: 404 }
                )
            }

            let sent = 0
            let failed = 0

            for (const payrollItem of payrollItems) {
                const emailLogId = await createEmailLog(payrollItem.id, payrollItem.employeeId)

                try {
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

                    await sendPayslipEmail({
                        employeeId: payrollItem.employeeId,
                        employeeEmail: payrollItem.employee.email,
                        employeeName: payrollItem.employee.name,
                        yearMonth,
                        pdfBuffer,
                        pdfFilename: `給与明細_${yearMonth}_${payrollItem.employee.employeeCode}.pdf`,
                    })

                    await markEmailSent(emailLogId)
                    sent++
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
                    await markEmailFailed(emailLogId, errorMessage)
                    failed++
                }
            }

            // 監査ログ
            await logAction(user, 'BULK_SEND', 'EmailLog', yearMonth, {
                newValue: { yearMonth, sentCount: sent, failedCount: failed },
                ipAddress: getIpAddress(request),
            })

            return NextResponse.json({ success: true, sent, failed })
        } else if (action === 'retry') {
            // 再送信
            if (!logId) {
                return NextResponse.json(
                    { error: 'ログIDが必要です' },
                    { status: 400 }
                )
            }

            const emailLog = await prisma.emailLog.findUnique({
                where: { id: logId },
                include: {
                    payrollItem: {
                        include: {
                            employee: true,
                            payrollRun: true,
                        },
                    },
                },
            })

            if (!emailLog) {
                return NextResponse.json(
                    { error: 'ログが見つかりません' },
                    { status: 404 }
                )
            }

            try {
                const payrollItem = emailLog.payrollItem
                const data: PayslipData = {
                    employeeCode: payrollItem.employee.employeeCode,
                    employeeName: payrollItem.employee.name,
                    yearMonth: payrollItem.payrollRun.yearMonth,
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

                await sendPayslipEmail({
                    employeeId: payrollItem.employeeId,
                    employeeEmail: payrollItem.employee.email,
                    employeeName: payrollItem.employee.name,
                    yearMonth: payrollItem.payrollRun.yearMonth,
                    pdfBuffer,
                    pdfFilename: `給与明細_${payrollItem.payrollRun.yearMonth}_${payrollItem.employee.employeeCode}.pdf`,
                })

                await markEmailSent(logId)

                // 監査ログ
                await logAction(user, 'RETRY', 'EmailLog', logId, {
                    newValue: { status: 'SENT' },
                    ipAddress: getIpAddress(request),
                })

                return NextResponse.json({ success: true })
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error'
                await markEmailFailed(logId, errorMessage)
                throw error
            }
        }

        return NextResponse.json({ error: '無効なアクションです' }, { status: 400 })
    } catch (error) {
        console.error('Email send error:', error)
        if (error instanceof Error && error.message === '管理者権限が必要です') {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        return NextResponse.json(
            { error: 'メール送信中にエラーが発生しました' },
            { status: 500 }
        )
    }
}
