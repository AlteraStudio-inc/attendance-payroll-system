import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword, verifyPin, generateToken, setAuthCookie } from '@/lib/auth'
import { createAuditLog, getIpAddress } from '@/lib/audit'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { employeeCode, password, loginType } = body

        if (!employeeCode || !password) {
            return NextResponse.json(
                { error: '従業員コードとパスワードを入力してください' },
                { status: 400 }
            )
        }

        // 従業員を検索
        const employee = await prisma.employee.findUnique({
            where: { employeeCode },
        })

        if (!employee) {
            return NextResponse.json(
                { error: '従業員コードまたはパスワードが正しくありません' },
                { status: 401 }
            )
        }

        // 在籍確認
        if (!employee.isActive) {
            return NextResponse.json(
                { error: 'このアカウントは無効になっています' },
                { status: 401 }
            )
        }

        // パスワード/PIN検証
        let isValid = false
        if (loginType === 'pin') {
            if (employee.pinHash) {
                isValid = await verifyPin(password, employee.pinHash)
            }
        } else {
            isValid = await verifyPassword(password, employee.passwordHash)
        }

        if (!isValid) {
            return NextResponse.json(
                { error: '従業員コードまたはパスワードが正しくありません' },
                { status: 401 }
            )
        }

        // JWTトークン生成
        const token = await generateToken({
            id: employee.id,
            employeeCode: employee.employeeCode,
            name: employee.name,
            role: employee.role as 'EMPLOYEE' | 'ADMIN',
        })

        // Cookieにセット
        await setAuthCookie(token)

        // 監査ログ
        await createAuditLog({
            userId: employee.id,
            action: 'LOGIN',
            targetType: 'Employee',
            targetId: employee.id,
            ipAddress: getIpAddress(request),
        })

        return NextResponse.json({
            success: true,
            user: {
                id: employee.id,
                employeeCode: employee.employeeCode,
                name: employee.name,
                role: employee.role,
            },
        })
    } catch (error) {
        console.error('Login error:', error)
        return NextResponse.json(
            { error: 'エラー詳細: ' + (error instanceof Error ? error.message : String(error)) },
            { status: 500 }
        )
    }
}
