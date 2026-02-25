import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { generateMonthlyShiftMatrixPdfData } from '@/lib/pdf'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
    try {
        const adminResult = await requireAdmin()
        if (adminResult instanceof NextResponse) return adminResult

        const { searchParams } = new URL(req.url)
        const yearMonth = searchParams.get('yearMonth')

        if (!yearMonth) {
            return NextResponse.json({ error: '対象年月が指定されていません' }, { status: 400 })
        }

        // 確定済みのシフト申請を取得
        const requests = await prisma.shiftRequest.findMany({
            where: {
                yearMonth,
                status: 'CONFIRMED'
            },
            include: {
                employee: true,
                shiftEntries: {
                    orderBy: { date: 'asc' }
                }
            },
            orderBy: { // 従業員コードなどでソート
                employee: { employeeCode: 'asc' }
            }
        })

        // PDFを生成 (マトリックス形式)
        const pdfBuffer = await generateMonthlyShiftMatrixPdfData(yearMonth, requests)

        return new NextResponse(new Uint8Array(pdfBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="shift_${yearMonth}.pdf"`,
            },
        })
    } catch (error) {
        console.error('シフト表PDF生成エラー:', error)
        return NextResponse.json(
            { error: 'PDFの生成中にエラーが発生しました' },
            { status: 500 }
        )
    }
}
