import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    console.log('🌱 Seeding database...')

    // 管理者ユーザー作成
    const adminPassword = await bcrypt.hash('admin123', 12)
    const adminPin = await bcrypt.hash('0000', 10)

    const admin = await prisma.employee.upsert({
        where: { employeeCode: 'ADMIN001' },
        update: {
            name: '管理 太郎',
        },
        create: {
            employeeCode: 'ADMIN001',
            name: '管理 太郎',
            email: 'admin@example.com',
            passwordHash: adminPassword,
            pinHash: adminPin,
            role: 'ADMIN',
            employmentType: 'FULL_TIME',
            wageType: 'FIXED',
            monthlySalary: 500000,
            minimumWage: 1000,
            deemedOvertimeEnabled: true,
            deemedOvertimeHours: 20,
            isActive: true,
        },
    })
    console.log('✅ Created admin:', admin.name)

    // テスト従業員作成（10名）
    const empPassword = await bcrypt.hash('password', 12)
    const empPin = await bcrypt.hash('1234', 10)

    const employees = [
        {
            employeeCode: 'EMP001',
            name: '従業 試一',
            email: 'jugyou1@example.com',
            employmentType: 'FULL_TIME' as const,
            wageType: 'FIXED' as const,
            monthlySalary: 350000,
        },
        {
            employeeCode: 'EMP002',
            name: '従業 試二',
            email: 'jugyou2@example.com',
            employmentType: 'FULL_TIME' as const,
            wageType: 'FIXED' as const,
            monthlySalary: 320000,
        },
        {
            employeeCode: 'EMP003',
            name: '従業 試三',
            email: 'jugyou3@example.com',
            employmentType: 'FULL_TIME' as const,
            wageType: 'FIXED' as const,
            monthlySalary: 300000,
        },
        {
            employeeCode: 'EMP004',
            name: '従業 試四',
            email: 'jugyou4@example.com',
            employmentType: 'FULL_TIME' as const,
            wageType: 'FIXED' as const,
            monthlySalary: 280000,
        },
        {
            employeeCode: 'EMP005',
            name: '従業 試五',
            email: 'jugyou5@example.com',
            employmentType: 'PART_TIME' as const,
            wageType: 'HOURLY' as const,
            hourlyRate: 1200,
        },
        {
            employeeCode: 'EMP006',
            name: '従業 試六',
            email: 'jugyou6@example.com',
            employmentType: 'PART_TIME' as const,
            wageType: 'HOURLY' as const,
            hourlyRate: 1150,
        },
        {
            employeeCode: 'EMP007',
            name: '従業 試七',
            email: 'jugyou7@example.com',
            employmentType: 'HOURLY' as const,
            wageType: 'HOURLY' as const,
            hourlyRate: 1100,
        },
        {
            employeeCode: 'EMP008',
            name: '従業 試八',
            email: 'jugyou8@example.com',
            employmentType: 'HOURLY' as const,
            wageType: 'HOURLY' as const,
            hourlyRate: 1080,
        },
        {
            employeeCode: 'EMP009',
            name: '従業 試九',
            email: 'jugyou9@example.com',
            employmentType: 'CONTRACT' as const,
            wageType: 'FIXED' as const,
            monthlySalary: 260000,
        },
        {
            employeeCode: 'EMP010',
            name: '従業 試十',
            email: 'jugyou10@example.com',
            employmentType: 'CONTRACT' as const,
            wageType: 'FIXED' as const,
            monthlySalary: 250000,
        },
    ]

    for (const emp of employees) {
        const created = await prisma.employee.upsert({
            where: { employeeCode: emp.employeeCode },
            update: {
                name: emp.name,
                email: emp.email,
            },
            create: {
                ...emp,
                passwordHash: empPassword,
                pinHash: empPin,
                role: 'EMPLOYEE',
                minimumWage: 1000,
                deemedOvertimeEnabled: emp.wageType === 'FIXED',
                deemedOvertimeHours: emp.wageType === 'FIXED' ? 10 : 0,
                isActive: true,
                hourlyRate: emp.hourlyRate ?? null,
                monthlySalary: emp.monthlySalary ?? null,
            },
        })
        console.log('✅ Created/Updated employee:', created.name)
    }

    // 今月の営業日カレンダー作成
    const today = new Date()
    const year = today.getFullYear()
    const month = today.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    console.log('📅 Creating business calendar...')
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day)
        date.setHours(0, 0, 0, 0)
        const dayOfWeek = date.getDay()
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

        await prisma.businessCalendar.upsert({
            where: { date },
            update: {},
            create: {
                date,
                isHoliday: isWeekend,
                note: isWeekend ? (dayOfWeek === 0 ? '日曜日' : '土曜日') : null,
            },
        })
    }
    console.log('✅ Business calendar created')

    console.log('')
    console.log('🎉 Seeding completed!')
    console.log('')
    console.log('📌 Test accounts:')
    console.log('   Admin: ADMIN001 / admin123 (PIN: 0000)')
    console.log('   Employee: EMP001〜EMP010 / password (PIN: 1234)')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
