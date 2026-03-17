import { NextResponse } from 'next/server'
import { removeAuthCookie, getCurrentUser } from '@/lib/auth'
import { logAction } from '@/lib/audit'

export async function POST() {
  try {
    const user = await getCurrentUser()
    if (user) {
      await logAction(user, 'LOGOUT', 'user', user.id)
    }
    await removeAuthCookie()
    return NextResponse.json({ success: true, message: 'ログアウトしました' })
  } catch {
    await removeAuthCookie()
    return NextResponse.json({ success: true, message: 'ログアウトしました' })
  }
}
