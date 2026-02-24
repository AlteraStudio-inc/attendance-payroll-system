import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPin } from '@/lib/auth'

export async function POST(request: NextRequest) {
    try {
        const { employeeCode, pin } = await request.json()

        if (!employeeCode || !pin) {
            return NextResponse.json(
                { error: '従業員コードとPINを入力してください' },
                { status: 400 }
            )
        }

        // 従業員を検索
        const employee = await prisma.employee.findUnique({
            where: { employeeCode },
        })

        if (!employee) {
            return NextResponse.json(
                { error: '従業員コードまたはPINが正しくありません' },
                { status: 401 }
            )
        }

        if (!employee.isActive) {
            return NextResponse.json(
                { error: 'このアカウントは無効になっています' },
                { status: 401 }
            )
        }

        // PIN検証（PINがない場合はパスワードで検証）
        let isValid = false
        if (employee.pinHash) {
            isValid = await verifyPin(pin, employee.pinHash)
        }

        if (!isValid) {
            return NextResponse.json(
                { error: '従業員コードまたはPINが正しくありません' },
                { status: 401 }
            )
        }

        // 今日の勤怠をチェック
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const todayEntry = await prisma.timeEntry.findFirst({
            where: {
                employeeId: employee.id,
                date: today,
            },
        })

        return NextResponse.json({
            success: true,
            name: employee.name,
            hasClockedIn: !!todayEntry,
            hasClockedOut: !!todayEntry?.clockOut,
        })
    } catch (error) {
        console.error('Kiosk auth error:', error)
        return NextResponse.json(
            { error: 'エラー詳細: ' + (error instanceof Error ? error.message : String(error)) },
            { status: 500 }
        )
    }
}
