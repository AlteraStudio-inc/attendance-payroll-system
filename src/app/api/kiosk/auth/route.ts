import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPin } from '@/lib/auth'
import { startOfDay, endOfDay } from 'date-fns'

export async function POST(request: NextRequest) {
    try {
        const { employeeCode, pin } = await request.json()

        if (!employeeCode || !pin) {
            return NextResponse.json(
                { success: false, error: { code: 'MISSING_FIELDS', message: '従業員コードとPINを入力してください' } },
                { status: 400 }
            )
        }

        const employee = await prisma.employee.findUnique({
            where: { employeeCode },
        })

        if (!employee) {
            return NextResponse.json(
                { success: false, error: { code: 'INVALID_CREDENTIALS', message: '従業員コードまたはPINが正しくありません' } },
                { status: 401 }
            )
        }

        if (!employee.active) {
            return NextResponse.json(
                { success: false, error: { code: 'ACCOUNT_DISABLED', message: 'このアカウントは無効になっています' } },
                { status: 401 }
            )
        }

        if (!employee.pinHash) {
            return NextResponse.json(
                { success: false, error: { code: 'INVALID_CREDENTIALS', message: '従業員コードまたはPINが正しくありません' } },
                { status: 401 }
            )
        }

        const isValid = await verifyPin(pin, employee.pinHash)
        if (!isValid) {
            return NextResponse.json(
                { success: false, error: { code: 'INVALID_CREDENTIALS', message: '従業員コードまたはPINが正しくありません' } },
                { status: 401 }
            )
        }

        const now = new Date()
        const todayRecord = await prisma.attendanceRecord.findFirst({
            where: {
                employeeId: employee.id,
                workDate: {
                    gte: startOfDay(now),
                    lte: endOfDay(now),
                },
            },
        })

        return NextResponse.json({
            success: true,
            data: {
                employeeId: employee.id,
                name: employee.name,
                employeeCode: employee.employeeCode,
                hasClockedIn: !!todayRecord?.clockInAt,
                hasClockedOut: !!todayRecord?.clockOutAt,
                attendanceRecordId: todayRecord?.id ?? null,
            },
        })
    } catch (error) {
        console.error('Kiosk auth error:', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: '認証中にエラーが発生しました' } },
            { status: 500 }
        )
    }
}
