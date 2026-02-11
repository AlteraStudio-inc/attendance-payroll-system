import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { logAction, getIpAddress } from '@/lib/audit'

interface RouteParams {
    params: Promise<{ id: string }>
}

// 申請承認/却下
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await requireAdmin()
        const { id } = await params
        const body = await request.json()
        const { type, action } = body // type: work_time | paid_leave, action: approve | reject

        if (!['approve', 'reject'].includes(action)) {
            return NextResponse.json(
                { error: '無効なアクションです' },
                { status: 400 }
            )
        }

        const status = action === 'approve' ? 'APPROVED' : 'REJECTED'
        const now = new Date()

        if (type === 'work_time') {
            const request = await prisma.workTimeRequest.findUnique({
                where: { id },
                include: { timeEntry: true },
            })

            if (!request) {
                return NextResponse.json(
                    { error: '申請が見つかりません' },
                    { status: 404 }
                )
            }

            if (request.status !== 'PENDING') {
                return NextResponse.json(
                    { error: 'この申請は既に処理されています' },
                    { status: 400 }
                )
            }

            // 申請を更新
            const updatedRequest = await prisma.workTimeRequest.update({
                where: { id },
                data: {
                    status,
                    reviewedById: user.id,
                    reviewedAt: now,
                },
            })

            // 承認の場合、勤怠を更新
            if (action === 'approve' && request.timeEntry) {
                await prisma.timeEntry.update({
                    where: { id: request.timeEntryId },
                    data: {
                        clockIn: request.requestedClockIn,
                        clockOut: request.requestedClockOut,
                        modifiedById: user.id,
                        modifiedAt: now,
                    },
                })
            }

            await logAction(user, action === 'approve' ? 'APPROVE' : 'REJECT', 'WorkTimeRequest', id, {
                oldValue: { status: 'PENDING' },
                newValue: { status },
                ipAddress: getIpAddress(request as unknown as Request),
            })

            return NextResponse.json({ request: updatedRequest })
        } else if (type === 'paid_leave') {
            const paidLeaveRequest = await prisma.paidLeaveRequest.findUnique({
                where: { id },
            })

            if (!paidLeaveRequest) {
                return NextResponse.json(
                    { error: '申請が見つかりません' },
                    { status: 404 }
                )
            }

            if (paidLeaveRequest.status !== 'PENDING') {
                return NextResponse.json(
                    { error: 'この申請は既に処理されています' },
                    { status: 400 }
                )
            }

            const updatedRequest = await prisma.paidLeaveRequest.update({
                where: { id },
                data: {
                    status,
                    reviewedById: user.id,
                    reviewedAt: now,
                },
            })

            // 承認の場合、勤怠に有給として記録
            if (action === 'approve') {
                const leaveDate = new Date(paidLeaveRequest.leaveDate)
                leaveDate.setHours(0, 0, 0, 0)

                await prisma.timeEntry.upsert({
                    where: {
                        employeeId_date: {
                            employeeId: paidLeaveRequest.employeeId,
                            date: leaveDate,
                        },
                    },
                    create: {
                        employeeId: paidLeaveRequest.employeeId,
                        date: leaveDate,
                        clockIn: leaveDate,
                        clockOut: leaveDate,
                        isPaidLeave: true,
                    },
                    update: {
                        isPaidLeave: true,
                    },
                })
            }

            await logAction(user, action === 'approve' ? 'APPROVE' : 'REJECT', 'PaidLeaveRequest', id, {
                oldValue: { status: 'PENDING' },
                newValue: { status },
                ipAddress: getIpAddress(request as unknown as Request),
            })

            return NextResponse.json({ request: updatedRequest })
        }

        return NextResponse.json(
            { error: '無効な申請タイプです' },
            { status: 400 }
        )
    } catch (error) {
        console.error('Process request error:', error)
        if (error instanceof Error && error.message === '管理者権限が必要です') {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        return NextResponse.json(
            { error: '申請の処理中にエラーが発生しました' },
            { status: 500 }
        )
    }
}
