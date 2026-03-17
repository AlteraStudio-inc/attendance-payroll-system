export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { startOfDay, endOfDay } from 'date-fns'

export async function GET() {
    try {
        const user = await requireAdmin()

        const now = new Date()
        const todayStart = startOfDay(now)
        const todayEnd = endOfDay(now)

        const companyFilter = user.companyId ? { companyId: user.companyId } : {}

        const [
            totalEmployees,
            activeEmployees,
            todayAttendanceCount,
            pendingAdjustmentRequests,
            pendingLeaveRequests,
            draftPayrolls,
            recentEntries,
        ] = await Promise.all([
            prisma.employee.count({ where: { ...companyFilter } }),
            prisma.employee.count({ where: { ...companyFilter, active: true } }),
            prisma.attendanceRecord.count({
                where: {
                    workDate: { gte: todayStart, lte: todayEnd },
                    ...(user.companyId
                        ? { employee: { companyId: user.companyId } }
                        : {}),
                },
            }),
            prisma.attendanceAdjustmentRequest.count({
                where: {
                    status: 'pending',
                    ...(user.companyId
                        ? { employee: { companyId: user.companyId } }
                        : {}),
                },
            }),
            prisma.paidLeaveRequest.count({
                where: {
                    status: 'pending',
                    ...(user.companyId
                        ? { employee: { companyId: user.companyId } }
                        : {}),
                },
            }),
            prisma.payrollRun.count({
                where: {
                    ...companyFilter,
                    status: { in: ['draft', 'calculated'] },
                },
            }),
            prisma.attendanceRecord.findMany({
                where: {
                    workDate: { gte: todayStart, lte: todayEnd },
                    ...(user.companyId
                        ? { employee: { companyId: user.companyId } }
                        : {}),
                },
                take: 10,
                orderBy: { clockInAt: 'desc' },
                include: {
                    employee: {
                        select: { name: true, employeeCode: true },
                    },
                },
            }),
        ])

        const recentClockIns = recentEntries.map((entry) => ({
            id: entry.id,
            employeeName: entry.employee.name,
            employeeCode: entry.employee.employeeCode,
            clockInAt: entry.clockInAt
                ? entry.clockInAt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
                : null,
            clockOutAt: entry.clockOutAt
                ? entry.clockOutAt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
                : null,
            status: entry.status,
        }))

        return NextResponse.json({
            success: true,
            data: {
                stats: {
                    totalEmployees,
                    activeEmployees,
                    todayClockIns: todayAttendanceCount,
                    pendingRequests: pendingAdjustmentRequests + pendingLeaveRequests,
                    pendingAdjustmentRequests,
                    pendingLeaveRequests,
                    unconfirmedPayrolls: draftPayrolls,
                },
                recentClockIns,
            },
        })
    } catch (error) {
        console.error('Dashboard error:', error)
        if (error instanceof Error && (error.message.includes('権限') || error.message.includes('認証'))) {
            return NextResponse.json(
                { success: false, error: { code: 'FORBIDDEN', message: error.message } },
                { status: 403 }
            )
        }
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'ダッシュボードの取得中にエラーが発生しました' } },
            { status: 500 }
        )
    }
}
