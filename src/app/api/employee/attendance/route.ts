import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { startOfMonth, endOfMonth } from 'date-fns'

export async function GET(request: NextRequest) {
    try {
        const user = await requireAuth()

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

        const entries = await prisma.timeEntry.findMany({
            where: {
                employeeId: user.id,
                date: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            orderBy: { date: 'desc' },
        })

        return NextResponse.json({
            entries: entries.map((e) => ({
                id: e.id,
                date: e.date.toISOString(),
                clockIn: e.clockIn.toISOString(),
                clockOut: e.clockOut?.toISOString() ?? null,
                isHolidayWork: e.isHolidayWork,
                isPaidLeave: e.isPaidLeave,
            })),
        })
    } catch (error) {
        console.error('Get employee attendance error:', error)
        return NextResponse.json(
            { error: '勤怠の取得中にエラーが発生しました' },
            { status: 500 }
        )
    }
}
