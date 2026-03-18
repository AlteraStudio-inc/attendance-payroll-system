import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: '認証が必要です' } },
        { status: 401 }
      )
    }
    return NextResponse.json({
      success: true,
      data: { user },
      // Legacy compat
      user: {
        id: user.id,
        employeeCode: user.employeeCode,
        name: user.name,
        role: user.role,
        departmentId: user.departmentId,
        companyId: user.companyId,
        employeeId: user.employeeId,
      },
    })
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '認証が必要です' } },
      { status: 401 }
    )
  }
}
