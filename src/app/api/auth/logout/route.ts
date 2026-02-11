import { NextResponse } from 'next/server'
import { removeAuthCookie, getCurrentUser } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

export async function POST() {
    try {
        const user = await getCurrentUser()

        if (user) {
            // 監査ログ
            await createAuditLog({
                userId: user.id,
                action: 'LOGOUT',
                targetType: 'Employee',
                targetId: user.id,
            })
        }

        await removeAuthCookie()

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Logout error:', error)
        return NextResponse.json(
            { error: 'ログアウト処理中にエラーが発生しました' },
            { status: 500 }
        )
    }
}
