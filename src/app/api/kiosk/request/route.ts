import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPin } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import { startOfDay, endOfDay, subDays } from 'date-fns'

async function authenticateKiosk(
    employeeCode: string,
    pin: string
): Promise<{ success: true; employee: { id: string; name: string; employeeCode: string } } | { success: false; status: number; code: string; message: string }> {
    if (!employeeCode || !pin) {
        return { success: false, status: 400, code: 'MISSING_FIELDS', message: '従業員コードとPINを入力してください' }
    }

    const employee = await prisma.employee.findUnique({ where: { employeeCode } })

    if (!employee || !employee.active) {
        return { success: false, status: 401, code: 'INVALID_CREDENTIALS', message: '認証に失敗しました' }
    }

    if (!employee.pinHash) {
        return { success: false, status: 401, code: 'INVALID_CREDENTIALS', message: '認証に失敗しました' }
    }

    const isValid = await verifyPin(pin, employee.pinHash)
    if (!isValid) {
        return { success: false, status: 401, code: 'INVALID_CREDENTIALS', message: '認証に失敗しました' }
    }

    return { success: true, employee: { id: employee.id, name: employee.name, employeeCode: employee.employeeCode } }
}

// キオスクからの申請（PIN認証付き）
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { employeeCode, pin, type, leaveDate, leaveUnit, reason, attendanceRecordId, requestedClockInAt, requestedClockOutAt, requestedBreakMinutes } = body

        const authResult = await authenticateKiosk(employeeCode, pin)
        if (!authResult.success) {
            return NextResponse.json(
                { success: false, error: { code: authResult.code, message: authResult.message } },
                { status: authResult.status }
            )
        }

        const { employee } = authResult

        if (type === 'paid_leave') {
            if (!leaveDate) {
                return NextResponse.json(
                    { success: false, error: { code: 'MISSING_FIELDS', message: '有給日を指定してください' } },
                    { status: 400 }
                )
            }

            const paidLeaveRequest = await prisma.paidLeaveRequest.create({
                data: {
                    employeeId: employee.id,
                    leaveDate: new Date(leaveDate),
                    leaveUnit: leaveUnit ?? 'full_day',
                    reason: reason ?? null,
                },
            })

            await createAuditLog({
                actorType: 'employee',
                actorId: employee.id,
                action: 'CREATE',
                targetType: 'PaidLeaveRequest',
                targetId: paidLeaveRequest.id,
                afterJson: { leaveDate, reason, source: 'kiosk' },
            })

            return NextResponse.json(
                { success: true, data: { request: paidLeaveRequest } },
                { status: 201 }
            )
        } else if (type === 'attendance_adjustment') {
            if (!attendanceRecordId || !reason) {
                return NextResponse.json(
                    { success: false, error: { code: 'MISSING_FIELDS', message: '必須項目が不足しています' } },
                    { status: 400 }
                )
            }

            const attendanceRecord = await prisma.attendanceRecord.findUnique({
                where: { id: attendanceRecordId },
            })

            if (!attendanceRecord) {
                return NextResponse.json(
                    { success: false, error: { code: 'NOT_FOUND', message: '対象の勤怠記録が見つかりません' } },
                    { status: 404 }
                )
            }

            if (attendanceRecord.employeeId !== employee.id) {
                return NextResponse.json(
                    { success: false, error: { code: 'FORBIDDEN', message: '他の従業員の勤怠に対して申請することはできません' } },
                    { status: 403 }
                )
            }

            const adjustmentRequest = await prisma.attendanceAdjustmentRequest.create({
                data: {
                    employeeId: employee.id,
                    attendanceRecordId,
                    requestedClockInAt: requestedClockInAt ? new Date(requestedClockInAt) : null,
                    requestedClockOutAt: requestedClockOutAt ? new Date(requestedClockOutAt) : null,
                    requestedBreakMinutes: requestedBreakMinutes ?? null,
                    reason,
                },
            })

            await createAuditLog({
                actorType: 'employee',
                actorId: employee.id,
                action: 'CREATE',
                targetType: 'AttendanceAdjustmentRequest',
                targetId: adjustmentRequest.id,
                afterJson: { attendanceRecordId, reason, source: 'kiosk' },
            })

            return NextResponse.json(
                { success: true, data: { request: adjustmentRequest } },
                { status: 201 }
            )
        }

        return NextResponse.json(
            { success: false, error: { code: 'INVALID_TYPE', message: '無効な申請タイプです' } },
            { status: 400 }
        )
    } catch (error) {
        console.error('Kiosk request error:', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: '申請の作成中にエラーが発生しました' } },
            { status: 500 }
        )
    }
}

// キオスクから自分の勤怠一覧を取得（打刻修正用）
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const employeeCode = searchParams.get('employeeCode')

        if (!employeeCode) {
            return NextResponse.json(
                { success: false, error: { code: 'MISSING_FIELDS', message: '従業員コードが必要です' } },
                { status: 400 }
            )
        }

        const employee = await prisma.employee.findUnique({
            where: { employeeCode },
        })

        if (!employee) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: '従業員が見つかりません' } },
                { status: 404 }
            )
        }

        const twoWeeksAgo = startOfDay(subDays(new Date(), 14))

        const records = await prisma.attendanceRecord.findMany({
            where: {
                employeeId: employee.id,
                workDate: { gte: twoWeeksAgo },
            },
            orderBy: { workDate: 'desc' },
            select: {
                id: true,
                workDate: true,
                clockInAt: true,
                clockOutAt: true,
                status: true,
            },
        })

        return NextResponse.json({
            success: true,
            data: {
                records: records.map((r) => ({
                    id: r.id,
                    workDate: r.workDate.toISOString(),
                    clockInAt: r.clockInAt?.toISOString() ?? null,
                    clockOutAt: r.clockOutAt?.toISOString() ?? null,
                    status: r.status,
                })),
            },
        })
    } catch (error) {
        console.error('Kiosk get records error:', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: '勤怠データの取得に失敗しました' } },
            { status: 500 }
        )
    }
}
