import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { startOfMonth, endOfMonth } from 'date-fns'
import { generateAttendanceRecordPdfData } from '@/lib/pdf'

export async function POST(request: NextRequest) {
    try {
        await requireAdmin()
        const body = await request.json()
        const { employeeId, yearMonth } = body

        if (!employeeId || !yearMonth) {
            return NextResponse.json({ error: 'パラメータが不足しています' }, { status: 400 })
        }

        const employee = await prisma.employee.findUnique({
            where: { id: employeeId }
        })

        if (!employee) {
            return NextResponse.json({ error: '従業員が見つかりません' }, { status: 404 })
        }

        const [year, month] = yearMonth.split('-')
        const startDate = startOfMonth(new Date(Number(year), Number(month) - 1))
        const endDate = endOfMonth(startDate)

        const entries = await prisma.timeEntry.findMany({
            where: {
                employeeId,
                date: {
                    gte: startDate,
                    lte: endDate
                }
            },
            orderBy: [{ date: 'asc' }, { clockIn: 'asc' }]
        })

        const pdfBuffer = await generateAttendanceRecordPdfData(employee, entries, yearMonth)

        return new NextResponse(pdfBuffer as any, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="attendance_${yearMonth}.pdf"`,
            }
        })
    } catch (error) {
        console.error('Attendance PDF generation error:', error)
        if (error instanceof Error && error.message === '管理者権限が必要です') {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        return NextResponse.json(
            { error: 'PDFの生成中にエラーが発生しました: ' + (error instanceof Error ? error.message : String(error)) },
            { status: 500 }
        )
    }
}
