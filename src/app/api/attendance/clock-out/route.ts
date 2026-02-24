import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAuditLog, getIpAddress } from '@/lib/audit'

export async function POST(request: NextRequest) {
    try {
        const { employeeCode, note } = await request.json()

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

        // 今日の出勤記録をチェック
        const existingEntry = await prisma.timeEntry.findFirst({
            where: {
                employeeId: employee.id,
                date: today,
            },
        })

        if (!existingEntry) {
            return NextResponse.json(
                { error: '本日は出勤打刻されていません' },
                { status: 400 }
            )
        }

        if (existingEntry.clockOut) {
            return NextResponse.json(
                { error: '本日はすでに退勤打刻済みです' },
                { status: 400 }
            )
        }

        // 既存のnoteがある場合は、退勤時のnoteを追記する
        let updatedNote = existingEntry.note
        if (note) {
            updatedNote = updatedNote ? `${updatedNote} / 【退勤時】${note}` : note
        }

        // 退勤打刻を更新
        const updatedEntry = await prisma.timeEntry.update({
            where: { id: existingEntry.id },
            data: {
                clockOut: now,
                note: updatedNote,
            },
        })

        // 監査ログ
        await createAuditLog({
            userId: employee.id,
            action: 'CLOCK_OUT',
            targetType: 'TimeEntry',
            targetId: updatedEntry.id,
            oldValue: {
                clockOut: null,
            },
            newValue: {
                clockOut: now.toISOString(),
            },
            ipAddress: getIpAddress(request),
        })

        return NextResponse.json({
            success: true,
            clockOut: now.toLocaleTimeString('ja-JP', {
                hour: '2-digit',
                minute: '2-digit',
            }),
        })
    } catch (error) {
        console.error('Clock-out error:', error)
        return NextResponse.json(
            { error: '退勤打刻中にエラーが発生しました' },
            { status: 500 }
        )
    }
}
