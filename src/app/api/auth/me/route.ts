import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
    try {
        const user = await getCurrentUser()

        if (!user) {
            return NextResponse.json(
                { error: '認証が必要です' },
                { status: 401 }
            )
        }

        return NextResponse.json({ user })
    } catch (error) {
        console.error('Auth check error:', error)
        return NextResponse.json(
            { error: '認証確認中にエラーが発生しました' },
            { status: 500 }
        )
    }
}
