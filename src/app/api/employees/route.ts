import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { hashPassword, hashPin } from '@/lib/auth'
import { logAction, getIpAddress } from '@/lib/audit'
import { z } from 'zod'

// バリデーションスキーマ
const createEmployeeSchema = z.object({
    employeeCode: z.string().min(1).max(20),
    name: z.string().min(1).max(100),
    email: z.string().email(),
    password: z.string().min(6),
    pin: z.string().regex(/^\d{4,6}$/).optional(),
    role: z.enum(['EMPLOYEE', 'ADMIN']).default('EMPLOYEE'),
    jobType: z.enum(['CONSTRUCTION', 'NAIL', 'EYELASH', 'SUPPORT', 'OTHER']).default('OTHER'),
    employmentType: z.enum(['FULL_TIME', 'CONTRACT', 'PART_TIME', 'HOURLY']).default('FULL_TIME'),
    wageType: z.enum(['HOURLY', 'FIXED']).default('FIXED'),
    hourlyRate: z.number().positive().optional(),
    monthlySalary: z.number().positive().optional(),
    minimumWage: z.number().positive().default(1000),
    deemedOvertimeEnabled: z.boolean().default(false),
    deemedOvertimeHours: z.number().min(0).default(0),
})

// 従業員一覧取得
export async function GET(request: NextRequest) {
    try {
        await requireAdmin()

        const { searchParams } = new URL(request.url)
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '20')
        const search = searchParams.get('search') || ''
        const includeInactive = searchParams.get('includeInactive') === 'true'

        const where = {
            ...(search && {
                OR: [
                    { name: { contains: search } },
                    { employeeCode: { contains: search } },
                    { email: { contains: search } },
                ],
            }),
            ...(!includeInactive && { isActive: true }),
        }

        const [employees, total] = await Promise.all([
            prisma.employee.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: 'desc' },
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
            }),
            prisma.employee.count({ where }),
        ])

        return NextResponse.json({
            employees,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        })
    } catch (error) {
        console.error('Get employees error:', error)
        if (error instanceof Error && error.message === '管理者権限が必要です') {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        return NextResponse.json(
            { error: '従業員一覧の取得中にエラーが発生しました' },
            { status: 500 }
        )
    }
}

// 従業員作成
export async function POST(request: NextRequest) {
    try {
        const user = await requireAdmin()
        const body = await request.json()

        const data = createEmployeeSchema.parse(body)

        // 従業員コード重複チェック
        const existing = await prisma.employee.findUnique({
            where: { employeeCode: data.employeeCode },
        })

        if (existing) {
            return NextResponse.json(
                { error: 'この従業員コードはすでに使用されています' },
                { status: 400 }
            )
        }

        // 給与形態とレートの整合性チェック
        if (data.wageType === 'HOURLY' && !data.hourlyRate) {
            return NextResponse.json(
                { error: '時給制の場合は時給を設定してください' },
                { status: 400 }
            )
        }
        if (data.wageType === 'FIXED' && !data.monthlySalary) {
            return NextResponse.json(
                { error: '固定給制の場合は月給を設定してください' },
                { status: 400 }
            )
        }

        // 最低賃金チェック
        if (data.wageType === 'HOURLY' && data.hourlyRate && data.hourlyRate < data.minimumWage) {
            return NextResponse.json(
                { error: `時給が最低賃金(${data.minimumWage}円)を下回っています`, warning: true },
                { status: 400 }
            )
        }

        // パスワード・PINハッシュ化
        const passwordHash = await hashPassword(data.password)
        const pinHash = data.pin ? await hashPin(data.pin) : null

        const employee = await prisma.employee.create({
            data: {
                employeeCode: data.employeeCode,
                name: data.name,
                email: data.email,
                passwordHash,
                pinHash,
                role: data.role,
                jobType: data.jobType,
                employmentType: data.employmentType,
                wageType: data.wageType,
                hourlyRate: data.hourlyRate,
                monthlySalary: data.monthlySalary,
                minimumWage: data.minimumWage,
                deemedOvertimeEnabled: data.deemedOvertimeEnabled,
                deemedOvertimeHours: data.deemedOvertimeHours,
            },
            select: {
                id: true,
                employeeCode: true,
                name: true,
                email: true,
                role: true,
                jobType: true,
                employmentType: true,
                wageType: true,
                isActive: true,
                createdAt: true,
            },
        })

        // 監査ログ
        await logAction(user, 'CREATE', 'Employee', employee.id, {
            newValue: { employeeCode: data.employeeCode, name: data.name },
            ipAddress: getIpAddress(request),
        })

        return NextResponse.json({ employee }, { status: 201 })
    } catch (error) {
        console.error('Create employee error:', error)
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
            { error: '従業員の作成中にエラーが発生しました' },
            { status: 500 }
        )
    }
}
