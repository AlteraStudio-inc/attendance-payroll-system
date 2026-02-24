export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export async function GET() {
    try {
        await requireAdmin()

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const [
            totalEmployees,
            activeEmployees,
            todayClockIns,
            pendingWorkRequests,
            pendingLeaveRequests,
            draftPayrolls,
            recentEntries,
        ] = await Promise.all([
            prisma.employee.count(),
            prisma.employee.count({ where: { isActive: true } }),
            prisma.timeEntry.count({ where: { date: today } }),
            prisma.workTimeRequest.count({ where: { status: 'PENDING' } }),
            prisma.paidLeaveRequest.count({ where: { status: 'PENDING' } }),
            prisma.payrollRun.count({ where: { status: 'DRAFT' } }),
            prisma.timeEntry.findMany({
                where: { date: today },
                take: 10,
                orderBy: { clockIn: 'desc' },
                include: {
                    employee: {
                        select: { name: true },
                    },
                },
            }),
        ])

        const recentClockIns = recentEntries.map((entry) => ({
            id: entry.id,
            employeeName: entry.employee.name,
            clockIn: entry.clockIn.toLocaleTimeString('ja-JP', {
                hour: '2-digit',
                minute: '2-digit',
            }),
            clockOut: entry.clockOut?.toLocaleTimeString('ja-JP', {
                hour: '2-digit',
                minute: '2-digit',
            }) ?? null,
        }))

        return NextResponse.json({
            stats: {
                totalEmployees,
                activeEmployees,
                todayClockIns,
                pendingRequests: pendingWorkRequests + pendingLeaveRequests,
                unconfirmedPayrolls: draftPayrolls,
            },
            recentClockIns,
        })
    } catch (error) {
        console.error('Dashboard error:', error)
        if (error instanceof Error && error.message === '管理者権限が必要です') {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        return NextResponse.json(
            { error: 'ダッシュボードの取得中にエラーが発生しました' },
            { status: 500 }
        )
    }
}
