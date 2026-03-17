/**
 * PayrollCalculationService
 *
 * 月次給与計算のメインエンジン (■14-1)
 * 共通計算エンジン + 部門別設定 + 法定控除マスタ の構造
 */

import { prisma } from '@/lib/prisma'
import { calculateBaseWage, applyRounding } from './BaseWageCalculationService'
import { calculateDeductions, type DeductionInput } from '../deductions/DeductionCalculationService'
import { calculateFixedOvertime, type FixedOvertimeInput } from './FixedOvertimeCalculationService'
import type { RoundingRule, Department, EmployeeSalarySetting, Employee, AllowanceType, EmployeeAllowance } from '@prisma/client'

export interface PayrollItemResult {
  employeeId: string
  departmentSnapshotJson: string
  salarySettingSnapshotJson: string
  baseHourlyWage: number
  baseSalary: number
  allowanceTotal: number
  fixedOvertimeAllowance: number
  withinScheduledOvertimePay: number
  overtimePay: number
  scheduledHolidayPay: number
  legalHolidayPay: number
  lateNightPay: number
  incentivePay: number
  commutingPay: number
  grossPay: number
  lateDeduction: number
  earlyLeaveDeduction: number
  absenceDeduction: number
  healthInsurance: number
  nursingCareInsurance: number
  welfarePension: number
  employmentInsurance: number
  incomeTax: number
  residentTax: number
  otherDeductions: number
  totalDeductions: number
  netPay: number
  fixedOvertimeMinutes: number
  fixedOvertimeExcessMinutes: number
  fixedOvertimeExcessPay: number
  // 勤怠サマリ
  totalWorkDays: number
  totalWorkedMinutes: number
  totalOvertimeMinutes: number
  totalLateNightMinutes: number
  totalHolidayMinutes: number
  totalLateMinutes: number
  totalEarlyLeaveMinutes: number
  totalAbsenceMinutes: number
  warnings: string[]
}

export async function calculateMonthlyPayroll(
  companyId: string,
  year: number,
  month: number,
  targetDepartmentId?: string,
  targetEmployeeId?: string
): Promise<PayrollItemResult[]> {
  // 対象従業員取得
  const where: any = { companyId, active: true }
  if (targetDepartmentId) where.departmentId = targetDepartmentId
  if (targetEmployeeId) where.id = targetEmployeeId

  const employees = await prisma.employee.findMany({
    where,
    include: {
      department: true,
      salarySettings: {
        orderBy: { effectiveFrom: 'desc' },
      },
      allowances: {
        include: { allowanceType: true },
      },
    },
  })

  // 対象月の日付範囲
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0) // 月末
  endDate.setHours(23, 59, 59, 999)

  // 法定控除マスタ (年度)
  const fiscalYear = month >= 4 ? year : year - 1
  const statutoryRates = await prisma.statutoryRateMaster.findUnique({
    where: { fiscalYear },
  })
  if (!statutoryRates) {
    throw new Error(`${fiscalYear}年度の法定控除マスタが登録されていません。計算を中止します。`)
  }

  const results: PayrollItemResult[] = []

  for (const employee of employees) {
    const result = await calculateForEmployee(
      employee,
      year,
      month,
      startDate,
      endDate,
      statutoryRates
    )
    results.push(result)
  }

  return results
}

async function calculateForEmployee(
  employee: Employee & {
    department: Department
    salarySettings: EmployeeSalarySetting[]
    allowances: (EmployeeAllowance & { allowanceType: AllowanceType })[]
  },
  year: number,
  month: number,
  startDate: Date,
  endDate: Date,
  statutoryRates: any
): Promise<PayrollItemResult> {
  const warnings: string[] = []
  const dept = employee.department

  // 有効な給与設定を取得
  const salary = employee.salarySettings.find(s => {
    const from = new Date(s.effectiveFrom)
    const to = s.effectiveTo ? new Date(s.effectiveTo) : null
    return from <= endDate && (!to || to >= startDate)
  })
  if (!salary) {
    warnings.push('有効な給与設定が見つかりません')
    return createEmptyResult(employee.id, dept, null, warnings)
  }

  // 勤怠レコード取得
  const attendanceRecords = await prisma.attendanceRecord.findMany({
    where: {
      employeeId: employee.id,
      workDate: { gte: startDate, lte: endDate },
    },
  })

  // 勤怠集計
  let totalWorkedMinutes = 0
  let totalOvertimeMinutes = 0
  let totalWithinScheduledOT = 0
  let totalScheduledHolidayMinutes = 0
  let totalLegalHolidayMinutes = 0
  let totalLateNightMinutes = 0
  let totalLateMinutes = 0
  let totalEarlyLeaveMinutes = 0
  let totalAbsenceMinutes = 0
  let totalWorkDays = 0

  for (const record of attendanceRecords) {
    if (record.clockInAt && record.clockOutAt) totalWorkDays++
    totalWorkedMinutes += record.workedMinutesNet
    totalOvertimeMinutes += record.normalOvertimeMinutes
    totalWithinScheduledOT += record.withinScheduledOvertimeMinutes
    totalScheduledHolidayMinutes += record.scheduledHolidayMinutes
    totalLegalHolidayMinutes += record.legalHolidayMinutes
    totalLateNightMinutes += record.lateNightMinutes
    totalLateMinutes += record.lateMinutes
    totalEarlyLeaveMinutes += record.earlyLeaveMinutes
    totalAbsenceMinutes += record.absenceMinutes
  }

  // 基礎賃金算入対象の手当合計
  const includedAllowances = employee.allowances.filter(a =>
    a.allowanceType.includedInBaseWage &&
    a.allowanceType.category !== 'fixed_overtime' &&
    a.allowanceType.category !== 'commuting' &&
    a.allowanceType.category !== 'incentive'
  )
  const includedAllowanceTotal = includedAllowances.reduce((sum, a) => sum + a.amount, 0)

  // 時間単価計算 (■14-2)
  const baseWage = calculateBaseWage({
    baseSalary: salary.baseSalary ?? 0,
    includedAllowanceTotal,
    jobAllowance: salary.jobAllowance ?? 0,
    includeJobAllowanceInBaseWage: salary.includeJobAllowanceInBaseWage,
    monthlyAverageWorkMinutes: dept.monthlyAverageWorkMinutes,
    payRoundingRule: dept.payRoundingRule,
  })

  const hourlyWage = baseWage.baseHourlyWage
  const payRound = dept.payRoundingRule
  const dedRound = dept.deductionRoundingRule

  // 支給額計算 (■14-12)
  const withinScheduledOvertimePay = applyRounding(
    (totalWithinScheduledOT / 60) * hourlyWage * 1.00, payRound
  )
  const overtimePay = applyRounding(
    (totalOvertimeMinutes / 60) * hourlyWage * 1.25, payRound
  )
  const scheduledHolidayPay = applyRounding(
    (totalScheduledHolidayMinutes / 60) * hourlyWage * 1.25, payRound
  )
  const legalHolidayPay = applyRounding(
    (totalLegalHolidayMinutes / 60) * hourlyWage * 1.35, payRound
  )
  const lateNightPay = applyRounding(
    (totalLateNightMinutes / 60) * hourlyWage * 0.25, payRound
  )

  // 固定残業 (■14-13)
  const fixedOTMinutes = salary.fixedOvertimeMinutesOverride
    ?? salary.fixedOvertimeMinutes
    ?? (dept.fixedOvertimeEnabled ? dept.fixedOvertimeMinutes : 0)
  const fixedOTAllowance = salary.fixedOvertimeAllowance ?? 0

  const fixedOT = calculateFixedOvertime({
    normalOvertimeMinutes: totalOvertimeMinutes,
    fixedOvertimeMinutes: fixedOTMinutes,
    baseHourlyWage: hourlyWage,
    payRoundingRule: payRound,
  })

  // 手当集計
  const commutingAllowance = salary.commutingAllowance ?? 0
  const incentivePay = salary.incentiveDefault ?? 0

  // 通常手当合計 (固定残業/通勤/インセンティブ除く)
  const regularAllowances = employee.allowances.filter(a =>
    a.allowanceType.category !== 'fixed_overtime' &&
    a.allowanceType.category !== 'commuting' &&
    a.allowanceType.category !== 'incentive'
  )
  const allowanceTotal = regularAllowances.reduce((sum, a) => sum + a.amount, 0)
    + (salary.positionAllowance ?? 0)
    + (salary.familyAllowance ?? 0)

  // 控除計算 (■14-14)
  const lateDeduction = applyRounding(
    (totalLateMinutes / 60) * hourlyWage, dedRound
  )
  const earlyLeaveDeduction = applyRounding(
    (totalEarlyLeaveMinutes / 60) * hourlyWage, dedRound
  )
  const absenceDeduction = applyRounding(
    (totalAbsenceMinutes / 60) * hourlyWage, dedRound
  )

  // 総支給 (■14-15)
  const baseSalaryAmount = salary.baseSalary ?? salary.monthlySalary ?? 0
  const grossPay =
    baseSalaryAmount
    + allowanceTotal
    + fixedOTAllowance
    + withinScheduledOvertimePay
    + overtimePay
    + scheduledHolidayPay
    + legalHolidayPay
    + lateNightPay
    + incentivePay
    + commutingAllowance
    + fixedOT.fixedOvertimeExcessPay

  // 法定控除 (■15)
  const deductions = await calculateDeductions({
    employeeId: employee.id,
    grossPay,
    standardMonthlyRemuneration: salary.standardMonthlyRemuneration ?? 0,
    socialInsuranceEnrolled: salary.socialInsuranceEnrolled,
    nursingCareInsuranceApplicable: salary.nursingCareInsuranceApplicable,
    employmentInsuranceEnrolled: salary.employmentInsuranceEnrolled,
    dependentsCount: salary.dependentsCount,
    residentTaxMonthly: salary.residentTaxMonthly ?? 0,
    fiscalYear: month >= 4 ? year : year - 1,
    socialInsuranceTotal: 0, // will be calculated
  })

  const totalDeductions =
    lateDeduction
    + earlyLeaveDeduction
    + absenceDeduction
    + deductions.healthInsurance
    + deductions.nursingCareInsurance
    + deductions.welfarePension
    + deductions.employmentInsurance
    + deductions.incomeTax
    + deductions.residentTax

  const netPay = grossPay - totalDeductions

  return {
    employeeId: employee.id,
    departmentSnapshotJson: JSON.stringify(dept),
    salarySettingSnapshotJson: JSON.stringify(salary),
    baseHourlyWage: hourlyWage,
    baseSalary: baseSalaryAmount,
    allowanceTotal,
    fixedOvertimeAllowance: fixedOTAllowance,
    withinScheduledOvertimePay,
    overtimePay,
    scheduledHolidayPay,
    legalHolidayPay,
    lateNightPay,
    incentivePay,
    commutingPay: commutingAllowance,
    grossPay,
    lateDeduction,
    earlyLeaveDeduction,
    absenceDeduction,
    healthInsurance: deductions.healthInsurance,
    nursingCareInsurance: deductions.nursingCareInsurance,
    welfarePension: deductions.welfarePension,
    employmentInsurance: deductions.employmentInsurance,
    incomeTax: deductions.incomeTax,
    residentTax: deductions.residentTax,
    otherDeductions: 0,
    totalDeductions,
    netPay,
    fixedOvertimeMinutes: fixedOTMinutes,
    fixedOvertimeExcessMinutes: fixedOT.fixedOvertimeExcessMinutes,
    fixedOvertimeExcessPay: fixedOT.fixedOvertimeExcessPay,
    totalWorkDays,
    totalWorkedMinutes,
    totalOvertimeMinutes,
    totalLateNightMinutes,
    totalHolidayMinutes: totalScheduledHolidayMinutes + totalLegalHolidayMinutes,
    totalLateMinutes,
    totalEarlyLeaveMinutes,
    totalAbsenceMinutes,
    warnings,
  }
}

function createEmptyResult(
  employeeId: string,
  dept: Department | null,
  salary: EmployeeSalarySetting | null,
  warnings: string[]
): PayrollItemResult {
  return {
    employeeId,
    departmentSnapshotJson: dept ? JSON.stringify(dept) : '{}',
    salarySettingSnapshotJson: salary ? JSON.stringify(salary) : '{}',
    baseHourlyWage: 0, baseSalary: 0, allowanceTotal: 0, fixedOvertimeAllowance: 0,
    withinScheduledOvertimePay: 0, overtimePay: 0, scheduledHolidayPay: 0,
    legalHolidayPay: 0, lateNightPay: 0, incentivePay: 0, commutingPay: 0,
    grossPay: 0, lateDeduction: 0, earlyLeaveDeduction: 0, absenceDeduction: 0,
    healthInsurance: 0, nursingCareInsurance: 0, welfarePension: 0,
    employmentInsurance: 0, incomeTax: 0, residentTax: 0, otherDeductions: 0,
    totalDeductions: 0, netPay: 0, fixedOvertimeMinutes: 0,
    fixedOvertimeExcessMinutes: 0, fixedOvertimeExcessPay: 0,
    totalWorkDays: 0, totalWorkedMinutes: 0, totalOvertimeMinutes: 0,
    totalLateNightMinutes: 0, totalHolidayMinutes: 0, totalLateMinutes: 0,
    totalEarlyLeaveMinutes: 0, totalAbsenceMinutes: 0, warnings,
  }
}
