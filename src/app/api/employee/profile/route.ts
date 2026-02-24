import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, hashPassword, hashPin, verifyPassword } from '@/lib/auth'
import { logAction, getIpAddress } from '@/lib/audit'
import { z } from 'zod'

const updateProfileSchema = z.object({
    password: z.string().min(6).optional(),
    pin: z.string().regex(/^\d{4,6}$/).optional(),
    currentPassword: z.string().min(1),
})

export async function PATCH(request: NextRequest) {
    try {
        const user = await requireAuth()
        const body = await request.json()
        const { password, pin, currentPassword } = updateProfileSchema.parse(body)

        // 現在のパスワード確認
        const employee = await prisma.employee.findUnique({
            where: { id: user.id },
        })

        if (!employee) {
            return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 })
        }

        const isPasswordValid = await verifyPassword(currentPassword, employee.passwordHash)
        if (!isPasswordValid) {
            return NextResponse.json({ error: '現在のパスワードが正しくありません' }, { status: 401 })
        }

        const updateData: any = {}
        const auditChanges: any = { oldValue: {}, newValue: {} }

        if (password) {
            updateData.passwordHash = await hashPassword(password)
            auditChanges.newValue.passwordChanged = true
        }

        if (pin) {
            updateData.pinHash = await hashPin(pin)
            auditChanges.newValue.pinChanged = true
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: '更新する項目がありません' }, { status: 400 })
        }

        await prisma.employee.update({
            where: { id: user.id },
            data: updateData,
        })

        // 監査ログ
        await logAction(user, 'UPDATE', 'EmployeeProfile', user.id, {
            ...auditChanges,
            ipAddress: getIpAddress(request),
        })

        return NextResponse.json({ success: true, message: 'プロフィールを更新しました' })
    } catch (error) {
        console.error('Update profile error:', error)
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: '入力データが不正です', details: error.errors }, { status: 400 })
        }
        return NextResponse.json({ error: 'プロフィールの更新中にエラーが発生しました' }, { status: 500 })
    }
}
