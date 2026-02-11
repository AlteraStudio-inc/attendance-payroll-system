import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAuditLog, getIpAddress } from '@/lib/audit'

export async function POST(request: NextRequest) {
    try {
        const { employeeCode } = await request.json()

        if (!employeeCode) {
            return NextResponse.json(
                { error: '従業員コードが必要です' },
                { status: 400 }
            )
        }

        // 従業員を検索
        const employee = await prisma.employee.findUnique({
            where: { employeeCode },
        })

        if (!employee) {
            return NextResponse.json(
                { error: '従業員が見つかりません' },
                { status: 404 }
            )
        }

        if (!employee.isActive) {
            return NextResponse.json(
                { error: 'このアカウントは無効になっています' },
                { status: 401 }
            )
        }

        // サーバー時刻を使用
        const now = new Date()
        const today = new Date(now)
        today.setHours(0, 0, 0, 0)

        // 今日すでに出勤しているかチェック
        const existingEntry = await prisma.timeEntry.findFirst({
            where: {
                employeeId: employee.id,
                date: today,
            },
        })

        if (existingEntry) {
            return NextResponse.json(
                { error: '本日はすでに出勤打刻済みです' },
                { status: 400 }
            )
        }

        // 休日チェック
        const calendar = await prisma.businessCalendar.findUnique({
            where: { date: today },
        })
        const isHolidayWork = calendar?.isHoliday ?? false

        // 出勤打刻を作成
        const timeEntry = await prisma.timeEntry.create({
            data: {
                employeeId: employee.id,
                date: today,
                clockIn: now,
                isHolidayWork,
            },
        })

        // 監査ログ
        await createAuditLog({
            userId: employee.id,
            action: 'CLOCK_IN',
            targetType: 'TimeEntry',
            targetId: timeEntry.id,
            newValue: {
                clockIn: now.toISOString(),
                isHolidayWork,
            },
            ipAddress: getIpAddress(request),
        })

        return NextResponse.json({
            success: true,
            clockIn: now.toLocaleTimeString('ja-JP', {
                hour: '2-digit',
                minute: '2-digit',
            }),
            isHolidayWork,
        })
    } catch (error) {
        console.error('Clock-in error:', error)
        return NextResponse.json(
            { error: '出勤打刻中にエラーが発生しました' },
            { status: 500 }
        )
    }
}
