import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { startOfDay, endOfDay } from 'date-fns'

export async function GET() {
    try {
        const user = await requireAuth()

        if (!user.employeeId) {
            return NextResponse.json(
                { success: false, error: { code: 'NO_EMPLOYEE', message: '従業員情報が見つかりません' } },
                { status: 403 }
            )
        }

        const now = new Date()
        const todayStart = startOfDay(now)
        const todayEnd = endOfDay(now)

        const record = await prisma.attendanceRecord.findFirst({
            where: {
                employeeId: user.employeeId,
                workDate: {
                    gte: todayStart,
                    lte: todayEnd,
                },
            },
        })

        const formatTime = (dt: Date | null | undefined): string | null => {
            if (!dt) return null
            return dt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
        }

        return NextResponse.json({
            success: true,
            data: {
                hasClockedIn: !!record?.clockInAt,
                hasClockedOut: !!record?.clockOutAt,
                clockInAt: formatTime(record?.clockInAt),
                clockOutAt: formatTime(record?.clockOutAt),
                workDate: record?.workDate.toISOString() ?? null,
                status: record?.status ?? null,
                workedMinutesNet: record?.workedMinutesNet ?? null,
                breakMinutes: record?.breakMinutes ?? null,
                lateMinutes: record?.lateMinutes ?? null,
            },
        })
    } catch (error) {
        console.error('Get today status error:', error)
        if (error instanceof Error && error.message.includes('認証')) {
            return NextResponse.json(
                { success: false, error: { code: 'UNAUTHORIZED', message: error.message } },
                { status: 401 }
            )
        }
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: '取得中にエラーが発生しました' } },
            { status: 500 }
        )
    }
}
