import { NextRequest, NextResponse } from 'next/server'
import { loginWithEmail, loginWithEmployeeCode, generateToken, setAuthCookie } from '@/lib/auth'
import { logAction } from '@/lib/audit'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, employeeCode, password, pin, loginType } = body

    let user
    if (email && password) {
      // 管理者ログイン (email + password)
      user = await loginWithEmail(email, password)
    } else if (employeeCode && (password || pin)) {
      // 従業員ログイン (employeeCode + password/pin)
      user = await loginWithEmployeeCode(employeeCode, password || pin)
    } else {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: '認証情報が不足しています' } },
        { status: 400 }
      )
    }

    const token = await generateToken(user)
    await setAuthCookie(token)

    await logAction(user, 'LOGIN', 'user', user.id)

    return NextResponse.json({
      success: true,
      data: { user },
      // Legacy compat
      user: {
        id: user.id,
        employeeCode: user.employeeCode,
        name: user.name,
        role: user.role,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message: error.message || '認証に失敗しました' } },
      { status: 401 }
    )
  }
}
