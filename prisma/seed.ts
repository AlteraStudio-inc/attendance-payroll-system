import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // =============================================
  // 会社
  // =============================================
  const company = await prisma.company.upsert({
    where: { id: 'company-001' },
    update: {},
    create: {
      id: 'company-001',
      name: '株式会社サンプル',
      payrollClosingDay: 25,
      payrollPaymentDay: 25,
      timezone: 'Asia/Tokyo',
    },
  })
  console.log('✅ Company:', company.name)

  // =============================================
  // 部門 (ネイル・本部・建設)
  // =============================================
  const nailDept = await prisma.department.upsert({
    where: { code: 'NAIL' },
    update: {},
    create: {
      companyId: company.id,
      code: 'NAIL',
      name: 'ネイル部門',
      startTime: '09:45',
      endTime: '18:15',
      breakStartTime: null,
      breakEndTime: null,
      breakMinutes: 60,
      scheduledWorkMinutesPerDay: 450,
      annualWorkDays: 258,
      annualHolidays: 107,
      annualWorkMinutes: 258 * 450,
      monthlyAverageWorkMinutes: 9675,
      allowWithinScheduledOvertime: true,
      overtimeBoundaryType: 'daily_8h',
      overtimeBoundaryMinutes: null,
      lateDeductionStartTime: '09:45',
      earlyLeaveDeductionBeforeTime: '18:00',
      noEarlyLeaveDeductionAfterTime: '18:00',
      fixedOvertimeEnabled: false,
      fixedOvertimeMinutes: 0,
      fixedOvertimeAllowanceName: null,
      averageWorkTimeRoundingRule: 'round',
      payRoundingRule: 'ceil',
      deductionRoundingRule: 'floor',
      lateNightEnabled: false,
      notes: '18:00退社OK。所定内残業あり。',
    },
  })

  const hqDept = await prisma.department.upsert({
    where: { code: 'HQ' },
    update: {},
    create: {
      companyId: company.id,
      code: 'HQ',
      name: '本部',
      startTime: '09:00',
      endTime: '18:00',
      breakStartTime: '12:00',
      breakEndTime: '13:00',
      breakMinutes: 60,
      scheduledWorkMinutesPerDay: 480,
      annualWorkDays: 240,
      annualHolidays: 125,
      annualWorkMinutes: 240 * 480,
      monthlyAverageWorkMinutes: 9600,
      allowWithinScheduledOvertime: false,
      overtimeBoundaryType: 'daily_8h',
      overtimeBoundaryMinutes: null,
      lateDeductionStartTime: '09:00',
      earlyLeaveDeductionBeforeTime: '18:00',
      noEarlyLeaveDeductionAfterTime: null,
      fixedOvertimeEnabled: true,
      fixedOvertimeMinutes: 1405,
      fixedOvertimeAllowanceName: '職務手当',
      averageWorkTimeRoundingRule: 'round',
      payRoundingRule: 'round',
      deductionRoundingRule: 'floor',
      lateNightEnabled: false,
      notes: '固定残業代は職務手当に含む。固定残業時間は約23時間25分。',
    },
  })

  const constructionDept = await prisma.department.upsert({
    where: { code: 'CONSTRUCTION' },
    update: {},
    create: {
      companyId: company.id,
      code: 'CONSTRUCTION',
      name: '建設部門',
      startTime: '08:00',
      endTime: '17:00',
      breakStartTime: '12:00',
      breakEndTime: '13:00',
      breakMinutes: 60,
      scheduledWorkMinutesPerDay: 480,
      annualWorkDays: 253,
      annualHolidays: 112,
      annualWorkMinutes: 253 * 480,
      monthlyAverageWorkMinutes: 10119,
      allowWithinScheduledOvertime: false,
      overtimeBoundaryType: 'daily_8h',
      overtimeBoundaryMinutes: null,
      lateDeductionStartTime: '08:00',
      earlyLeaveDeductionBeforeTime: '17:00',
      noEarlyLeaveDeductionAfterTime: null,
      fixedOvertimeEnabled: true,
      fixedOvertimeMinutes: 2700,
      fixedOvertimeAllowanceName: '職務手当',
      averageWorkTimeRoundingRule: 'floor',
      payRoundingRule: 'ceil',
      deductionRoundingRule: 'floor',
      lateNightEnabled: false,
      notes: '月平均所定労働時間は小数点第2位切捨て。支給端数切上、控除端数切捨。固定残業45時間。',
    },
  })
  console.log('✅ Departments: ネイル, 本部, 建設')

  // =============================================
  // 手当マスタ
  // =============================================
  const allowanceTypes = [
    { code: 'POSITION', name: '役職手当', category: 'position' as const, includedInBaseWage: true, taxable: true },
    { code: 'JOB', name: '職務手当', category: 'other' as const, includedInBaseWage: false, taxable: true, notes: '基礎賃金算入可否は従業員設定で制御' },
    { code: 'FAMILY', name: '家族手当', category: 'family' as const, includedInBaseWage: false, taxable: true, exclusionReason: '扶養人数に応じた支給のため除外' },
    { code: 'COMMUTING', name: '通勤手当', category: 'commuting' as const, includedInBaseWage: false, taxable: false, exclusionReason: '実費支給のため除外', isActualCostBased: true },
    { code: 'HOUSING', name: '住宅手当', category: 'housing' as const, includedInBaseWage: false, taxable: true, exclusionReason: '一律支給でないため除外候補' },
    { code: 'INCENTIVE', name: 'インセンティブ', category: 'incentive' as const, includedInBaseWage: false, taxable: true },
    { code: 'FIXED_OT', name: '固定残業手当', category: 'fixed_overtime' as const, includedInBaseWage: false, taxable: true },
  ]

  for (const at of allowanceTypes) {
    await prisma.allowanceType.upsert({
      where: { code: at.code },
      update: {},
      create: {
        code: at.code,
        name: at.name,
        category: at.category,
        includedInBaseWage: at.includedInBaseWage,
        exclusionReason: at.exclusionReason ?? null,
        calculationType: 'fixed',
        isUniformPayment: false,
        isActualCostBased: at.isActualCostBased ?? false,
        taxable: at.taxable,
        socialInsuranceApplicable: at.taxable,
        notes: at.notes ?? null,
      },
    })
  }
  console.log('✅ Allowance types created')

  // =============================================
  // 管理者ユーザー
  // =============================================
  const adminPasswordHash = await bcrypt.hash('admin123', 12)

  const adminEmployee = await prisma.employee.upsert({
    where: { employeeCode: 'ADMIN001' },
    update: {},
    create: {
      companyId: company.id,
      departmentId: hqDept.id,
      employeeCode: 'ADMIN001',
      name: '管理 太郎',
      email: 'admin@example.com',
      employmentType: 'full_time',
      payType: 'monthly',
      active: true,
      joinDate: new Date('2020-04-01'),
    },
  })

  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      role: 'admin',
      email: 'admin@example.com',
      passwordHash: adminPasswordHash,
      employeeId: adminEmployee.id,
      isActive: true,
    },
  })
  console.log('✅ Admin: admin@example.com / admin123')

  // =============================================
  // サンプル従業員 (各部門1名ずつ)
  // =============================================
  const empPasswordHash = await bcrypt.hash('password', 12)
  const empPinHash = await bcrypt.hash('1234', 10)

  // --- ネイル部門 ---
  const nailEmp = await prisma.employee.upsert({
    where: { employeeCode: 'NAIL001' },
    update: {},
    create: {
      companyId: company.id,
      departmentId: nailDept.id,
      employeeCode: 'NAIL001',
      name: 'ネイル 花子',
      email: 'nail001@example.com',
      pinHash: empPinHash,
      employmentType: 'full_time',
      payType: 'monthly',
      active: true,
      joinDate: new Date('2022-04-01'),
    },
  })
  await prisma.user.upsert({
    where: { email: 'nail001@example.com' },
    update: {},
    create: {
      role: 'employee',
      email: 'nail001@example.com',
      passwordHash: empPasswordHash,
      employeeId: nailEmp.id,
      isActive: true,
    },
  })
  // Salary setting (idempotent: delete existing first)
  await prisma.employeeSalarySetting.deleteMany({ where: { employeeId: nailEmp.id } })
  await prisma.employeeSalarySetting.create({
    data: {
      employeeId: nailEmp.id,
      effectiveFrom: new Date('2022-04-01'),
      monthlySalary: 183000,
      baseSalary: 183000,
      includeJobAllowanceInBaseWage: false,
      socialInsuranceEnrolled: true,
      nursingCareInsuranceApplicable: false,
      employmentInsuranceEnrolled: true,
      dependentsCount: 0,
      standardMonthlyRemuneration: 180000,
    },
  })

  // --- 本部 ---
  const hqEmp = await prisma.employee.upsert({
    where: { employeeCode: 'HQ001' },
    update: {},
    create: {
      companyId: company.id,
      departmentId: hqDept.id,
      employeeCode: 'HQ001',
      name: '本部 一郎',
      email: 'hq001@example.com',
      pinHash: empPinHash,
      employmentType: 'full_time',
      payType: 'monthly',
      active: true,
      joinDate: new Date('2021-04-01'),
    },
  })
  await prisma.user.upsert({
    where: { email: 'hq001@example.com' },
    update: {},
    create: {
      role: 'employee',
      email: 'hq001@example.com',
      passwordHash: empPasswordHash,
      employeeId: hqEmp.id,
      isActive: true,
    },
  })
  await prisma.employeeSalarySetting.deleteMany({ where: { employeeId: hqEmp.id } })
  await prisma.employeeSalarySetting.create({
    data: {
      employeeId: hqEmp.id,
      effectiveFrom: new Date('2021-04-01'),
      monthlySalary: 355000,
      baseSalary: 300000,
      jobAllowance: 55000,
      includeJobAllowanceInBaseWage: false,
      fixedOvertimeAllowance: 55000,
      fixedOvertimeMinutes: 1405,
      socialInsuranceEnrolled: true,
      nursingCareInsuranceApplicable: false,
      employmentInsuranceEnrolled: true,
      dependentsCount: 1,
      standardMonthlyRemuneration: 360000,
    },
  })

  // --- 建設部門 ---
  const constEmp = await prisma.employee.upsert({
    where: { employeeCode: 'CONST001' },
    update: {},
    create: {
      companyId: company.id,
      departmentId: constructionDept.id,
      employeeCode: 'CONST001',
      name: '建設 太郎',
      email: 'const001@example.com',
      pinHash: empPinHash,
      employmentType: 'full_time',
      payType: 'monthly',
      active: true,
      joinDate: new Date('2020-10-01'),
    },
  })
  await prisma.user.upsert({
    where: { email: 'const001@example.com' },
    update: {},
    create: {
      role: 'employee',
      email: 'const001@example.com',
      passwordHash: empPasswordHash,
      employeeId: constEmp.id,
      isActive: true,
    },
  })
  await prisma.employeeSalarySetting.deleteMany({ where: { employeeId: constEmp.id } })
  await prisma.employeeSalarySetting.create({
    data: {
      employeeId: constEmp.id,
      effectiveFrom: new Date('2020-10-01'),
      monthlySalary: 381000,
      baseSalary: 300000,
      jobAllowance: 81000,
      includeJobAllowanceInBaseWage: false,
      fixedOvertimeAllowance: 81000,
      fixedOvertimeMinutes: 2700,
      familyAllowance: 10000,
      socialInsuranceEnrolled: true,
      nursingCareInsuranceApplicable: true,
      employmentInsuranceEnrolled: true,
      dependentsCount: 2,
      standardMonthlyRemuneration: 380000,
      residentTaxMonthly: 15000,
    },
  })

  console.log('✅ Sample employees: NAIL001, HQ001, CONST001 (password / PIN: 1234)')

  // =============================================
  // 法定控除マスタ (2025年度, 2026年度)
  // =============================================
  await prisma.statutoryRateMaster.upsert({
    where: { fiscalYear: 2025 },
    update: {},
    create: {
      fiscalYear: 2025,
      healthInsuranceRate: 0.0998,
      nursingCareInsuranceRate: 0.0160,
      welfarePensionRate: 0.1830,
      childSupportRate: 0.0036,
      employmentInsuranceEmployeeRate: 0.006,
      employmentInsuranceEmployerRate: 0.0095,
      effectiveFrom: new Date('2025-04-01'),
      effectiveTo: new Date('2026-03-31'),
    },
  })

  await prisma.statutoryRateMaster.upsert({
    where: { fiscalYear: 2026 },
    update: {},
    create: {
      fiscalYear: 2026,
      healthInsuranceRate: 0.0998,
      nursingCareInsuranceRate: 0.0160,
      welfarePensionRate: 0.1830,
      childSupportRate: 0.0036,
      employmentInsuranceEmployeeRate: 0.006,
      employmentInsuranceEmployerRate: 0.0095,
      effectiveFrom: new Date('2026-04-01'),
      effectiveTo: new Date('2027-03-31'),
    },
  })
  console.log('✅ Statutory rate masters (2025, 2026)')

  // =============================================
  // 標準報酬月額テーブル (一部サンプル, 2025年度)
  // =============================================
  const smrData = [
    { grade: 1, min: null, max: 63000, smr: 58000, hFull: 5784, hHalf: 2892, cFull: 928, cHalf: 464, pFull: 10614, pHalf: 5307 },
    { grade: 5, min: 101000, max: 107000, smr: 104000, hFull: 10379, hHalf: 5190, cFull: 1664, cHalf: 832, pFull: 19032, pHalf: 9516 },
    { grade: 10, min: 150000, max: 160000, smr: 150000, hFull: 14970, hHalf: 7485, cFull: 2400, cHalf: 1200, pFull: 27450, pHalf: 13725 },
    { grade: 15, min: 210000, max: 230000, smr: 220000, hFull: 21956, hHalf: 10978, cFull: 3520, cHalf: 1760, pFull: 40260, pHalf: 20130 },
    { grade: 18, min: 270000, max: 290000, smr: 280000, hFull: 27944, hHalf: 13972, cFull: 4480, cHalf: 2240, pFull: 51240, pHalf: 25620 },
    { grade: 20, min: 310000, max: 330000, smr: 320000, hFull: 31936, hHalf: 15968, cFull: 5120, cHalf: 2560, pFull: 58560, pHalf: 29280 },
    { grade: 22, min: 350000, max: 370000, smr: 360000, hFull: 35928, hHalf: 17964, cFull: 5760, cHalf: 2880, pFull: 65880, pHalf: 32940 },
    { grade: 24, min: 395000, max: 425000, smr: 410000, hFull: 40918, hHalf: 20459, cFull: 6560, cHalf: 3280, pFull: 75030, pHalf: 37515 },
    { grade: 27, min: 485000, max: 515000, smr: 500000, hFull: 49900, hHalf: 24950, cFull: 8000, cHalf: 4000, pFull: 91500, pHalf: 45750 },
    { grade: 30, min: 605000, max: 635000, smr: 620000, hFull: 61876, hHalf: 30938, cFull: 9920, cHalf: 4960, pFull: 113460, pHalf: 56730 },
  ]

  for (const row of smrData) {
    await prisma.standardMonthlyRemunerationTable.upsert({
      where: { fiscalYear_grade: { fiscalYear: 2025, grade: row.grade } },
      update: {},
      create: {
        fiscalYear: 2025,
        grade: row.grade,
        remunerationMin: row.min,
        remunerationMax: row.max,
        standardMonthlyRemuneration: row.smr,
        healthInsuranceFull: row.hFull,
        healthInsuranceHalf: row.hHalf,
        careInsuranceFull: row.cFull,
        careInsuranceHalf: row.cHalf,
        pensionFull: row.pFull,
        pensionHalf: row.pHalf,
      },
    })
  }
  console.log('✅ Standard monthly remuneration table (sample grades)')

  // =============================================
  // 所得税テーブル (一部サンプル, 2025年度, 甲欄)
  // =============================================
  // Delete existing to avoid duplicates on re-run
  await prisma.incomeTaxTable.deleteMany({ where: { fiscalYear: 2025 } })

  const taxData = [
    { from: 0, to: 88000, deps: 0, tax: 0 },
    { from: 88000, to: 89000, deps: 0, tax: 130 },
    { from: 150000, to: 153000, deps: 0, tax: 2980 },
    { from: 200000, to: 203000, deps: 0, tax: 4770 },
    { from: 250000, to: 253000, deps: 0, tax: 6530 },
    { from: 300000, to: 303000, deps: 0, tax: 8420 },
    { from: 350000, to: 353000, deps: 0, tax: 11120 },
    { from: 400000, to: 403000, deps: 0, tax: 14650 },
    { from: 500000, to: 503000, deps: 0, tax: 24500 },
    { from: 0, to: 88000, deps: 1, tax: 0 },
    { from: 150000, to: 153000, deps: 1, tax: 1610 },
    { from: 200000, to: 203000, deps: 1, tax: 3200 },
    { from: 300000, to: 303000, deps: 1, tax: 6850 },
    { from: 400000, to: 403000, deps: 1, tax: 12900 },
    { from: 0, to: 88000, deps: 2, tax: 0 },
    { from: 200000, to: 203000, deps: 2, tax: 1720 },
    { from: 300000, to: 303000, deps: 2, tax: 5290 },
    { from: 400000, to: 403000, deps: 2, tax: 11120 },
  ]

  for (const row of taxData) {
    await prisma.incomeTaxTable.create({
      data: {
        fiscalYear: 2025,
        salaryFrom: row.from,
        salaryTo: row.to,
        dependentsCount: row.deps,
        taxAmount: row.tax,
      },
    })
  }
  console.log('✅ Income tax table (sample entries)')

  // =============================================
  // 今月の営業日カレンダー
  // =============================================
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    date.setHours(0, 0, 0, 0)
    const dow = date.getDay()

    let dayType: 'business_day' | 'scheduled_holiday' | 'legal_holiday' = 'business_day'
    if (dow === 0) dayType = 'legal_holiday'
    else if (dow === 6) dayType = 'scheduled_holiday'

    // Use findFirst + create/update to handle nullable departmentId
    const existing = await prisma.workSchedule.findFirst({
      where: { companyId: company.id, departmentId: null, targetDate: date },
    })
    if (!existing) {
      await prisma.workSchedule.create({
        data: {
          companyId: company.id,
          departmentId: null,
          targetDate: date,
          dayType,
          note: dow === 0 ? '日曜日' : dow === 6 ? '土曜日' : null,
        },
      })
    }
  }
  console.log('✅ Work schedules for current month')

  // =============================================
  // サンプル勤怠データ (今月の平日5日分)
  // =============================================
  const sampleEmployees = [
    { emp: nailEmp, clockIn: '09:45', clockOut: '18:15', breakMin: 60 },
    { emp: hqEmp, clockIn: '09:00', clockOut: '18:00', breakMin: 60 },
    { emp: constEmp, clockIn: '08:00', clockOut: '17:00', breakMin: 60 },
  ]

  for (const { emp, clockIn, clockOut, breakMin } of sampleEmployees) {
    for (let day = 1; day <= 5; day++) {
      const workDate = new Date(year, month, day)
      if (workDate.getDay() === 0 || workDate.getDay() === 6) continue

      const [inH, inM] = clockIn.split(':').map(Number)
      const [outH, outM] = clockOut.split(':').map(Number)
      const clockInAt = new Date(year, month, day, inH, inM)
      const clockOutAt = new Date(year, month, day, outH, outM)
      const rawMin = (clockOutAt.getTime() - clockInAt.getTime()) / 60000
      const netMin = rawMin - breakMin

      // Use findFirst to avoid compound unique issues
      const existingRecord = await prisma.attendanceRecord.findFirst({
        where: { employeeId: emp.id, workDate },
      })
      if (!existingRecord) {
        await prisma.attendanceRecord.create({
          data: {
            employeeId: emp.id,
            workDate,
            clockInAt,
            clockOutAt,
            breakMinutes: breakMin,
            workedMinutesRaw: Math.round(rawMin),
            workedMinutesNet: Math.round(netMin),
            status: 'confirmed',
          },
        })
      }
    }
  }
  console.log('✅ Sample attendance records')

  console.log('')
  console.log('🎉 Seeding completed!')
  console.log('')
  console.log('📌 Test accounts:')
  console.log('   Admin: admin@example.com / admin123')
  console.log('   ネイル: NAIL001 / password (PIN: 1234)')
  console.log('   本部: HQ001 / password (PIN: 1234)')
  console.log('   建設: CONST001 / password (PIN: 1234)')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
