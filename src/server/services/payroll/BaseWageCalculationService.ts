/**
 * BaseWageCalculationService
 *
 * 時間単価の算出 (■14-2)
 * base_hourly_wage = base_wage_target_amount / monthly_average_work_hours
 *
 * base_wage_target_amount:
 *  - 基本給
 *  - 基礎賃金算入対象の固定手当 (allowance_types.included_in_base_wage)
 *
 * 除外: 家族手当/通勤手当等は手当名ではなく included_in_base_wage フラグで判定
 */

import type { RoundingRule } from '@prisma/client'

export interface BaseWageInput {
  baseSalary: number
  /** 基礎賃金算入対象の手当合計 */
  includedAllowanceTotal: number
  /** 職務手当 */
  jobAllowance: number
  /** 職務手当を基礎賃金に算入するか */
  includeJobAllowanceInBaseWage: boolean
  /** 月平均所定労働時間(分) */
  monthlyAverageWorkMinutes: number
  /** 丸めルール */
  payRoundingRule: RoundingRule
}

export interface BaseWageResult {
  baseWageTargetAmount: number
  monthlyAverageWorkMinutes: number
  monthlyAverageWorkHours: number
  baseHourlyWage: number
}

export function calculateBaseWage(input: BaseWageInput): BaseWageResult {
  let baseWageTarget = input.baseSalary + input.includedAllowanceTotal

  if (input.includeJobAllowanceInBaseWage) {
    baseWageTarget += input.jobAllowance
  }

  const monthlyHours = input.monthlyAverageWorkMinutes / 60

  // 時間単価: 端数処理は部門の payRoundingRule
  const rawHourlyWage = baseWageTarget / monthlyHours
  const baseHourlyWage = applyRounding(rawHourlyWage, input.payRoundingRule)

  return {
    baseWageTargetAmount: baseWageTarget,
    monthlyAverageWorkMinutes: input.monthlyAverageWorkMinutes,
    monthlyAverageWorkHours: monthlyHours,
    baseHourlyWage,
  }
}

export function applyRounding(value: number, rule: RoundingRule): number {
  switch (rule) {
    case 'ceil':
      return Math.ceil(value)
    case 'floor':
      return Math.floor(value)
    case 'round':
      return Math.round(value)
  }
}
