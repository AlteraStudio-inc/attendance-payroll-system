import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { startOfMonth, endOfMonth, eachDayOfInterval, format } from 'date-fns'
import { generateBusinessCalendarPdfData } from '@/lib/pdf'

export async function POST(request: NextRequest) {
    try {
        await requireAdmin()

        const body = await request.json()
        const { yearMonth } = body

        if (!yearMonth) {
            return NextResponse.json({ error: 'パラメータが不足しています' }, { status: 400 })
        }

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

        const allDays = eachDayOfInterval({ start: startDate, end: endDate })
        const calendar = allDays.map((date) => {
            const dateStr = format(date, 'yyyy-MM-dd')
            const holiday = holidays.find(
                (h) => format(h.date, 'yyyy-MM-dd') === dateStr
            )
            const dayOfWeek = date.getDay()
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

            return {
                date: dateStr,
                dayOfWeek,
                isHoliday: holiday?.isHoliday ?? isWeekend,
                note: holiday?.note ?? null,
                id: holiday?.id ?? null,
            }
        })

        const pdfBuffer = await generateBusinessCalendarPdfData(calendar, yearMonth)

        return new NextResponse(pdfBuffer as any, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="calendar_${yearMonth}.pdf"`,
            }
        })
    } catch (error) {
        console.error('Calendar PDF generation error:', error)
        if (error instanceof Error && error.message === '管理者権限が必要です') {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        return NextResponse.json(
            { error: 'PDFの生成中にエラーが発生しました' },
            { status: 500 }
        )
    }
}
