import { prisma } from './prisma'
import { Decimal } from '@prisma/client/runtime/library'
import { startOfMonth, endOfMonth } from 'date-fns'

// 給与計算の設定
const SETTINGS = {
    // 標準労働時間（月）
    STANDARD_MONTHLY_HOURS: 160,
    // 標準労働時間（日）
    STANDARD_DAILY_HOURS: 8,
    // 残業割増率
    OVERTIME_RATE: 1.25,
    // 休日出勤割増率
    HOLIDAY_RATE: 1.35,
    // 社会保険料率（簡易計算）
    SOCIAL_INSURANCE_RATE: 0.15,
    // 雇用保険料率
    EMPLOYMENT_INSURANCE_RATE: 0.006,
    // 所得税簡易計算用の控除額
    INCOME_TAX_DEDUCTION: 80000,
    // 所得税率（簡易）
    INCOME_TAX_RATE: 0.05,
}

export interface PayrollCalculationResult {
    employeeId: string
    employeeName: string
    employeeCode: string
    baseSalary: number
    overtimePay: number
    holidayPay: number
    deemedOvertimePay: number
    grossSalary: number
    socialInsurance: number
    employmentInsurance: number
    incomeTax: number
    totalDeductions: number
    netSalary: number
    workHours: number
    overtimeHours: number
    holidayHours: number
    warnings: string[]
}

// 時間をDecimalから数値に変換
function toNumber(value: Decimal | number | null): number {
    if (value === null) return 0
    if (typeof value === 'number') return value
    return value.toNumber()
}

// 2つの日時間の時間差を計算（時間単位）
function calculateHours(clockIn: Date, clockOut: Date | null): number {
    if (!clockOut) return 0
    return (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60)
}

// 月の給与を計算
export async function calculateMonthlyPayroll(
    yearMonth: string
): Promise<PayrollCalculationResult[]> {
    const [year, month] = yearMonth.split('-').map(Number)
    const startDate = startOfMonth(new Date(year, month - 1))
    const endDate = endOfMonth(startDate)

    // 対象月の営業日数を取得 (建設部門向け)
    const holidays = await prisma.businessCalendar.findMany({
        where: {
            date: { gte: startDate, lte: endDate },
            isHoliday: true,
        },
    })
    const companyHolidayDates = new Set(
        holidays.map((h) => h.date.toISOString().split('T')[0])
    )

    // アクティブな従業員を取得
    const employees = await prisma.employee.findMany({
        where: { isActive: true },
        include: {
            timeEntries: {
                where: {
                    date: { gte: startDate, lte: endDate },
                },
            },
            shiftEntries: {
                where: {
                    date: { gte: startDate, lte: endDate },
                    isConfirmed: true, // 確定済みシフトのみ
                },
            },
        },
    })

    const results: PayrollCalculationResult[] = []

    for (const employee of employees) {
        const warnings: string[] = []

        // 勤務時間の集計
        let totalWorkHours = 0
        let totalHolidayHours = 0

        for (const entry of employee.timeEntries) {
            if (entry.isPaidLeave) {
                // 有給は標準時間で計算
                totalWorkHours += SETTINGS.STANDARD_DAILY_HOURS
                continue
            }

            const hours = calculateHours(entry.clockIn, entry.clockOut)
            // 休日出勤の判定
            // 建設部門(CONSTRUCTION)は会社カレンダー基準、それ以外はシフトでisRest=trueの日が休日
            let isHoliday = false
            const dateStr = entry.date.toISOString().split('T')[0]
            
            if (employee.jobType === 'CONSTRUCTION') {
                isHoliday = companyHolidayDates.has(dateStr)
            } else {
                const shiftForDay = employee.shiftEntries.find(
                    (s) => s.date.toISOString().split('T')[0] === dateStr
                )
                // シフトが存在しない日、またはシフト上で休みとなっている日を休日扱い
                isHoliday = !shiftForDay || shiftForDay.isRest
            }

            if (entry.isHolidayWork || isHoliday) {
                totalHolidayHours += hours
            } else {
                totalWorkHours += hours
            }
        }

        // 所定労働時間の計算
        let standardMonthlyHours = SETTINGS.STANDARD_MONTHLY_HOURS
        if (employee.jobType !== 'CONSTRUCTION') {
            // 建設部門以外は、確定シフトの合計時間を所定労働時間とする
            let shiftTotalHours = 0
            for (const shift of employee.shiftEntries) {
                if (!shift.isRest && shift.startTime && shift.endTime) {
                    shiftTotalHours += calculateHours(shift.startTime, shift.endTime)
                }
            }
            // シフト時間が0の場合は通常の標準時間を採用（未提出等のフォールバック）
            if (shiftTotalHours > 0) {
                standardMonthlyHours = shiftTotalHours
            }
        }

        // 残業時間計算
        const regularHours = Math.min(totalWorkHours, standardMonthlyHours)
        let overtimeHours = Math.max(0, totalWorkHours - standardMonthlyHours)

        // 基本給計算
        let baseSalary: number
        let overtimePay = 0
        let holidayPay = 0
        let deemedOvertimePay = 0

        if (employee.wageType === 'HOURLY') {
            // 時給制
            const hourlyRate = toNumber(employee.hourlyRate)
            baseSalary = regularHours * hourlyRate
            overtimePay = overtimeHours * hourlyRate * SETTINGS.OVERTIME_RATE
            holidayPay = totalHolidayHours * hourlyRate * SETTINGS.HOLIDAY_RATE

            // 最低賃金チェック
            const minimumWage = toNumber(employee.minimumWage)
            if (hourlyRate < minimumWage) {
                warnings.push(`時給(¥${hourlyRate})が最低賃金(¥${minimumWage})を下回っています`)
            }
        } else {
            // 固定給制
            baseSalary = toNumber(employee.monthlySalary)
            const hourlyRate = baseSalary / standardMonthlyHours

            // みなし残業制の場合
            if (employee.deemedOvertimeEnabled) {
                const deemedHours = toNumber(employee.deemedOvertimeHours)
                deemedOvertimePay = deemedHours * hourlyRate * SETTINGS.OVERTIME_RATE
                // みなし残業を超えた分のみ残業代を支払う
                const excessOvertimeHours = Math.max(0, overtimeHours - deemedHours)
                overtimePay = excessOvertimeHours * hourlyRate * SETTINGS.OVERTIME_RATE
            } else {
                overtimePay = overtimeHours * hourlyRate * SETTINGS.OVERTIME_RATE
            }

            holidayPay = totalHolidayHours * hourlyRate * SETTINGS.HOLIDAY_RATE

            // 最低賃金チェック（時給換算）
            const effectiveHourlyRate = baseSalary / standardMonthlyHours
            const minimumWage = toNumber(employee.minimumWage)
            if (effectiveHourlyRate < minimumWage) {
                warnings.push(
                    `時給換算(¥${Math.round(effectiveHourlyRate)})が最低賃金(¥${minimumWage})を下回っています`
                )
            }
        }

        // 総支給額
        const grossSalary = baseSalary + overtimePay + holidayPay + deemedOvertimePay

        // 社会保険料（簡易計算）
        const socialInsurance = Math.round(grossSalary * SETTINGS.SOCIAL_INSURANCE_RATE)

        // 雇用保険料
        const employmentInsurance = Math.round(grossSalary * SETTINGS.EMPLOYMENT_INSURANCE_RATE)

        // 所得税（簡易計算）
        const taxableIncome = Math.max(0, grossSalary - socialInsurance - employmentInsurance - SETTINGS.INCOME_TAX_DEDUCTION)
        const incomeTax = Math.round(taxableIncome * SETTINGS.INCOME_TAX_RATE)

        // 控除合計
        const totalDeductions = socialInsurance + employmentInsurance + incomeTax

        // 差引支給額
        const netSalary = grossSalary - totalDeductions

        results.push({
            employeeId: employee.id,
            employeeName: employee.name,
            employeeCode: employee.employeeCode,
            baseSalary: Math.round(baseSalary),
            overtimePay: Math.round(overtimePay),
            holidayPay: Math.round(holidayPay),
            deemedOvertimePay: Math.round(deemedOvertimePay),
            grossSalary: Math.round(grossSalary),
            socialInsurance,
            employmentInsurance,
            incomeTax,
            totalDeductions,
            netSalary: Math.round(netSalary),
            workHours: Math.round(totalWorkHours * 10) / 10,
            overtimeHours: Math.round(overtimeHours * 10) / 10,
            holidayHours: Math.round(totalHolidayHours * 10) / 10,
            warnings,
        })
    }

    return results
}

// 給与明細を保存
export async function savePayrollItems(
    yearMonth: string,
    items: PayrollCalculationResult[]
): Promise<string> {
    // 既存のPayrollRunを確認
    let payrollRun = await prisma.payrollRun.findUnique({
        where: { yearMonth },
    })

    if (payrollRun?.status === 'CONFIRMED') {
        throw new Error('この月の給与は確定済みです')
    }

    // PayrollRunがなければ作成
    if (!payrollRun) {
        payrollRun = await prisma.payrollRun.create({
            data: { yearMonth },
        })
    }

    // 既存のPayrollItemsを削除
    await prisma.payrollItem.deleteMany({
        where: { payrollRunId: payrollRun.id },
    })

    // 新しいPayrollItemsを作成
    await prisma.payrollItem.createMany({
        data: items.map((item) => ({
            payrollRunId: payrollRun!.id,
            employeeId: item.employeeId,
            baseSalary: item.baseSalary,
            overtimePay: item.overtimePay,
            holidayPay: item.holidayPay,
            deemedOvertimePay: item.deemedOvertimePay,
            grossSalary: item.grossSalary,
            socialInsurance: item.socialInsurance,
            employmentInsurance: item.employmentInsurance,
            incomeTax: item.incomeTax,
            totalDeductions: item.totalDeductions,
            netSalary: item.netSalary,
            workHours: item.workHours,
            overtimeHours: item.overtimeHours,
            holidayHours: item.holidayHours,
        })),
    })

    return payrollRun.id
}

// 給与を確定
export async function confirmPayroll(
    payrollRunId: string,
    confirmedById: string
): Promise<void> {
    const payrollRun = await prisma.payrollRun.findUnique({
        where: { id: payrollRunId },
    })

    if (!payrollRun) {
        throw new Error('給与データが見つかりません')
    }

    if (payrollRun.status === 'CONFIRMED') {
        throw new Error('この給与は既に確定されています')
    }

    await prisma.payrollRun.update({
        where: { id: payrollRunId },
        data: {
            status: 'CONFIRMED',
            confirmedById,
            confirmedAt: new Date(),
        },
    })
}

// 給与を差し戻し
export async function revertPayroll(payrollRunId: string): Promise<void> {
    const payrollRun = await prisma.payrollRun.findUnique({
        where: { id: payrollRunId },
    })

    if (!payrollRun) {
        throw new Error('給与データが見つかりません')
    }

    await prisma.payrollRun.update({
        where: { id: payrollRunId },
        data: {
            status: 'REVERTED',
            confirmedById: null,
            confirmedAt: null,
        },
    })
}
