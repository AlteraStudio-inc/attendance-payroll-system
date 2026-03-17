import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { logAction } from '@/lib/audit'
import { z } from 'zod'

const createAttendanceAdjustmentSchema = z.object({
    type: z.literal('attendance_adjustment'),
    attendanceRecordId: z.string().min(1),
    requestedClockInAt: z.string().optional(),
    requestedClockOutAt: z.string().optional(),
    requestedBreakMinutes: z.number().int().min(0).optional(),
    reason: z.string().min(1),
})

const createPaidLeaveSchema = z.object({
    type: z.literal('paid_leave'),
    leaveDate: z.string().min(1),
    leaveUnit: z.enum(['full_day', 'half_day', 'hourly']).default('full_day'),
    reason: z.string().optional(),
})

const createRequestSchema = z.discriminatedUnion('type', [
    createAttendanceAdjustmentSchema,
    createPaidLeaveSchema,
])

export async function GET() {
    try {
        const user = await requireAuth()

        if (!user.employeeId) {
            return NextResponse.json(
                { success: false, error: { code: 'NO_EMPLOYEE', message: '従業員情報が見つかりません' } },
                { status: 403 }
            )
        }

        const [adjustmentRequests, paidLeaveRequests] = await Promise.all([
            prisma.attendanceAdjustmentRequest.findMany({
                where: { employeeId: user.employeeId },
                orderBy: { createdAt: 'desc' },
                take: 50,
                include: {
                    attendanceRecord: {
                        select: { workDate: true, clockInAt: true, clockOutAt: true },
                    },
                },
            }),
            prisma.paidLeaveRequest.findMany({
                where: { employeeId: user.employeeId },
                orderBy: { createdAt: 'desc' },
                take: 50,
            }),
        ])

        const requests = [
            ...adjustmentRequests.map((r) => ({
                id: r.id,
                type: 'attendance_adjustment' as const,
                status: r.status,
                workDate: r.attendanceRecord.workDate.toISOString(),
                requestedClockInAt: r.requestedClockInAt?.toISOString() ?? null,
                requestedClockOutAt: r.requestedClockOutAt?.toISOString() ?? null,
                requestedBreakMinutes: r.requestedBreakMinutes ?? null,
                reason: r.reason,
                approvedAt: r.approvedAt?.toISOString() ?? null,
                rejectedReason: r.rejectedReason ?? null,
                createdAt: r.createdAt.toISOString(),
            })),
            ...paidLeaveRequests.map((r) => ({
                id: r.id,
                type: 'paid_leave' as const,
                status: r.status,
                leaveDate: r.leaveDate.toISOString(),
                leaveUnit: r.leaveUnit,
                reason: r.reason ?? null,
                approvedAt: r.approvedAt?.toISOString() ?? null,
                rejectedReason: r.rejectedReason ?? null,
                createdAt: r.createdAt.toISOString(),
            })),
        ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

        return NextResponse.json({ success: true, data: { requests } })
    } catch (error) {
        console.error('Get employee requests error:', error)
        if (error instanceof Error && error.message.includes('認証')) {
            return NextResponse.json(
                { success: false, error: { code: 'UNAUTHORIZED', message: error.message } },
                { status: 401 }
            )
        }
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: '申請の取得中にエラーが発生しました' } },
            { status: 500 }
        )
    }
}

export async function POST(request: NextRequest) {
    try {
        const user = await requireAuth()

        if (!user.employeeId) {
            return NextResponse.json(
                { success: false, error: { code: 'NO_EMPLOYEE', message: '従業員情報が見つかりません' } },
                { status: 403 }
            )
        }

        const body = await request.json()
        const parsed = createRequestSchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: '入力データが不正です', details: parsed.error.errors } },
                { status: 400 }
            )
        }

        const data = parsed.data

        if (data.type === 'attendance_adjustment') {
            // Verify the attendance record belongs to this employee
            const record = await prisma.attendanceRecord.findUnique({
                where: { id: data.attendanceRecordId },
            })

            if (!record) {
                return NextResponse.json(
                    { success: false, error: { code: 'NOT_FOUND', message: '対象の勤怠記録が見つかりません' } },
                    { status: 404 }
                )
            }

            if (record.employeeId !== user.employeeId) {
                return NextResponse.json(
                    { success: false, error: { code: 'FORBIDDEN', message: '他の従業員の勤怠に対して申請することはできません' } },
                    { status: 403 }
                )
            }

            const adjustmentRequest = await prisma.attendanceAdjustmentRequest.create({
                data: {
                    employeeId: user.employeeId,
                    attendanceRecordId: data.attendanceRecordId,
                    requestedClockInAt: data.requestedClockInAt ? new Date(data.requestedClockInAt) : null,
                    requestedClockOutAt: data.requestedClockOutAt ? new Date(data.requestedClockOutAt) : null,
                    requestedBreakMinutes: data.requestedBreakMinutes ?? null,
                    reason: data.reason,
                },
            })

            await logAction(user, 'CREATE', 'AttendanceAdjustmentRequest', adjustmentRequest.id, {
                afterJson: { attendanceRecordId: data.attendanceRecordId, reason: data.reason },
            })

            return NextResponse.json(
                { success: true, data: { request: adjustmentRequest } },
                { status: 201 }
            )
        } else {
            // paid_leave
            const paidLeaveRequest = await prisma.paidLeaveRequest.create({
                data: {
                    employeeId: user.employeeId,
                    leaveDate: new Date(data.leaveDate),
                    leaveUnit: data.leaveUnit,
                    reason: data.reason ?? null,
                },
            })

            await logAction(user, 'CREATE', 'PaidLeaveRequest', paidLeaveRequest.id, {
                afterJson: { leaveDate: data.leaveDate, leaveUnit: data.leaveUnit, reason: data.reason },
            })

            return NextResponse.json(
                { success: true, data: { request: paidLeaveRequest } },
                { status: 201 }
            )
        }
    } catch (error) {
        console.error('Create employee request error:', error)
        if (error instanceof Error && error.message.includes('認証')) {
            return NextResponse.json(
                { success: false, error: { code: 'UNAUTHORIZED', message: error.message } },
                { status: 401 }
            )
        }
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: '申請の作成中にエラーが発生しました' } },
            { status: 500 }
        )
    }
}
