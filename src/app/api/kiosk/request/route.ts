import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPin } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

// キオスクからの申請（PIN認証付き）
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { employeeCode, pin, type, leaveDate, reason, timeEntryId, requestedClockIn, requestedClockOut } = body

        // --- PIN認証 ---
        if (!employeeCode || !pin) {
            return NextResponse.json(
                { error: '従業員コードとPINを入力してください' },
                { status: 400 }
            )
        }

        const employee = await prisma.employee.findUnique({
            where: { employeeCode },
        })

        if (!employee || !employee.isActive) {
            return NextResponse.json(
                { error: '認証に失敗しました' },
                { status: 401 }
            )
        }

        let isValid = false
        if (employee.pinHash) {
            isValid = await verifyPin(pin, employee.pinHash)
        }

        if (!isValid) {
            return NextResponse.json(
                { error: '認証に失敗しました' },
                { status: 401 }
            )
        }

        // --- 申請処理 ---
        if (type === 'paid_leave') {
            if (!leaveDate) {
                return NextResponse.json(
                    { error: '有給日を指定してください' },
                    { status: 400 }
                )
            }

            const paidLeaveRequest = await prisma.paidLeaveRequest.create({
                data: {
                    employeeId: employee.id,
                    leaveDate: new Date(leaveDate),
                    reason: reason || null,
                },
            })

            await createAuditLog({
                userId: employee.id,
                action: 'CREATE',
                targetType: 'PaidLeaveRequest',
                targetId: paidLeaveRequest.id,
                newValue: { leaveDate, reason, source: 'kiosk' },
            })

            return NextResponse.json({ success: true, request: paidLeaveRequest }, { status: 201 })
        } else if (type === 'work_time') {
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

            if (timeEntry.employeeId !== employee.id) {
                return NextResponse.json(
                    { error: '他の従業員の勤怠に対して申請することはできません' },
                    { status: 403 }
                )
            }

            const workTimeRequest = await prisma.workTimeRequest.create({
                data: {
                    employeeId: employee.id,
                    timeEntryId,
                    requestedClockIn: new Date(requestedClockIn),
                    requestedClockOut: new Date(requestedClockOut),
                    reason,
                },
            })

            await createAuditLog({
                userId: employee.id,
                action: 'CREATE',
                targetType: 'WorkTimeRequest',
                targetId: workTimeRequest.id,
                newValue: { timeEntryId, reason, source: 'kiosk' },
            })

            return NextResponse.json({ success: true, request: workTimeRequest }, { status: 201 })
        }

        return NextResponse.json({ error: '無効な申請タイプです' }, { status: 400 })
    } catch (error) {
        console.error('Kiosk request error:', error)
        return NextResponse.json(
            { error: '申請の作成中にエラーが発生しました' },
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
            return NextResponse.json({ error: '従業員コードが必要です' }, { status: 400 })
        }

        const employee = await prisma.employee.findUnique({
            where: { employeeCode },
        })

        if (!employee) {
            return NextResponse.json({ error: '従業員が見つかりません' }, { status: 404 })
        }

        // 直近14日分の勤怠を取得
        const twoWeeksAgo = new Date()
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
        twoWeeksAgo.setHours(0, 0, 0, 0)

        const entries = await prisma.timeEntry.findMany({
            where: {
                employeeId: employee.id,
                date: { gte: twoWeeksAgo },
            },
            orderBy: { date: 'desc' },
            select: {
                id: true,
                date: true,
                clockIn: true,
                clockOut: true,
            },
        })

        return NextResponse.json({ entries })
    } catch (error) {
        console.error('Kiosk get entries error:', error)
        return NextResponse.json(
            { error: '勤怠データの取得に失敗しました' },
            { status: 500 }
        )
    }
}
