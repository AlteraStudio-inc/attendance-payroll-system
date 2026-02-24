import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'

export async function GET(request: NextRequest) {
    try {
        await requireAdmin()

        const { searchParams } = new URL(request.url)
        const dateStr = searchParams.get('date') || new Date().toISOString().split('T')[0]
        const view = searchParams.get('view') || 'day'
        const employeeId = searchParams.get('employeeId')

        const baseDate = new Date(dateStr)
        let startDate: Date
        let endDate: Date

        switch (view) {
            case 'week':
                startDate = startOfWeek(baseDate, { weekStartsOn: 1 })
                endDate = endOfWeek(baseDate, { weekStartsOn: 1 })
                break
            case 'month':
            case 'employee_monthly':
                startDate = startOfMonth(baseDate)
                endDate = endOfMonth(baseDate)
                break
            default:
                startDate = startOfDay(baseDate)
                endDate = endOfDay(baseDate)
        }

        const whereClause: any = {
            date: {
                gte: startDate,
                lte: endDate,
            },
        }

        if (view === 'employee_monthly' && employeeId) {
            whereClause.employeeId = employeeId
        }

        const entries = await prisma.timeEntry.findMany({
            where: whereClause,
            orderBy: [{ date: 'desc' }, { clockIn: 'desc' }],
            include: {
                employee: {
                    select: { name: true, employeeCode: true },
                },
            },
        })

        return NextResponse.json({
            entries: entries.map((entry) => ({
                id: entry.id,
                employee: entry.employee,
                date: entry.date.toISOString(),
                clockIn: entry.clockIn.toISOString(),
                clockOut: entry.clockOut?.toISOString() ?? null,
                isHolidayWork: entry.isHolidayWork,
                isPaidLeave: entry.isPaidLeave,
                note: entry.note || '',
            })),
        })
    } catch (error) {
        console.error('Get attendance error:', error)
        if (error instanceof Error && error.message === '管理者権限が必要です') {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        return NextResponse.json(
            { error: '勤怠一覧の取得中にエラーが発生しました' },
            { status: 500 }
        )
    }
}
