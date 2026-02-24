import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, hashPassword, hashPin } from '@/lib/auth'
import { logAction, getIpAddress } from '@/lib/audit'
import { z } from 'zod'

// 更新用スキーマ
const updateEmployeeSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    email: z.string().email().optional(),
    password: z.string().min(6).optional(),
    pin: z.string().regex(/^\d{4,6}$/).optional().nullable(),
    role: z.enum(['EMPLOYEE', 'ADMIN']).optional(),
    jobType: z.enum(['CONSTRUCTION', 'NAIL', 'EYELASH', 'SUPPORT', 'OTHER']).optional(),
    employmentType: z.enum(['FULL_TIME', 'CONTRACT', 'PART_TIME', 'HOURLY']).optional(),
    wageType: z.enum(['HOURLY', 'FIXED']).optional(),
    hourlyRate: z.number().positive().optional().nullable(),
    monthlySalary: z.number().positive().optional().nullable(),
    minimumWage: z.number().positive().optional(),
    deemedOvertimeEnabled: z.boolean().optional(),
    deemedOvertimeHours: z.number().min(0).optional(),
    isActive: z.boolean().optional(),
})

interface RouteParams {
    params: Promise<{ id: string }>
}

// 従業員詳細取得
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        await requireAdmin()
        const { id } = await params

        const employee = await prisma.employee.findUnique({
            where: { id },
            select: {
                id: true,
                employeeCode: true,
                name: true,
                email: true,
                role: true,
                jobType: true,
                employmentType: true,
                wageType: true,
                hourlyRate: true,
                monthlySalary: true,
                minimumWage: true,
                deemedOvertimeEnabled: true,
                deemedOvertimeHours: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
            },
        })

        if (!employee) {
            return NextResponse.json(
                { error: '従業員が見つかりません' },
                { status: 404 }
            )
        }

        return NextResponse.json({ employee })
    } catch (error) {
        console.error('Get employee error:', error)
        if (error instanceof Error && error.message === '管理者権限が必要です') {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        return NextResponse.json(
            { error: '従業員の取得中にエラーが発生しました' },
            { status: 500 }
        )
    }
}

// 従業員更新
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await requireAdmin()
        const { id } = await params
        const body = await request.json()

        const data = updateEmployeeSchema.parse(body)

        // 既存データ取得
        const existing = await prisma.employee.findUnique({
            where: { id },
        })

        if (!existing) {
            return NextResponse.json(
                { error: '従業員が見つかりません' },
                { status: 404 }
            )
        }

        // 最低賃金チェック
        const wageType = data.wageType ?? existing.wageType
        const hourlyRate = data.hourlyRate !== undefined ? data.hourlyRate : existing.hourlyRate
        const minimumWage = data.minimumWage ?? Number(existing.minimumWage)

        if (wageType === 'HOURLY' && hourlyRate && Number(hourlyRate) < minimumWage) {
            return NextResponse.json(
                { error: `時給が最低賃金(${minimumWage}円)を下回っています`, warning: true },
                { status: 400 }
            )
        }

        // 更新データ準備
        const updateData: Record<string, unknown> = {}

        if (data.name !== undefined) updateData.name = data.name
        if (data.email !== undefined) updateData.email = data.email
        if (data.role !== undefined) updateData.role = data.role
        if (data.jobType !== undefined) updateData.jobType = data.jobType
        if (data.employmentType !== undefined) updateData.employmentType = data.employmentType
        if (data.wageType !== undefined) updateData.wageType = data.wageType
        if (data.hourlyRate !== undefined) updateData.hourlyRate = data.hourlyRate
        if (data.monthlySalary !== undefined) updateData.monthlySalary = data.monthlySalary
        if (data.minimumWage !== undefined) updateData.minimumWage = data.minimumWage
        if (data.deemedOvertimeEnabled !== undefined) updateData.deemedOvertimeEnabled = data.deemedOvertimeEnabled
        if (data.deemedOvertimeHours !== undefined) updateData.deemedOvertimeHours = data.deemedOvertimeHours
        if (data.isActive !== undefined) updateData.isActive = data.isActive

        // パスワード変更
        if (data.password) {
            updateData.passwordHash = await hashPassword(data.password)
        }

        // PIN変更
        if (data.pin !== undefined) {
            updateData.pinHash = data.pin ? await hashPin(data.pin) : null
        }

        const employee = await prisma.employee.update({
            where: { id },
            data: updateData,
            select: {
                id: true,
                employeeCode: true,
                name: true,
                email: true,
                role: true,
                jobType: true,
                employmentType: true,
                wageType: true,
                hourlyRate: true,
                monthlySalary: true,
                minimumWage: true,
                deemedOvertimeEnabled: true,
                deemedOvertimeHours: true,
                isActive: true,
                updatedAt: true,
            },
        })

        // 監査ログ
        await logAction(user, 'UPDATE', 'Employee', id, {
            oldValue: { name: existing.name, email: existing.email, isActive: existing.isActive },
            newValue: updateData,
            ipAddress: getIpAddress(request),
        })

        return NextResponse.json({ employee })
    } catch (error) {
        console.error('Update employee error:', error)
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: '入力データが不正です', details: error.errors },
                { status: 400 }
            )
        }
        if (error instanceof Error && error.message === '管理者権限が必要です') {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        return NextResponse.json(
            { error: '従業員の更新中にエラーが発生しました' },
            { status: 500 }
        )
    }
}

// 従業員削除（論理削除）
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await requireAdmin()
        const { id } = await params

        const existing = await prisma.employee.findUnique({
            where: { id },
        })

        if (!existing) {
            return NextResponse.json(
                { error: '従業員が見つかりません' },
                { status: 404 }
            )
        }

        // 論理削除（isActiveをfalseに）
        await prisma.employee.update({
            where: { id },
            data: { isActive: false },
        })

        // 監査ログ
        await logAction(user, 'DELETE', 'Employee', id, {
            oldValue: { name: existing.name, employeeCode: existing.employeeCode, isActive: true },
            newValue: { isActive: false },
            ipAddress: getIpAddress(request),
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Delete employee error:', error)
        if (error instanceof Error && error.message === '管理者権限が必要です') {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        return NextResponse.json(
            { error: '従業員の削除中にエラーが発生しました' },
            { status: 500 }
        )
    }
}
