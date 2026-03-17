import puppeteer from 'puppeteer'
import puppeteerCore from 'puppeteer-core'

const getBrowser = async () => {
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    const chromium = require('@sparticuz/chromium')
    return await puppeteerCore.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless === false ? false : true,
    })
  } else {
    return await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
  }
}
import * as fs from 'fs/promises'
import * as path from 'path'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

const COMPANY_NAME = process.env.COMPANY_NAME || '株式会社サンプル'
const STORAGE_PATH = process.env.PAYSLIP_STORAGE_PATH || './data/payslips'

// PayrollItem モデルに対応した給与明細データ
export interface PayslipData {
  employeeCode: string
  employeeName: string
  jobType?: string // 職種 (CONSTRUCTION, NAIL, EYELASH, SUPPORT)
  yearMonth: string

  // 支給項目
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

  // 控除項目
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

  // みなし残業関連
  fixedOvertimeMinutes: number
  fixedOvertimeExcessMinutes: number
  fixedOvertimeExcessPay: number

  // 勤怠集計
  totalWorkDays: number
  totalWorkedMinutes: number
  totalOvertimeMinutes: number
  totalLateNightMinutes: number
  totalHolidayMinutes: number

  // 時給基礎
  baseHourlyWage: number
}

// 分を「X時間Y分」形式に変換
function formatMinutes(minutes: number): string {
  if (minutes === 0) return '0'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}分`
  if (m === 0) return `${h}時間`
  return `${h}時間${m}分`
}

// 給与明細HTMLテンプレート（A4縦）
function generatePayslipHtml(data: PayslipData): string {
  const fmt = (amount: number) => amount === 0 ? '0' : amount.toLocaleString()
  const [year, month] = data.yearMonth.split('-')

  // 職種に応じた表示用部署名
  let jobTitle = '総務部・経理課'
  if (data.jobType === 'CONSTRUCTION') jobTitle = '建設部門'
  else if (data.jobType === 'NAIL') jobTitle = 'ネイルサロン部門'
  else if (data.jobType === 'EYELASH') jobTitle = 'アイラッシュ部門'
  else if (data.jobType === 'SUPPORT') jobTitle = '就労支援部門'

  const socialInsuranceTotal =
    data.healthInsurance + data.nursingCareInsurance + data.welfarePension + data.employmentInsurance

  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Noto Sans JP', sans-serif;
      font-size: 10px;
      line-height: 1.2;
      padding: 12mm 15mm;
      background: white;
      color: #000;
    }
    .company {
      text-align: right;
      margin-bottom: 12px;
      font-size: 11px;
    }
    .title-box {
      border: 2px solid #000;
      text-align: center;
      padding: 8px;
      font-size: 18px;
      font-weight: bold;
      width: 80%;
      margin: 0 auto 18px auto;
      background-color: #f0f7ff;
    }
    .info-container {
      display: flex;
      justify-content: space-between;
      margin-bottom: 14px;
    }
    .info-table {
      border-collapse: collapse;
      border: 2px solid #000;
    }
    .info-table th, .info-table td {
      border: 1px solid #000;
      padding: 4px 8px;
      text-align: center;
      height: 22px;
    }
    .info-table th {
      background-color: #f0f7ff;
      font-weight: normal;
    }
    .section-title {
      font-size: 11px;
      font-weight: bold;
      margin: 10px 0 4px 0;
      padding: 3px 8px;
      background-color: #e8f0fe;
      border-left: 4px solid #4472c4;
    }
    .main-table {
      width: 100%;
      border-collapse: collapse;
      border: 2px solid #000;
      margin-bottom: 8px;
    }
    .main-table th, .main-table td {
      border: 1px solid #000;
      padding: 3px 4px;
      text-align: right;
      height: 22px;
    }
    .main-table th {
      background-color: #f0f7ff;
      font-weight: normal;
      text-align: center;
      font-size: 9px;
    }
    .main-table td {
      font-size: 10px;
    }
    .side-th {
      writing-mode: vertical-rl;
      text-orientation: upright;
      letter-spacing: 4px;
      width: 4%;
      text-align: center !important;
      padding: 8px 0 !important;
      background-color: #dce6f0 !important;
      font-weight: bold !important;
    }
    .col-4 { width: 19%; }
    .col-5 { width: 19.2%; }
    .total-cell {
      background-color: #fff2cc;
      font-weight: bold;
    }
    .net-pay-row td {
      font-size: 13px;
      font-weight: bold;
      background-color: #d9ead3;
    }
    .remarks-table {
      width: 100%;
      border-collapse: collapse;
      border: 2px solid #000;
    }
    .remarks-table th, .remarks-table td {
      border: 1px solid #000;
      padding: 4px 6px;
    }
    .remarks-table th {
      background-color: #f0f7ff;
      width: 20%;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="company">${COMPANY_NAME}</div>
  <div class="title-box">給与明細書（${year}年${Number(month)}月分）</div>

  <div class="info-container">
    <table class="info-table" style="width: 48%;">
      <tr>
        <th style="width: 30%">部　署</th>
        <td style="text-align: left;">${jobTitle}</td>
      </tr>
      <tr>
        <th>社員番号</th>
        <td style="text-align: left;">${data.employeeCode}</td>
      </tr>
      <tr>
        <th>氏　名</th>
        <td style="text-align: left;">${data.employeeName}　様</td>
      </tr>
    </table>

    <table class="info-table" style="width: 38%;">
      <tr>
        <th style="width: 42%">給与支給日</th>
        <td>${year}年${Number(month)}月25日</td>
      </tr>
      <tr>
        <th>時給基礎単価</th>
        <td>${fmt(data.baseHourlyWage)} 円</td>
      </tr>
      <tr>
        <th>固定残業時間</th>
        <td>${formatMinutes(data.fixedOvertimeMinutes)}</td>
      </tr>
    </table>
  </div>

  <!-- 勤怠項目 -->
  <div class="section-title">勤怠項目</div>
  <table class="main-table">
    <tr>
      <th rowspan="2" class="side-th">勤怠</th>
      <th class="col-5">出勤日数</th>
      <th class="col-5">労働時間</th>
      <th class="col-5">時間外労働</th>
      <th class="col-5">深夜労働</th>
      <th class="col-5">休日労働</th>
    </tr>
    <tr>
      <td>${data.totalWorkDays} 日</td>
      <td>${formatMinutes(data.totalWorkedMinutes)}</td>
      <td>${formatMinutes(data.totalOvertimeMinutes)}</td>
      <td>${formatMinutes(data.totalLateNightMinutes)}</td>
      <td>${formatMinutes(data.totalHolidayMinutes)}</td>
    </tr>
  </table>

  <!-- 支給項目 -->
  <div class="section-title">支給項目</div>
  <table class="main-table">
    <tr>
      <th rowspan="10" class="side-th">支給</th>
      <th class="col-4">基本給</th>
      <th class="col-4">諸手当合計</th>
      <th class="col-4">固定残業手当</th>
      <th class="col-4">所定内残業手当</th>
      <th class="col-4">時間外手当</th>
    </tr>
    <tr>
      <td>${fmt(data.baseSalary)}</td>
      <td>${fmt(data.allowanceTotal)}</td>
      <td>${fmt(data.fixedOvertimeAllowance)}</td>
      <td>${fmt(data.withinScheduledOvertimePay)}</td>
      <td>${fmt(data.overtimePay)}</td>
    </tr>
    <tr>
      <th>法定休日手当</th>
      <th>所定休日手当</th>
      <th>深夜手当</th>
      <th>インセンティブ</th>
      <th>通勤手当</th>
    </tr>
    <tr>
      <td>${fmt(data.legalHolidayPay)}</td>
      <td>${fmt(data.scheduledHolidayPay)}</td>
      <td>${fmt(data.lateNightPay)}</td>
      <td>${fmt(data.incentivePay)}</td>
      <td>${fmt(data.commutingPay)}</td>
    </tr>
    <tr>
      <th colspan="4"></th>
      <th>支給額合計</th>
    </tr>
    <tr>
      <td colspan="4"></td>
      <td class="total-cell">${fmt(data.grossPay)}</td>
    </tr>
  </table>

  <!-- 控除項目 -->
  <div class="section-title">控除項目</div>
  <table class="main-table">
    <tr>
      <th rowspan="8" class="side-th">控除</th>
      <th class="col-4">遅刻控除</th>
      <th class="col-4">早退控除</th>
      <th class="col-4">欠勤控除</th>
      <th class="col-4"></th>
      <th class="col-4"></th>
    </tr>
    <tr>
      <td>${fmt(data.lateDeduction)}</td>
      <td>${fmt(data.earlyLeaveDeduction)}</td>
      <td>${fmt(data.absenceDeduction)}</td>
      <td></td>
      <td></td>
    </tr>
    <tr>
      <th>健康保険</th>
      <th>介護保険</th>
      <th>厚生年金</th>
      <th>雇用保険</th>
      <th></th>
    </tr>
    <tr>
      <td>${fmt(data.healthInsurance)}</td>
      <td>${fmt(data.nursingCareInsurance)}</td>
      <td>${fmt(data.welfarePension)}</td>
      <td>${fmt(data.employmentInsurance)}</td>
      <td></td>
    </tr>
    <tr>
      <th>所得税</th>
      <th>住民税</th>
      <th>その他控除</th>
      <th></th>
      <th>控除額合計</th>
    </tr>
    <tr>
      <td>${fmt(data.incomeTax)}</td>
      <td>${fmt(data.residentTax)}</td>
      <td>${fmt(data.otherDeductions)}</td>
      <td></td>
      <td class="total-cell">${fmt(data.totalDeductions)}</td>
    </tr>
  </table>

  <!-- 合計・差引支給額 -->
  <div class="section-title">合計</div>
  <table class="main-table">
    <tr>
      <th rowspan="2" class="side-th">合計</th>
      <th style="width: 24%">社会保険料合計</th>
      <th style="width: 24%">総支給額</th>
      <th style="width: 24%">控除合計</th>
      <th style="width: 24%">差引支給額（手取）</th>
    </tr>
    <tr class="net-pay-row">
      <td>${fmt(socialInsuranceTotal)}</td>
      <td>${fmt(data.grossPay)}</td>
      <td>${fmt(data.totalDeductions)}</td>
      <td>${fmt(data.netPay)}</td>
    </tr>
  </table>

  <!-- 固定残業超過・備考 -->
  <div class="section-title">備考</div>
  <table class="remarks-table">
    <tr>
      <th>固定残業超過分</th>
      <td>
        超過時間: ${formatMinutes(data.fixedOvertimeExcessMinutes)}　／
        超過手当: ${fmt(data.fixedOvertimeExcessPay)} 円
      </td>
    </tr>
    <tr>
      <th>備考</th>
      <td style="height: 40px; vertical-align: top;"></td>
    </tr>
  </table>

</body>
</html>
  `
}

// PDFを生成
export async function generatePayslipPdf(data: PayslipData): Promise<Buffer> {
  const html = generatePayslipHtml(data)

  const browser = await getBrowser()

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
    })

    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}

// PDFをファイルに保存
export async function savePayslipPdf(data: PayslipData): Promise<string> {
  const pdfBuffer = await generatePayslipPdf(data)

  // ディレクトリ作成
  const dirPath = path.join(STORAGE_PATH, data.yearMonth)
  await fs.mkdir(dirPath, { recursive: true })

  // ファイル名生成（タイムスタンプ付き、上書き禁止）
  const timestamp = Date.now()
  const filename = `${data.employeeCode}_${data.employeeName}_${timestamp}.pdf`
  const filePath = path.join(dirPath, filename)

  // ファイル保存
  await fs.writeFile(filePath, pdfBuffer)

  return filePath
}

// -------------------------------------------------------------
// 出勤簿PDF生成
// -------------------------------------------------------------
export async function generateAttendanceRecordPdfData(employeeData: any, timeEntries: any[], yearMonth: string): Promise<Buffer> {
  const [year, month] = yearMonth.split('-')

  let rowsHtml = ''
  timeEntries.forEach(entry => {
    const date = format(new Date(entry.date), 'MM/dd')
    const clockIn = entry.clockIn ? format(new Date(entry.clockIn), 'HH:mm') : ''
    const clockOut = entry.clockOut ? format(new Date(entry.clockOut), 'HH:mm') : ''
    const note = entry.note || ''

    rowsHtml += `
            <tr>
                <td>${date}</td>
                <td>${clockIn}</td>
                <td>${clockOut}</td>
                <td>${note}</td>
            </tr>
        `
  })

  const html = `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap" rel="stylesheet">
        <style>
            body { font-family: 'Noto Sans JP', sans-serif; font-size: 12px; padding: 20mm; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #333; padding: 6px; text-align: left; }
            th { background-color: #f1f5f9; }
            h1 { text-align: center; }
        </style>
    </head>
    <body>
        <h1>出勤簿 ${year}年${month}月</h1>
        <p>氏名: ${employeeData.name} (${employeeData.employeeCode})</p>
        <table>
            <thead>
                <tr>
                    <th>日付</th>
                    <th>出勤時間</th>
                    <th>退勤時間</th>
                    <th>備考（現場名など）</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml}
            </tbody>
        </table>
    </body>
    </html>
    `

  const browser = await getBrowser()

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdf = await page.pdf({ format: 'A4', margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}

// -------------------------------------------------------------
// 賃金台帳PDF生成（様式第20号準拠）
// -------------------------------------------------------------
export interface WageLedgerEntry {
  yearMonth: string
  // 勤怠
  totalWorkDays: number
  totalWorkedMinutes: number
  totalOvertimeMinutes: number
  totalHolidayMinutes: number
  totalLateNightMinutes: number
  // 支給
  baseSalary: number
  allowanceTotal: number
  fixedOvertimeAllowance: number
  overtimePay: number
  scheduledHolidayPay: number
  legalHolidayPay: number
  lateNightPay: number
  incentivePay: number
  commutingPay: number
  grossPay: number
  // 控除
  healthInsurance: number
  nursingCareInsurance: number
  welfarePension: number
  employmentInsurance: number
  incomeTax: number
  residentTax: number
  otherDeductions: number
  totalDeductions: number
  netPay: number
}

export interface WageLedgerData {
  employeeCode: string
  employeeName: string
  jobType?: string
  entries: WageLedgerEntry[]
}

function generateWageLedgerHtml(data: WageLedgerData): string {
  const fmt = (amount: number) => amount === 0 ? '0' : amount.toLocaleString()

  let jobTitle = ''
  if (data.jobType === 'CONSTRUCTION') jobTitle = '建設部門'
  else if (data.jobType === 'NAIL') jobTitle = 'ネイルサロン部門'
  else if (data.jobType === 'EYELASH') jobTitle = 'アイラッシュ部門'
  else if (data.jobType === 'SUPPORT') jobTitle = '就労支援部門'

  let rowsHtml = ''

  // 合計集計用
  let totWorkDays = 0, totWorkedMin = 0, totOtMin = 0, totHolidayMin = 0, totLNMin = 0
  let totBase = 0, totAllowance = 0, totFixed = 0, totOt = 0, totSchHoliday = 0
  let totLegalHoliday = 0, totLN = 0, totIncentive = 0, totCommuting = 0, totGross = 0
  let totHealth = 0, totNursing = 0, totPension = 0, totEmp = 0
  let totIncome = 0, totResident = 0, totOther = 0, totDeductions = 0, totNet = 0

  for (const entry of data.entries) {
    const [y, m] = entry.yearMonth.split('-')
    totWorkDays += entry.totalWorkDays
    totWorkedMin += entry.totalWorkedMinutes
    totOtMin += entry.totalOvertimeMinutes
    totHolidayMin += entry.totalHolidayMinutes
    totLNMin += entry.totalLateNightMinutes
    totBase += entry.baseSalary
    totAllowance += entry.allowanceTotal
    totFixed += entry.fixedOvertimeAllowance
    totOt += entry.overtimePay
    totSchHoliday += entry.scheduledHolidayPay
    totLegalHoliday += entry.legalHolidayPay
    totLN += entry.lateNightPay
    totIncentive += entry.incentivePay
    totCommuting += entry.commutingPay
    totGross += entry.grossPay
    totHealth += entry.healthInsurance
    totNursing += entry.nursingCareInsurance
    totPension += entry.welfarePension
    totEmp += entry.employmentInsurance
    totIncome += entry.incomeTax
    totResident += entry.residentTax
    totOther += entry.otherDeductions
    totDeductions += entry.totalDeductions
    totNet += entry.netPay

    rowsHtml += `
      <tr>
        <td class="period">${y}年${Number(m)}月</td>
        <td class="num">${entry.totalWorkDays}</td>
        <td class="num">${formatMinutes(entry.totalWorkedMinutes)}</td>
        <td class="num">${formatMinutes(entry.totalOvertimeMinutes)}</td>
        <td class="num">${formatMinutes(entry.totalHolidayMinutes)}</td>
        <td class="num">${formatMinutes(entry.totalLateNightMinutes)}</td>
        <td class="money">${fmt(entry.baseSalary)}</td>
        <td class="money">${fmt(entry.allowanceTotal)}</td>
        <td class="money">${fmt(entry.fixedOvertimeAllowance)}</td>
        <td class="money">${fmt(entry.overtimePay)}</td>
        <td class="money">${fmt(entry.scheduledHolidayPay)}</td>
        <td class="money">${fmt(entry.legalHolidayPay)}</td>
        <td class="money">${fmt(entry.lateNightPay)}</td>
        <td class="money">${fmt(entry.incentivePay)}</td>
        <td class="money">${fmt(entry.commutingPay)}</td>
        <td class="money total-col">${fmt(entry.grossPay)}</td>
        <td class="money">${fmt(entry.healthInsurance)}</td>
        <td class="money">${fmt(entry.nursingCareInsurance)}</td>
        <td class="money">${fmt(entry.welfarePension)}</td>
        <td class="money">${fmt(entry.employmentInsurance)}</td>
        <td class="money">${fmt(entry.incomeTax)}</td>
        <td class="money">${fmt(entry.residentTax)}</td>
        <td class="money">${fmt(entry.otherDeductions)}</td>
        <td class="money total-col">${fmt(entry.totalDeductions)}</td>
        <td class="money net-col">${fmt(entry.netPay)}</td>
      </tr>
    `
  }

  // 合計行
  rowsHtml += `
    <tr class="total-row">
      <td class="period">合　計</td>
      <td class="num">${totWorkDays}</td>
      <td class="num">${formatMinutes(totWorkedMin)}</td>
      <td class="num">${formatMinutes(totOtMin)}</td>
      <td class="num">${formatMinutes(totHolidayMin)}</td>
      <td class="num">${formatMinutes(totLNMin)}</td>
      <td class="money">${fmt(totBase)}</td>
      <td class="money">${fmt(totAllowance)}</td>
      <td class="money">${fmt(totFixed)}</td>
      <td class="money">${fmt(totOt)}</td>
      <td class="money">${fmt(totSchHoliday)}</td>
      <td class="money">${fmt(totLegalHoliday)}</td>
      <td class="money">${fmt(totLN)}</td>
      <td class="money">${fmt(totIncentive)}</td>
      <td class="money">${fmt(totCommuting)}</td>
      <td class="money total-col">${fmt(totGross)}</td>
      <td class="money">${fmt(totHealth)}</td>
      <td class="money">${fmt(totNursing)}</td>
      <td class="money">${fmt(totPension)}</td>
      <td class="money">${fmt(totEmp)}</td>
      <td class="money">${fmt(totIncome)}</td>
      <td class="money">${fmt(totResident)}</td>
      <td class="money">${fmt(totOther)}</td>
      <td class="money total-col">${fmt(totDeductions)}</td>
      <td class="money net-col">${fmt(totNet)}</td>
    </tr>
  `

  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Noto Sans JP', sans-serif;
      font-size: 8px;
      line-height: 1.3;
      padding: 8mm;
      background: white;
      color: #000;
    }
    .header {
      text-align: center;
      margin-bottom: 12px;
    }
    .header h1 {
      font-size: 18px;
      font-weight: bold;
      border: 2px solid #000;
      display: inline-block;
      padding: 6px 36px;
      letter-spacing: 8px;
    }
    .company-name {
      text-align: right;
      font-size: 10px;
      margin-bottom: 8px;
    }
    .info-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .info-table {
      border-collapse: collapse;
      border: 1.5px solid #000;
    }
    .info-table th, .info-table td {
      border: 1px solid #000;
      padding: 3px 8px;
      font-size: 9px;
    }
    .info-table th {
      background-color: #f0f0f0;
      font-weight: normal;
      white-space: nowrap;
    }
    .main-table {
      width: 100%;
      border-collapse: collapse;
      border: 2px solid #000;
    }
    .main-table th {
      background-color: #f0f0f0;
      border: 1px solid #000;
      padding: 2px 1px;
      text-align: center;
      font-weight: normal;
      font-size: 7px;
      white-space: nowrap;
    }
    .main-table td {
      border: 1px solid #000;
      padding: 3px 2px;
      height: 20px;
      font-size: 8px;
    }
    .main-table .period {
      text-align: center;
      white-space: nowrap;
    }
    .main-table .num {
      text-align: right;
      font-family: monospace;
      padding-right: 3px;
    }
    .main-table .money {
      text-align: right;
      font-family: monospace;
      padding-right: 3px;
    }
    .main-table .total-col {
      background-color: #fafafa;
      font-weight: bold;
    }
    .main-table .net-col {
      background-color: #f0f7ff;
      font-weight: bold;
    }
    .total-row {
      background-color: #f5f5f5;
      font-weight: bold;
    }
    .total-row td {
      border-top: 2px solid #000;
    }
    .category-header {
      text-align: center !important;
      background-color: #e0e0e0 !important;
      font-weight: bold !important;
      font-size: 8px !important;
    }
    .note {
      margin-top: 8px;
      font-size: 7px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="company-name">${COMPANY_NAME}</div>
  <div class="header">
    <h1>賃金台帳</h1>
  </div>

  <div class="info-section">
    <table class="info-table">
      <tr>
        <th>社員番号</th>
        <td>${data.employeeCode}</td>
        <th>氏　名</th>
        <td style="min-width: 120px;">${data.employeeName}</td>
      </tr>
      <tr>
        <th>部　署</th>
        <td colspan="3">${jobTitle}</td>
      </tr>
    </table>
  </div>

  <table class="main-table">
    <thead>
      <tr>
        <th rowspan="2" style="width: 58px;">賃金<br>計算期間</th>
        <th colspan="5" class="category-header">勤　怠</th>
        <th colspan="10" class="category-header">支　給</th>
        <th colspan="8" class="category-header">控　除</th>
        <th rowspan="2" style="width: 56px;">差引<br>支給額</th>
      </tr>
      <tr>
        <th>労働<br>日数</th>
        <th>労働<br>時間</th>
        <th>時間外</th>
        <th>休日</th>
        <th>深夜</th>
        <th>基本給</th>
        <th>諸手当</th>
        <th>固定残業</th>
        <th>時間外<br>手当</th>
        <th>所定休日</th>
        <th>法定休日</th>
        <th>深夜<br>手当</th>
        <th>インセン<br>ティブ</th>
        <th>通勤<br>手当</th>
        <th>総支給額</th>
        <th>健康<br>保険</th>
        <th>介護<br>保険</th>
        <th>厚生<br>年金</th>
        <th>雇用<br>保険</th>
        <th>所得税</th>
        <th>住民税</th>
        <th>その他</th>
        <th>控除<br>合計</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <p class="note">※ 本帳簿は労働基準法第108条および同法施行規則第54条に基づき作成しています。</p>
</body>
</html>
  `
}

export async function generateWageLedgerPdf(data: WageLedgerData): Promise<Buffer> {
  const html = generateWageLedgerHtml(data)
  const browser = await getBrowser()
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' },
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
