import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function GET() {
    try {
        const user = await requireAuth()

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const entry = await prisma.timeEntry.findFirst({
            where: {
                employeeId: user.id,
                date: today,
            },
        })

        return NextResponse.json({
            hasClockedIn: !!entry,
            hasClockedOut: !!entry?.clockOut,
            clockIn: entry?.clockIn?.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) ?? null,
            clockOut: entry?.clockOut?.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) ?? null,
        })
    } catch (error) {
        console.error('Get today status error:', error)
        return NextResponse.json(
            { error: '取得中にエラーが発生しました' },
            { status: 500 }
        )
    }
}
