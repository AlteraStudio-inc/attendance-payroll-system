/**
 * DeductionCalculationService (■15)
 *
 * 法定控除計算
 * - 健康保険 / 介護保険 / 厚生年金: 標準報酬月額テーブル参照 (折半)
 * - 雇用保険: gross_pay * rate
 * - 所得税: income_tax_tables 参照
 * - 住民税: 月額固定
 */

import { prisma } from '@/lib/prisma'

export interface DeductionInput {
  employeeId: string
  grossPay: number
  standardMonthlyRemuneration: number
  socialInsuranceEnrolled: boolean
  nursingCareInsuranceApplicable: boolean
  employmentInsuranceEnrolled: boolean
  dependentsCount: number
  residentTaxMonthly: number
  fiscalYear: number
  socialInsuranceTotal: number // placeholder, calculated internally
}

export interface DeductionResult {
  healthInsurance: number
  nursingCareInsurance: number
  welfarePension: number
  employmentInsurance: number
  incomeTax: number
  residentTax: number
}

export async function calculateDeductions(input: DeductionInput): Promise<DeductionResult> {
  let healthInsurance = 0
  let nursingCareInsurance = 0
  let welfarePension = 0
  let employmentInsurance = 0

  // 社保 (■15-1)
  if (input.socialInsuranceEnrolled && input.standardMonthlyRemuneration > 0) {
    const smrTable = await prisma.standardMonthlyRemunerationTable.findFirst({
      where: {
        fiscalYear: input.fiscalYear,
        standardMonthlyRemuneration: input.standardMonthlyRemuneration,
      },
    })

    if (smrTable) {
      healthInsurance = smrTable.healthInsuranceHalf ?? 0
      if (input.nursingCareInsuranceApplicable) {
        nursingCareInsurance = smrTable.careInsuranceHalf ?? 0
      }
      welfarePension = smrTable.pensionHalf ?? 0
    } else {
      // テーブルに完全一致がない場合、料率から計算
      const rates = await prisma.statutoryRateMaster.findUnique({
        where: { fiscalYear: input.fiscalYear },
      })
      if (rates) {
        const smr = input.standardMonthlyRemuneration
        healthInsurance = Math.round(smr * Number(rates.healthInsuranceRate) / 2)
        if (input.nursingCareInsuranceApplicable) {
          nursingCareInsurance = Math.round(smr * Number(rates.nursingCareInsuranceRate) / 2)
        }
        welfarePension = Math.round(smr * Number(rates.welfarePensionRate) / 2)
      }
    }
  }

  // 雇用保険 (■15-2)
  if (input.employmentInsuranceEnrolled) {
    const rates = await prisma.statutoryRateMaster.findUnique({
      where: { fiscalYear: input.fiscalYear },
    })
    if (rates) {
      employmentInsurance = Math.round(input.grossPay * Number(rates.employmentInsuranceEmployeeRate))
    }
  }

  // 所得税 (■15-3)
  const socialInsuranceTotal = healthInsurance + nursingCareInsurance + welfarePension + employmentInsurance
  const taxableAmount = input.grossPay - socialInsuranceTotal
  const incomeTax = await lookupIncomeTax(input.fiscalYear, taxableAmount, input.dependentsCount)

  // 住民税 (■15-4)
  const residentTax = input.residentTaxMonthly

  return {
    healthInsurance,
    nursingCareInsurance,
    welfarePension,
    employmentInsurance,
    incomeTax,
    residentTax,
  }
}

async function lookupIncomeTax(
  fiscalYear: number,
  taxableAmount: number,
  dependentsCount: number
): Promise<number> {
  if (taxableAmount <= 0) return 0

  const entry = await prisma.incomeTaxTable.findFirst({
    where: {
      fiscalYear,
      dependentsCount,
      salaryFrom: { lte: taxableAmount },
      salaryTo: { gt: taxableAmount },
    },
  })

  if (entry) return entry.taxAmount

  // テーブルにない場合は簡易計算 (実務ではテーブル完備が前提)
  // TODO: 完全な源泉徴収税額表を投入後、この分岐は不要になる
  if (taxableAmount <= 88000) return 0
  return Math.round(Math.max(0, taxableAmount - 88000) * 0.05)
}
