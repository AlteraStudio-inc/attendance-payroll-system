import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await requireAdmin()
        const { id } = await params

        const shiftRequest = await prisma.shiftRequest.findUnique({
            where: { id },
            include: { shiftEntries: true }
        })

        if (!shiftRequest) {
            return NextResponse.json({ error: 'シフト申請が見つかりません' }, { status: 404 })
        }

        const updated = await prisma.shiftRequest.update({
            where: { id },
            data: {
                status: 'CONFIRMED',
                shiftEntries: {
                    updateMany: {
                        where: { shiftRequestId: id },
                        data: { isConfirmed: true }
                    }
                }
            },
            include: {
                employee: true,
                shiftEntries: true
            }
        })

        return NextResponse.json({ success: true, request: updated })
    } catch (error) {
        console.error('Confirm shift error:', error)
        return NextResponse.json(
            { error: 'シフトの承認中にエラーが発生しました' },
            { status: 500 }
        )
    }
}
