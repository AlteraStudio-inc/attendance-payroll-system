import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { startOfMonth, endOfMonth } from 'date-fns'

export async function GET(request: NextRequest) {
    try {
        const user = await requireAuth()

        if (!user.employeeId) {
            return NextResponse.json(
                { success: false, error: { code: 'NO_EMPLOYEE', message: '従業員情報が見つかりません' } },
                { status: 403 }
            )
        }

        const { searchParams } = new URL(request.url)
        const monthStr = searchParams.get('month')

        let startDate: Date
        let endDate: Date

        if (monthStr) {
            const [year, month] = monthStr.split('-').map(Number)
            startDate = startOfMonth(new Date(year, month - 1))
            endDate = endOfMonth(startDate)
        } else {
            startDate = startOfMonth(new Date())
            endDate = endOfMonth(new Date())
        }

        const records = await prisma.attendanceRecord.findMany({
            where: {
                employeeId: user.employeeId,
                workDate: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            orderBy: { workDate: 'desc' },
        })

        return NextResponse.json({
            success: true,
            data: {
                records: records.map((r) => ({
                    id: r.id,
                    workDate: r.workDate.toISOString(),
                    clockInAt: r.clockInAt?.toISOString() ?? null,
                    clockOutAt: r.clockOutAt?.toISOString() ?? null,
                    breakMinutes: r.breakMinutes,
                    workedMinutesRaw: r.workedMinutesRaw,
                    workedMinutesNet: r.workedMinutesNet,
                    lateMinutes: r.lateMinutes,
                    earlyLeaveMinutes: r.earlyLeaveMinutes,
                    absenceMinutes: r.absenceMinutes,
                    normalOvertimeMinutes: r.normalOvertimeMinutes,
                    lateNightMinutes: r.lateNightMinutes,
                    status: r.status,
                    notes: r.notes,
                })),
            },
        })
    } catch (error) {
        console.error('Get employee attendance error:', error)
        if (error instanceof Error && error.message.includes('認証')) {
            return NextResponse.json(
                { success: false, error: { code: 'UNAUTHORIZED', message: error.message } },
                { status: 401 }
            )
        }
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: '勤怠の取得中にエラーが発生しました' } },
            { status: 500 }
        )
    }
}
