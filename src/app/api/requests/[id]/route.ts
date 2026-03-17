import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { logAction } from '@/lib/audit'
import { z } from 'zod'

interface RouteParams {
    params: Promise<{ id: string }>
}

const processRequestSchema = z.object({
    type: z.enum(['attendance_adjustment', 'paid_leave']),
    action: z.enum(['approve', 'reject']),
    rejectedReason: z.string().optional(),
})

// 申請承認/却下
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await requireAdmin()
        const { id } = await params
        const body = await request.json()

        const parsed = processRequestSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: '入力データが不正です', details: parsed.error.errors } },
                { status: 400 }
            )
        }

        const { type, action, rejectedReason } = parsed.data
        const now = new Date()

        if (type === 'attendance_adjustment') {
            const adjustmentRequest = await prisma.attendanceAdjustmentRequest.findUnique({
                where: { id },
            })

            if (!adjustmentRequest) {
                return NextResponse.json(
                    { success: false, error: { code: 'NOT_FOUND', message: '申請が見つかりません' } },
                    { status: 404 }
                )
            }

            if (adjustmentRequest.status !== 'pending') {
                return NextResponse.json(
                    { success: false, error: { code: 'ALREADY_PROCESSED', message: 'この申請は既に処理されています' } },
                    { status: 400 }
                )
            }

            const newStatus = action === 'approve' ? 'approved' : 'rejected'

            const updatedRequest = await prisma.attendanceAdjustmentRequest.update({
                where: { id },
                data: {
                    status: newStatus,
                    approvedBy: action === 'approve' ? user.id : null,
                    approvedAt: action === 'approve' ? now : null,
                    rejectedReason: action === 'reject' ? (rejectedReason ?? null) : null,
                },
            })

            // On approval, update the attendance record with requested values
            if (action === 'approve') {
                const updateData: Record<string, unknown> = {
                    status: 'adjusted',
                }
                if (adjustmentRequest.requestedClockInAt !== null) {
                    updateData.clockInAt = adjustmentRequest.requestedClockInAt
                }
                if (adjustmentRequest.requestedClockOutAt !== null) {
                    updateData.clockOutAt = adjustmentRequest.requestedClockOutAt
                }
                if (adjustmentRequest.requestedBreakMinutes !== null) {
                    updateData.breakMinutes = adjustmentRequest.requestedBreakMinutes
                }

                await prisma.attendanceRecord.update({
                    where: { id: adjustmentRequest.attendanceRecordId },
                    data: updateData,
                })
            }

            await logAction(user, action === 'approve' ? 'APPROVE' : 'REJECT', 'AttendanceAdjustmentRequest', id, {
                beforeJson: { status: 'pending' },
                afterJson: { status: newStatus, rejectedReason: rejectedReason ?? null },
            })

            return NextResponse.json({ success: true, data: { request: updatedRequest } })
        } else if (type === 'paid_leave') {
            const paidLeaveRequest = await prisma.paidLeaveRequest.findUnique({
                where: { id },
            })

            if (!paidLeaveRequest) {
                return NextResponse.json(
                    { success: false, error: { code: 'NOT_FOUND', message: '申請が見つかりません' } },
                    { status: 404 }
                )
            }

            if (paidLeaveRequest.status !== 'pending') {
                return NextResponse.json(
                    { success: false, error: { code: 'ALREADY_PROCESSED', message: 'この申請は既に処理されています' } },
                    { status: 400 }
                )
            }

            const newStatus = action === 'approve' ? 'approved' : 'rejected'

            const updatedRequest = await prisma.paidLeaveRequest.update({
                where: { id },
                data: {
                    status: newStatus,
                    approvedBy: action === 'approve' ? user.id : null,
                    approvedAt: action === 'approve' ? now : null,
                    rejectedReason: action === 'reject' ? (rejectedReason ?? null) : null,
                },
            })

            // On approval, upsert an attendance record marked with zero work (absence via paid leave)
            if (action === 'approve') {
                const leaveDate = new Date(paidLeaveRequest.leaveDate)
                leaveDate.setHours(0, 0, 0, 0)

                await prisma.attendanceRecord.upsert({
                    where: {
                        employeeId_workDate: {
                            employeeId: paidLeaveRequest.employeeId,
                            workDate: leaveDate,
                        },
                    },
                    create: {
                        employeeId: paidLeaveRequest.employeeId,
                        workDate: leaveDate,
                        status: 'confirmed',
                        notes: `有給休暇 (${paidLeaveRequest.leaveUnit})`,
                    },
                    update: {
                        notes: `有給休暇 (${paidLeaveRequest.leaveUnit})`,
                        status: 'confirmed',
                    },
                })
            }

            await logAction(user, action === 'approve' ? 'APPROVE' : 'REJECT', 'PaidLeaveRequest', id, {
                beforeJson: { status: 'pending' },
                afterJson: { status: newStatus, rejectedReason: rejectedReason ?? null },
            })

            return NextResponse.json({ success: true, data: { request: updatedRequest } })
        }

        return NextResponse.json(
            { success: false, error: { code: 'INVALID_TYPE', message: '無効な申請タイプです' } },
            { status: 400 }
        )
    } catch (error) {
        console.error('Process request error:', error)
        if (error instanceof Error && (error.message.includes('権限') || error.message.includes('認証'))) {
            return NextResponse.json(
                { success: false, error: { code: 'FORBIDDEN', message: error.message } },
                { status: 403 }
            )
        }
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: '申請の処理中にエラーが発生しました' } },
            { status: 500 }
        )
    }
}
