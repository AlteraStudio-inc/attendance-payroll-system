import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { startOfMonth, endOfMonth, eachDayOfInterval, format } from 'date-fns'

// カレンダー取得
export async function GET(request: NextRequest) {
    try {
        await requireAdmin()

        const { searchParams } = new URL(request.url)
        const yearMonth = searchParams.get('month') || format(new Date(), 'yyyy-MM')

        const [year, month] = yearMonth.split('-').map(Number)
        const startDate = startOfMonth(new Date(year, month - 1))
        const endDate = endOfMonth(startDate)

        const holidays = await prisma.businessCalendar.findMany({
            where: {
                date: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            orderBy: { date: 'asc' },
        })

        // 全日付を生成
        const allDays = eachDayOfInterval({ start: startDate, end: endDate })
        const calendar = allDays.map((date) => {
            const holiday = holidays.find(
                (h) => h.date.toISOString().split('T')[0] === date.toISOString().split('T')[0]
            )
            const dayOfWeek = date.getDay()
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

            return {
                date: format(date, 'yyyy-MM-dd'),
                dayOfWeek,
                isHoliday: holiday?.isHoliday ?? isWeekend,
                note: holiday?.note ?? null,
                id: holiday?.id ?? null,
            }
        })

        return NextResponse.json({ calendar, yearMonth })
    } catch (error) {
        console.error('Get calendar error:', error)
        if (error instanceof Error && error.message === '管理者権限が必要です') {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        return NextResponse.json(
            { error: 'カレンダーの取得中にエラーが発生しました' },
            { status: 500 }
        )
    }
}

// 休日設定の更新
export async function POST(request: NextRequest) {
    try {
        await requireAdmin()

        const body = await request.json()
        const { date, isHoliday, note } = body

        if (!date) {
            return NextResponse.json(
                { error: '日付が必要です' },
                { status: 400 }
            )
        }

        const targetDate = new Date(date)
        targetDate.setHours(0, 0, 0, 0)

        const calendar = await prisma.businessCalendar.upsert({
            where: { date: targetDate },
            create: {
                date: targetDate,
                isHoliday: isHoliday ?? true,
                note: note ?? null,
            },
            update: {
                isHoliday: isHoliday ?? true,
                note: note ?? null,
            },
        })

        return NextResponse.json({ calendar })
    } catch (error) {
        console.error('Update calendar error:', error)
        if (error instanceof Error && error.message === '管理者権限が必要です') {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        return NextResponse.json(
            { error: 'カレンダーの更新中にエラーが発生しました' },
            { status: 500 }
        )
    }
}
