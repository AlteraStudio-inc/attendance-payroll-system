import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, requireAuth } from '@/lib/auth'
import { logAction, getIpAddress } from '@/lib/audit'

// 申請一覧取得
export async function GET(request: NextRequest) {
    try {
        const user = await requireAuth()
        const { searchParams } = new URL(request.url)
        const type = searchParams.get('type') || 'all' // work_time, paid_leave, all
        const status = searchParams.get('status') || 'all' // PENDING, APPROVED, REJECTED, all

        const isAdmin = user.role === 'ADMIN'
        const employeeFilter = isAdmin ? {} : { employeeId: user.id }
        const statusFilter = status !== 'all' ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' } : {}

        const results: {
            workTimeRequests: unknown[]
            paidLeaveRequests: unknown[]
        } = {
            workTimeRequests: [],
            paidLeaveRequests: [],
        }

        if (type === 'all' || type === 'work_time') {
            results.workTimeRequests = await prisma.workTimeRequest.findMany({
                where: { ...employeeFilter, ...statusFilter },
                orderBy: { createdAt: 'desc' },
                include: {
                    employee: { select: { name: true, employeeCode: true } },
                    timeEntry: { select: { date: true, clockIn: true, clockOut: true } },
                    reviewedBy: { select: { name: true } },
                },
            })
        }

        if (type === 'all' || type === 'paid_leave') {
            results.paidLeaveRequests = await prisma.paidLeaveRequest.findMany({
                where: { ...employeeFilter, ...statusFilter },
                orderBy: { createdAt: 'desc' },
                include: {
                    employee: { select: { name: true, employeeCode: true } },
                    reviewedBy: { select: { name: true } },
                },
            })
        }

        return NextResponse.json(results)
    } catch (error) {
        console.error('Get requests error:', error)
        return NextResponse.json(
            { error: '申請一覧の取得中にエラーが発生しました' },
            { status: 500 }
        )
    }
}

// 労働時間修正申請を作成
export async function POST(request: NextRequest) {
    try {
        const user = await requireAuth()
        const body = await request.json()
        const { type, timeEntryId, requestedClockIn, requestedClockOut, reason, leaveDate } = body

        if (type === 'work_time') {
            if (!timeEntryId || !requestedClockIn || !requestedClockOut || !reason) {
                return NextResponse.json(
                    { error: '必須項目が不足しています' },
                    { status: 400 }
                )
            }

            // 対象の勤怠を確認
            const timeEntry = await prisma.timeEntry.findUnique({
                where: { id: timeEntryId },
            })

            if (!timeEntry) {
                return NextResponse.json(
                    { error: '対象の勤怠記録が見つかりません' },
                    { status: 404 }
                )
            }

            // 自分の勤怠かどうか確認（管理者以外）
            if (user.role !== 'ADMIN' && timeEntry.employeeId !== user.id) {
                return NextResponse.json(
                    { error: '他の従業員の勤怠に対して申請することはできません' },
                    { status: 403 }
                )
            }

            const workTimeRequest = await prisma.workTimeRequest.create({
                data: {
                    employeeId: timeEntry.employeeId,
                    timeEntryId,
                    requestedClockIn: new Date(requestedClockIn),
                    requestedClockOut: new Date(requestedClockOut),
                    reason,
                },
            })

            await logAction(user, 'CREATE', 'WorkTimeRequest', workTimeRequest.id, {
                newValue: { timeEntryId, reason },
                ipAddress: getIpAddress(request),
            })

            return NextResponse.json({ request: workTimeRequest }, { status: 201 })
        } else if (type === 'paid_leave') {
            if (!leaveDate) {
                return NextResponse.json(
                    { error: '有給日を指定してください' },
                    { status: 400 }
                )
            }

            // 従業員を取得
            const employee = await prisma.employee.findUnique({
                where: { id: user.id },
            })

            if (!employee) {
                return NextResponse.json(
                    { error: '従業員が見つかりません' },
                    { status: 404 }
                )
            }

            const paidLeaveRequest = await prisma.paidLeaveRequest.create({
                data: {
                    employeeId: user.id,
                    leaveDate: new Date(leaveDate),
                    reason: reason || null,
                },
            })

            await logAction(user, 'CREATE', 'PaidLeaveRequest', paidLeaveRequest.id, {
                newValue: { leaveDate, reason },
                ipAddress: getIpAddress(request),
            })

            return NextResponse.json({ request: paidLeaveRequest }, { status: 201 })
        }

        return NextResponse.json(
            { error: '無効な申請タイプです' },
            { status: 400 }
        )
    } catch (error) {
        console.error('Create request error:', error)
        return NextResponse.json(
            { error: '申請の作成中にエラーが発生しました' },
            { status: 500 }
        )
    }
}
