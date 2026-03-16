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

export interface PayslipData {
  employeeCode: string
  employeeName: string
  jobType?: string // 職種 (CONSTRUCTION, NAIL, EYELASH, SUPPORT)
  yearMonth: string
  workHours: number
  overtimeHours: number
  holidayHours: number
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
}

// 給与明細HTMLテンプレート
function generatePayslipHtml(data: PayslipData): string {
  const formatCurrency = (amount: number) => amount === 0 ? '0' : amount.toLocaleString()
  const [year, month] = data.yearMonth.split('-')

  // 職種に応じた表示用部署名
  let jobTitle = '総務部・経理課'
  if (data.jobType === 'CONSTRUCTION') jobTitle = '建設部門'
  else if (data.jobType === 'NAIL') jobTitle = 'ネイルサロン部門'
  else if (data.jobType === 'EYELASH') jobTitle = 'アイラッシュ部門'
  else if (data.jobType === 'SUPPORT') jobTitle = '就労支援部門'

  const workDays = Math.ceil(data.workHours / 8) || 20

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
      font-size: 11px;
      line-height: 1.2;
      padding: 15mm;
      background: white;
      color: #000;
    }
    .company {
      text-align: right;
      margin-bottom: 20px;
      font-size: 12px;
    }
    .title-box {
      border: 2px solid #000;
      text-align: center;
      padding: 10px;
      font-size: 20px;
      font-weight: bold;
      width: 80%;
      margin: 0 auto 30px auto;
      background-color: #f0f7ff;
    }
    .info-container {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    .info-table {
      border-collapse: collapse;
      border: 2px solid #000;
    }
    .info-table th, .info-table td {
      border: 1px solid #000;
      padding: 5px 10px;
      text-align: center;
      height: 24px;
    }
    .info-table th {
      background-color: #f0f7ff;
      font-weight: normal;
    }
    .main-table {
      width: 100%;
      border-collapse: collapse;
      border: 2px solid #000;
      margin-bottom: 12px;
    }
    .main-table th, .main-table td {
      border: 1px solid #000;
      padding: 4px;
      text-align: right;
      height: 26px;
    }
    .main-table th {
      background-color: #f0f7ff;
      font-weight: normal;
      text-align: center;
    }
    .side-th {
      writing-mode: vertical-rl;
      text-orientation: upright;
      letter-spacing: 5px;
      width: 5%;
      text-align: center !important;
      padding: 10px 0 !important;
    }
    .col-header { width: 19%; }
  </style>
</head>
<body>
  <div class="company">${COMPANY_NAME}</div>
  <div class="title-box">給与明細書（${year}年${Number(month)}月分）</div>

  <div class="info-container">
    <table class="info-table" style="width: 45%;">
      <tr>
        <th style="width: 30%">部　署</th>
        <td style="text-align: left;">${jobTitle}</td>
      </tr>
      <tr>
        <th>氏　名</th>
        <td style="text-align: left;">${data.employeeName}　　様</td>
      </tr>
    </table>
    
    <table class="info-table" style="width: 40%;">
      <tr>
        <th style="width: 40%">給与支給日</th>
        <td>${year}年${Number(month)}月25日</td>
      </tr>
      <tr>
        <th>給与締日</th>
        <td>${year}年${Number(month)}月××日</td>
      </tr>
    </table>
  </div>

  <table class="main-table">
    <tr>
      <th rowspan="4" class="side-th">勤怠項目</th>
      <th class="col-header">出勤日数</th>
      <th class="col-header">休日出勤日数</th>
      <th class="col-header">有給日数</th>
      <th class="col-header">欠勤日数</th>
      <th class="col-header">遅刻・早退回数</th>
    </tr>
    <tr>
      <td>${workDays}</td>
      <td>0</td>
      <td>0</td>
      <td>0</td>
      <td>0</td>
    </tr>
    <tr>
      <th>所定労働時間</th>
      <th>時間外労働時間</th>
      <th>休日労働時間</th>
      <th>深夜時間</th>
      <th>遅刻・早退時間</th>
    </tr>
    <tr>
      <td>${data.workHours.toFixed(1)}</td>
      <td>${data.overtimeHours.toFixed(1)}</td>
      <td>${data.holidayHours.toFixed(1)}</td>
      <td>0.0</td>
      <td>0.0</td>
    </tr>
  </table>

  <table class="main-table">
    <tr>
      <th rowspan="8" class="side-th">支給項目</th>
      <th class="col-header">基本給</th>
      <th class="col-header">役職手当</th>
      <th class="col-header">資格手当</th>
      <th class="col-header"></th>
      <th class="col-header"></th>
    </tr>
    <tr>
      <td>${formatCurrency(data.baseSalary)}</td>
      <td>0</td>
      <td>0</td>
      <td></td>
      <td></td>
    </tr>
    <tr>
      <th>普通残業手当</th>
      <th>休日手当</th>
      <th>深夜手当</th>
      <th></th>
      <th></th>
    </tr>
    <tr>
      <td>${formatCurrency(data.overtimePay)}</td>
      <td>${formatCurrency(data.holidayPay)}</td>
      <td>0</td>
      <td></td>
      <td></td>
    </tr>
    <tr>
      <th>課税通勤手当</th>
      <th></th>
      <th></th>
      <th></th>
      <th></th>
    </tr>
    <tr>
      <td>0</td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
    </tr>
    <tr>
      <th>非課税通勤手当</th>
      <th></th>
      <th></th>
      <th></th>
      <th>支給額合計</th>
    </tr>
    <tr>
      <td>0</td>
      <td></td>
      <td></td>
      <td></td>
      <td>${formatCurrency(data.grossSalary)}</td>
    </tr>
  </table>

  <table class="main-table">
    <tr>
      <th rowspan="6" class="side-th">控除項目</th>
      <th class="col-header">健康保険</th>
      <th class="col-header">介護保険</th>
      <th class="col-header">厚生年金</th>
      <th class="col-header">雇用保険</th>
      <th class="col-header"></th>
    </tr>
    <tr>
      <td>${formatCurrency(Math.floor(data.socialInsurance * 0.4))}</td>
      <td>0</td>
      <td>${formatCurrency(Math.floor(data.socialInsurance * 0.6))}</td>
      <td>${formatCurrency(data.employmentInsurance)}</td>
      <td></td>
    </tr>
    <tr>
      <th>所得税</th>
      <th>住民税</th>
      <th></th>
      <th></th>
      <th></th>
    </tr>
    <tr>
      <td>${formatCurrency(data.incomeTax)}</td>
      <td>0</td>
      <td></td>
      <td></td>
      <td></td>
    </tr>
    <tr>
      <th style="border-bottom: none;"></th>
      <th style="border-bottom: none;"></th>
      <th style="border-bottom: none;"></th>
      <th style="border-bottom: none;"></th>
      <th>控除額合計</th>
    </tr>
    <tr>
      <td style="border-top: none;"></td>
      <td style="border-top: none;"></td>
      <td style="border-top: none;"></td>
      <td style="border-top: none;"></td>
      <td>${formatCurrency(data.totalDeductions)}</td>
    </tr>
  </table>

  <table class="main-table" style="margin-bottom: 20px;">
    <tr>
      <th rowspan="4" class="side-th">合計</th>
      <th style="width: 28%">社会保険合計</th>
      <th style="width: 28%">課税対象額</th>
      <th style="width: 13%"></th>
      <th style="width: 13%"></th>
      <th style="width: 13%"></th>
    </tr>
    <tr>
      <td>${formatCurrency(data.socialInsurance + data.employmentInsurance)}</td>
      <td>${formatCurrency(data.grossSalary)}</td>
      <td></td>
      <td></td>
      <td></td>
    </tr>
    <tr>
      <th style="border-bottom: none;"></th>
      <th style="border-bottom: none;"></th>
      <th>振込支給額</th>
      <th>現金支給額</th>
      <th>差引支給額</th>
    </tr>
    <tr>
      <td style="border-top: none;"></td>
      <td style="border-top: none;"></td>
      <td>${formatCurrency(data.netSalary)}</td>
      <td>0</td>
      <td>${formatCurrency(data.netSalary)}</td>
    </tr>
  </table>

  <table class="main-table">
    <tr>
      <th class="side-th" style="height: 80px;">備考欄</th>
      <td style="text-align: left; vertical-align: top; padding: 10px;">
        ${data.deemedOvertimePay > 0 ? 'みなし残業手当: ' + formatCurrency(data.deemedOvertimePay) : ''}
      </td>
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

  // 省略：ここでは実際のHTMLを組み立てる。労働基準法109条に則り、氏名、出勤・退勤日時、休憩時間、備考（note）などをリスト化する
  let rowsHtml = ''
  let totalWorkTime = 0
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
// シフト表PDF生成
// -------------------------------------------------------------
export async function generateShiftPdfData(shiftDataList: any[], yearMonth: string): Promise<Buffer> {
  const [year, month] = yearMonth.split('-')

  let htmlContent = ''
  shiftDataList.forEach(req => {
    let rowsHtml = ''
    req.shiftEntries.forEach((entry: any) => {
      const dateObj = new Date(entry.date)
      const dayStr = `${dateObj.getDate()}日`
      const typeStr = entry.isRest ? '<span style="color:red">公休</span>' : '出勤'
      const timeStr = entry.isRest ? '-' : `${entry.startTime || ''} 〜 ${entry.endTime || ''}`
      const noteStr = entry.note || ''

      rowsHtml += `<tr>
              <td>${dayStr}</td>
              <td>${typeStr}</td>
              <td>${timeStr}</td>
              <td>${noteStr}</td>
          </tr>`
    })

    htmlContent += `
        <div class="page-break">
            <h2>シフト表 ${year}年${month}月</h2>
            <h3>${req.employee.name} 様 (${req.employee.employeeCode})</h3>
            <table>
                <thead>
                    <tr>
                        <th>日付</th>
                        <th>区分</th>
                        <th>勤務時間</th>
                        <th>備考</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        </div>
      `
  })

  const html = `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap" rel="stylesheet">
        <style>
            body { font-family: 'Noto Sans JP', sans-serif; font-size: 12px; padding: 10mm; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 30px; }
            th, td { border: 1px solid #333; padding: 6px; text-align: left; }
            th { background-color: #f1f5f9; }
            h2, h3 { margin-bottom: 5px; }
            .page-break { page-break-after: always; }
        </style>
    </head>
    <body>
        ${htmlContent}
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
  workDays: number
  workHours: number
  overtimeHours: number
  holidayHours: number
  lateNightHours: number
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
}

export interface WageLedgerData {
  employeeCode: string
  employeeName: string
  jobType?: string
  entries: WageLedgerEntry[]
}

function generateWageLedgerHtml(data: WageLedgerData): string {
  const formatCurrency = (amount: number) => amount === 0 ? '0' : amount.toLocaleString()

  let jobTitle = ''
  if (data.jobType === 'CONSTRUCTION') jobTitle = '建設部門'
  else if (data.jobType === 'NAIL') jobTitle = 'ネイルサロン部門'
  else if (data.jobType === 'EYELASH') jobTitle = 'アイラッシュ部門'
  else if (data.jobType === 'SUPPORT') jobTitle = '就労支援部門'

  let rowsHtml = ''
  let totalWorkDays = 0, totalWorkHours = 0, totalOvertimeHours = 0
  let totalHolidayHours = 0, totalLateNightHours = 0
  let totalBaseSalary = 0, totalOvertimePay = 0, totalHolidayPay = 0
  let totalDeemedOvertimePay = 0, totalGrossSalary = 0
  let totalSocialInsurance = 0, totalEmploymentInsurance = 0
  let totalIncomeTax = 0, totalDeductions = 0, totalNetSalary = 0

  for (const entry of data.entries) {
    const [y, m] = entry.yearMonth.split('-')
    totalWorkDays += entry.workDays
    totalWorkHours += entry.workHours
    totalOvertimeHours += entry.overtimeHours
    totalHolidayHours += entry.holidayHours
    totalLateNightHours += entry.lateNightHours
    totalBaseSalary += entry.baseSalary
    totalOvertimePay += entry.overtimePay
    totalHolidayPay += entry.holidayPay
    totalDeemedOvertimePay += entry.deemedOvertimePay
    totalGrossSalary += entry.grossSalary
    totalSocialInsurance += entry.socialInsurance
    totalEmploymentInsurance += entry.employmentInsurance
    totalIncomeTax += entry.incomeTax
    totalDeductions += entry.totalDeductions
    totalNetSalary += entry.netSalary

    rowsHtml += `
      <tr>
        <td class="period">${y}年${Number(m)}月</td>
        <td class="num">${entry.workDays}</td>
        <td class="num">${entry.workHours.toFixed(1)}</td>
        <td class="num">${entry.overtimeHours.toFixed(1)}</td>
        <td class="num">${entry.holidayHours.toFixed(1)}</td>
        <td class="num">${entry.lateNightHours.toFixed(1)}</td>
        <td class="money">${formatCurrency(entry.baseSalary)}</td>
        <td class="money">${formatCurrency(entry.overtimePay)}</td>
        <td class="money">${formatCurrency(entry.holidayPay)}</td>
        <td class="money">${formatCurrency(entry.deemedOvertimePay)}</td>
        <td class="money total-col">${formatCurrency(entry.grossSalary)}</td>
        <td class="money">${formatCurrency(entry.socialInsurance)}</td>
        <td class="money">${formatCurrency(entry.employmentInsurance)}</td>
        <td class="money">${formatCurrency(entry.incomeTax)}</td>
        <td class="money total-col">${formatCurrency(entry.totalDeductions)}</td>
        <td class="money net-col">${formatCurrency(entry.netSalary)}</td>
      </tr>
    `
  }

  // 合計行
  rowsHtml += `
    <tr class="total-row">
      <td class="period">合　計</td>
      <td class="num">${totalWorkDays}</td>
      <td class="num">${totalWorkHours.toFixed(1)}</td>
      <td class="num">${totalOvertimeHours.toFixed(1)}</td>
      <td class="num">${totalHolidayHours.toFixed(1)}</td>
      <td class="num">${totalLateNightHours.toFixed(1)}</td>
      <td class="money">${formatCurrency(totalBaseSalary)}</td>
      <td class="money">${formatCurrency(totalOvertimePay)}</td>
      <td class="money">${formatCurrency(totalHolidayPay)}</td>
      <td class="money">${formatCurrency(totalDeemedOvertimePay)}</td>
      <td class="money total-col">${formatCurrency(totalGrossSalary)}</td>
      <td class="money">${formatCurrency(totalSocialInsurance)}</td>
      <td class="money">${formatCurrency(totalEmploymentInsurance)}</td>
      <td class="money">${formatCurrency(totalIncomeTax)}</td>
      <td class="money total-col">${formatCurrency(totalDeductions)}</td>
      <td class="money net-col">${formatCurrency(totalNetSalary)}</td>
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
      font-size: 9px;
      line-height: 1.3;
      padding: 10mm;
      background: white;
      color: #000;
    }
    .header {
      text-align: center;
      margin-bottom: 15px;
    }
    .header h1 {
      font-size: 20px;
      font-weight: bold;
      border: 2px solid #000;
      display: inline-block;
      padding: 8px 40px;
      letter-spacing: 8px;
    }
    .company-name {
      text-align: right;
      font-size: 11px;
      margin-bottom: 10px;
    }
    .info-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 15px;
    }
    .info-table {
      border-collapse: collapse;
      border: 1.5px solid #000;
    }
    .info-table th, .info-table td {
      border: 1px solid #000;
      padding: 4px 10px;
      font-size: 10px;
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
      padding: 3px 2px;
      text-align: center;
      font-weight: normal;
      font-size: 8px;
      white-space: nowrap;
    }
    .main-table td {
      border: 1px solid #000;
      padding: 4px 3px;
      height: 22px;
      font-size: 9px;
    }
    .main-table .period {
      text-align: center;
      white-space: nowrap;
      font-size: 9px;
    }
    .main-table .num {
      text-align: right;
      font-family: monospace;
      padding-right: 5px;
    }
    .main-table .money {
      text-align: right;
      font-family: monospace;
      padding-right: 5px;
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
      background-color: #e8e8e8 !important;
      font-weight: bold !important;
      font-size: 9px !important;
    }
    .note {
      margin-top: 10px;
      font-size: 8px;
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
        <th rowspan="2" style="width: 70px;">賃金<br>計算期間</th>
        <th colspan="5" class="category-header">勤　怠</th>
        <th colspan="5" class="category-header">支　給</th>
        <th colspan="4" class="category-header">控　除</th>
        <th rowspan="2" style="width: 70px;">差引<br>支給額</th>
      </tr>
      <tr>
        <th>労働<br>日数</th>
        <th>労働<br>時間数</th>
        <th>時間外<br>労働</th>
        <th>休日<br>労働</th>
        <th>深夜<br>労働</th>
        <th>基本給</th>
        <th>時間外<br>手当</th>
        <th>休日<br>手当</th>
        <th>みなし<br>残業</th>
        <th>総支給額</th>
        <th>社会<br>保険料</th>
        <th>雇用<br>保険料</th>
        <th>所得税</th>
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

// -------------------------------------------------------------
// 月次カレンダー形式シフト表PDF一括出力 (マトリックス形式)
// -------------------------------------------------------------
export async function generateMonthlyShiftMatrixPdfData(yearMonth: string, shiftRequests: any[]): Promise<Buffer> {
  const [year, month] = yearMonth.split('-')
  const startDate = new Date(Number(year), Number(month) - 1, 1)
  const endDate = new Date(Number(year), Number(month), 0)
  const daysInMonth = endDate.getDate()

  // ヘッダー行（日付）の生成
  let headerHtml = '<th class="name-header">氏名</th>'
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(Number(year), Number(month) - 1, i)
    const dayNames = ['日', '月', '火', '水', '木', '金', '土']
    const dayOfWeek = dayNames[d.getDay()]
    const color = d.getDay() === 0 ? 'color: #dc2626;' : d.getDay() === 6 ? 'color: #2563eb;' : ''
    headerHtml += `<th style="${color}">${i}<br><span style="font-size: 8px;">(${dayOfWeek})</span></th>`
  }

  // データ行の生成
  let rowsHtml = ''
  shiftRequests.forEach(req => {
    // 日付ごとのシフトをマッピング
    const entryMap = new Map()
    req.shiftEntries.forEach((entry: any) => {
      const dateStr = format(new Date(entry.date), 'yyyy-MM-dd')
      entryMap.set(dateStr, entry)
    })

    rowsHtml += `<tr><td class="name-cell">${req.employee.name}</td>`

    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(Number(year), Number(month) - 1, i)
      const dateStr = format(d, 'yyyy-MM-dd')
      const entry = entryMap.get(dateStr)
      let cellText = ''
      let isRest = false
      if (entry) {
        if (entry.isRest) {
          cellText = '休'
          isRest = true
        } else if (entry.startTime && entry.endTime) {
          const s = format(new Date(entry.startTime), 'HH:mm')
          const e = format(new Date(entry.endTime), 'HH:mm')
          cellText = `${s}<br>|<br>${e}`
        }
      }

      const bgColor = isRest ? 'background-color: #fee2e2;' : ''
      const textColor = isRest ? 'color: #dc2626;' : ''
      rowsHtml += `<td style="${bgColor} ${textColor}">${cellText}</td>`
    }
    rowsHtml += '</tr>'
  })

  // 申請がない場合のメッセージ
  if (shiftRequests.length === 0) {
    rowsHtml = `<tr><td colspan="${daysInMonth + 1}" style="text-align: center; padding: 20px;">この月の確定済みシフト申請はありません。</td></tr>`
  }

  const html = `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap" rel="stylesheet">
        <style>
            body { font-family: 'Noto Sans JP', sans-serif; font-size: 10px; padding: 5mm; }
            h2 { text-align: center; margin-bottom: 20px; font-size: 18px; color: #1e293b; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            th, td { border: 1px solid #94a3b8; text-align: center; word-wrap: break-word; vertical-align: middle; }
            th { background-color: #f1f5f9; padding: 4px 2px; font-weight: normal; font-size: 9px; }
            .name-header { width: 80px; font-size: 11px; font-weight: bold; }
            td { height: 40px; padding: 2px; font-size: 8px; line-height: 1.2; }
            .name-cell { font-size: 11px; font-weight: bold; text-align: left; padding-left: 8px; }
        </style>
    </head>
    <body>
        <h2>シフト管理表（月別） ${year}年${month}月</h2>
        <table>
            <thead>
                <tr>
                    ${headerHtml}
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
    // A4横向きに設定
    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' }
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
