import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function GET() {
    try {
        const user = await requireAuth()

        const [workTimeRequests, paidLeaveRequests] = await Promise.all([
            prisma.workTimeRequest.findMany({
                where: { employeeId: user.id },
                orderBy: { createdAt: 'desc' },
                include: { timeEntry: true },
                take: 50,
            }),
            prisma.paidLeaveRequest.findMany({
                where: { employeeId: user.id },
                orderBy: { createdAt: 'desc' },
                take: 50,
            }),
        ])

        const requests = [
            ...workTimeRequests.map((r) => ({
                id: r.id,
                type: 'work_time' as const,
                status: r.status,
                date: r.timeEntry?.date?.toISOString() || r.createdAt.toISOString(),
                reason: r.reason,
                createdAt: r.createdAt.toISOString(),
            })),
            ...paidLeaveRequests.map((r) => ({
                id: r.id,
                type: 'paid_leave' as const,
                status: r.status,
                date: r.leaveDate.toISOString(),
                reason: r.reason,
                createdAt: r.createdAt.toISOString(),
            })),
        ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

        return NextResponse.json({ requests })
    } catch (error) {
        console.error('Get employee requests error:', error)
        return NextResponse.json(
            { error: '申請の取得中にエラーが発生しました' },
            { status: 500 }
        )
    }
}
