/**
 * FixedOvertimeCalculationService (■14-13)
 *
 * 固定残業超過額の計算
 * fixed_overtime_excess_minutes = max(0, normal_overtime_minutes - fixed_overtime_minutes)
 * fixed_overtime_excess_pay = excess_minutes / 60 * base_hourly_wage * 1.25
 */

import type { RoundingRule } from '@prisma/client'
import { applyRounding } from './BaseWageCalculationService'

export interface FixedOvertimeInput {
  normalOvertimeMinutes: number
  fixedOvertimeMinutes: number
  baseHourlyWage: number
  payRoundingRule: RoundingRule
}

export interface FixedOvertimeResult {
  fixedOvertimeMinutes: number
  fixedOvertimeExcessMinutes: number
  fixedOvertimeExcessPay: number
}

export function calculateFixedOvertime(input: FixedOvertimeInput): FixedOvertimeResult {
  const excessMinutes = Math.max(0, input.normalOvertimeMinutes - input.fixedOvertimeMinutes)
  const excessPay = excessMinutes > 0
    ? applyRounding((excessMinutes / 60) * input.baseHourlyWage * 1.25, input.payRoundingRule)
    : 0

  return {
    fixedOvertimeMinutes: input.fixedOvertimeMinutes,
    fixedOvertimeExcessMinutes: excessMinutes,
    fixedOvertimeExcessPay: excessPay,
  }
}
