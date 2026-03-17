import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, hashPassword, hashPin, verifyPassword } from '@/lib/auth'
import { logAction } from '@/lib/audit'
import { z } from 'zod'

const updateProfileSchema = z.object({
    password: z.string().min(6).optional(),
    pin: z.string().regex(/^\d{4,6}$/).optional(),
    currentPassword: z.string().min(1),
})

export async function GET() {
    try {
        const user = await requireAuth()

        if (!user.employeeId) {
            return NextResponse.json(
                { success: false, error: { code: 'NO_EMPLOYEE', message: '従業員情報が見つかりません' } },
                { status: 403 }
            )
        }

        const employee = await prisma.employee.findUnique({
            where: { id: user.employeeId },
            include: {
                department: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        startTime: true,
                        endTime: true,
                        breakMinutes: true,
                    },
                },
            },
        })

        if (!employee) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: '従業員情報が見つかりません' } },
                { status: 404 }
            )
        }

        return NextResponse.json({
            success: true,
            data: {
                employee: {
                    id: employee.id,
                    employeeCode: employee.employeeCode,
                    name: employee.name,
                    email: employee.email,
                    employmentType: employee.employmentType,
                    payType: employee.payType,
                    active: employee.active,
                    joinDate: employee.joinDate?.toISOString() ?? null,
                    department: employee.department,
                },
            },
        })
    } catch (error) {
        console.error('Get profile error:', error)
        if (error instanceof Error && error.message.includes('認証')) {
            return NextResponse.json(
                { success: false, error: { code: 'UNAUTHORIZED', message: error.message } },
                { status: 401 }
            )
        }
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'プロフィールの取得中にエラーが発生しました' } },
            { status: 500 }
        )
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const user = await requireAuth()

        if (!user.employeeId) {
            return NextResponse.json(
                { success: false, error: { code: 'NO_EMPLOYEE', message: '従業員情報が見つかりません' } },
                { status: 403 }
            )
        }

        const body = await request.json()
        const parsed = updateProfileSchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: '入力データが不正です', details: parsed.error.errors } },
                { status: 400 }
            )
        }

        const { password, pin, currentPassword } = parsed.data

        // Verify current password via User record
        const userRecord = await prisma.user.findUnique({
            where: { id: user.id },
        })

        if (!userRecord) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'ユーザーが見つかりません' } },
                { status: 404 }
            )
        }

        const isPasswordValid = await verifyPassword(currentPassword, userRecord.passwordHash)
        if (!isPasswordValid) {
            return NextResponse.json(
                { success: false, error: { code: 'INVALID_PASSWORD', message: '現在のパスワードが正しくありません' } },
                { status: 401 }
            )
        }

        const userUpdateData: Record<string, unknown> = {}
        const employeeUpdateData: Record<string, unknown> = {}
        const auditAfter: Record<string, unknown> = {}

        if (password) {
            userUpdateData.passwordHash = await hashPassword(password)
            auditAfter.passwordChanged = true
        }

        if (pin) {
            employeeUpdateData.pinHash = await hashPin(pin)
            auditAfter.pinChanged = true
        }

        if (Object.keys(userUpdateData).length === 0 && Object.keys(employeeUpdateData).length === 0) {
            return NextResponse.json(
                { success: false, error: { code: 'NO_CHANGES', message: '更新する項目がありません' } },
                { status: 400 }
            )
        }

        await Promise.all([
            Object.keys(userUpdateData).length > 0
                ? prisma.user.update({ where: { id: user.id }, data: userUpdateData })
                : Promise.resolve(),
            Object.keys(employeeUpdateData).length > 0
                ? prisma.employee.update({ where: { id: user.employeeId }, data: employeeUpdateData })
                : Promise.resolve(),
        ])

        await logAction(user, 'UPDATE', 'EmployeeProfile', user.employeeId, {
            afterJson: auditAfter,
        })

        return NextResponse.json({ success: true, data: { message: 'プロフィールを更新しました' } })
    } catch (error) {
        console.error('Update profile error:', error)
        if (error instanceof Error && error.message.includes('認証')) {
            return NextResponse.json(
                { success: false, error: { code: 'UNAUTHORIZED', message: error.message } },
                { status: 401 }
            )
        }
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: '入力データが不正です', details: error.errors } },
                { status: 400 }
            )
        }
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'プロフィールの更新中にエラーが発生しました' } },
            { status: 500 }
        )
    }
}
