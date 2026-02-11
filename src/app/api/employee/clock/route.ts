import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { createAuditLog, getIpAddress } from '@/lib/audit'

export async function POST(request: NextRequest) {
    try {
        const user = await requireAuth()
        const body = await request.json()
        const { action } = body

        const now = new Date()
        const today = new Date(now)
        today.setHours(0, 0, 0, 0)

        if (action === 'clock_in') {
            // 既存チェック
            const existing = await prisma.timeEntry.findFirst({
                where: {
                    employeeId: user.id,
                    date: today,
                },
            })

            if (existing) {
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

            const entry = await prisma.timeEntry.create({
                data: {
                    employeeId: user.id,
                    date: today,
                    clockIn: now,
                    isHolidayWork,
                },
            })

            await createAuditLog({
                userId: user.id,
                action: 'CLOCK_IN',
                targetType: 'TimeEntry',
                targetId: entry.id,
                newValue: { clockIn: now.toISOString() },
                ipAddress: getIpAddress(request),
            })

            return NextResponse.json({
                success: true,
                clockIn: now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
            })
        } else if (action === 'clock_out') {
            const entry = await prisma.timeEntry.findFirst({
                where: {
                    employeeId: user.id,
                    date: today,
                },
            })

            if (!entry) {
                return NextResponse.json(
                    { error: '本日は出勤打刻されていません' },
                    { status: 400 }
                )
            }

            if (entry.clockOut) {
                return NextResponse.json(
                    { error: '本日はすでに退勤打刻済みです' },
                    { status: 400 }
                )
            }

            await prisma.timeEntry.update({
                where: { id: entry.id },
                data: { clockOut: now },
            })

            await createAuditLog({
                userId: user.id,
                action: 'CLOCK_OUT',
                targetType: 'TimeEntry',
                targetId: entry.id,
                newValue: { clockOut: now.toISOString() },
                ipAddress: getIpAddress(request),
            })

            return NextResponse.json({
                success: true,
                clockOut: now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
            })
        }

        return NextResponse.json(
            { error: '無効なアクションです' },
            { status: 400 }
        )
    } catch (error) {
        console.error('Clock error:', error)
        return NextResponse.json(
            { error: '打刻中にエラーが発生しました' },
            { status: 500 }
        )
    }
}
