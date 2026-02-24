import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { generateShiftPdfData } from '@/lib/pdf'
import { sendShiftPdfEmail } from '@/lib/mail'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await requireAdmin()
        const { id } = await params

        const shiftRequest = await prisma.shiftRequest.findUnique({
            where: { id },
            include: {
                employee: true,
                shiftEntries: {
                    orderBy: { date: 'asc' }
                }
            }
        })

        if (!shiftRequest) {
            return NextResponse.json({ error: 'シフト申請が見つかりません' }, { status: 404 })
        }

        if (shiftRequest.status !== 'CONFIRMED') {
            return NextResponse.json({ error: 'シフトが確定していません' }, { status: 400 })
        }

        const pdfBuffer = await generateShiftPdfData([shiftRequest], shiftRequest.yearMonth)

        await sendShiftPdfEmail({
            employeeEmail: shiftRequest.employee.email,
            employeeName: shiftRequest.employee.name,
            yearMonth: shiftRequest.yearMonth,
            pdfBuffer,
            pdfFilename: `shift_${shiftRequest.yearMonth}_${shiftRequest.employee.employeeCode}.pdf`
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Send shift PDF error:', error)
        return NextResponse.json(
            { error: 'PDFの送信中にエラーが発生しました' },
            { status: 500 }
        )
    }
}
