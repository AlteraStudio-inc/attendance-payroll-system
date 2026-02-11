import puppeteer from 'puppeteer'
import * as fs from 'fs/promises'
import * as path from 'path'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

const COMPANY_NAME = process.env.COMPANY_NAME || '株式会社サンプル'
const STORAGE_PATH = process.env.PAYSLIP_STORAGE_PATH || './data/payslips'

export interface PayslipData {
    employeeCode: string
    employeeName: string
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
    const formatCurrency = (amount: number) => '¥' + amount.toLocaleString()
    const [year, month] = data.yearMonth.split('-')
    const issueDate = format(new Date(), 'yyyy年M月d日', { locale: ja })

    return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', Meiryo, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      padding: 20mm;
      background: white;
    }
    .container {
      max-width: 170mm;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 2px solid #2563eb;
    }
    .header h1 {
      font-size: 24px;
      color: #1e40af;
      margin-bottom: 5px;
    }
    .header .period {
      font-size: 18px;
      font-weight: bold;
    }
    .meta {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    .meta-item {
      font-size: 14px;
    }
    .meta-item .label {
      color: #666;
      font-size: 11px;
    }
    .meta-item .value {
      font-weight: bold;
    }
    .section {
      margin-bottom: 20px;
    }
    .section-title {
      background: #2563eb;
      color: white;
      padding: 8px 12px;
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    table th, table td {
      padding: 8px 12px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    table th {
      background: #f1f5f9;
      font-weight: normal;
      width: 40%;
    }
    table td {
      text-align: right;
      font-weight: bold;
    }
    .summary {
      margin-top: 30px;
      padding: 20px;
      background: #f8fafc;
      border: 2px solid #2563eb;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #e2e8f0;
    }
    .summary-row:last-child {
      border-bottom: none;
    }
    .summary-row.total {
      font-size: 18px;
      font-weight: bold;
      color: #2563eb;
      padding-top: 15px;
    }
    .footer {
      margin-top: 30px;
      text-align: right;
      font-size: 11px;
      color: #666;
    }
    .company {
      font-size: 14px;
      font-weight: bold;
      color: #333;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>給 与 明 細 書</h1>
      <div class="period">${year}年${month}月分</div>
    </div>

    <div class="meta">
      <div class="meta-item">
        <div class="label">従業員コード</div>
        <div class="value">${data.employeeCode}</div>
      </div>
      <div class="meta-item">
        <div class="label">氏名</div>
        <div class="value">${data.employeeName} 様</div>
      </div>
      <div class="meta-item">
        <div class="label">発行日</div>
        <div class="value">${issueDate}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">勤務情報</div>
      <table>
        <tr>
          <th>通常勤務時間</th>
          <td>${data.workHours.toFixed(1)} 時間</td>
        </tr>
        <tr>
          <th>残業時間</th>
          <td>${data.overtimeHours.toFixed(1)} 時間</td>
        </tr>
        <tr>
          <th>休日出勤時間</th>
          <td>${data.holidayHours.toFixed(1)} 時間</td>
        </tr>
      </table>
    </div>

    <div class="section">
      <div class="section-title">支給</div>
      <table>
        <tr>
          <th>基本給</th>
          <td>${formatCurrency(data.baseSalary)}</td>
        </tr>
        <tr>
          <th>残業手当</th>
          <td>${formatCurrency(data.overtimePay)}</td>
        </tr>
        ${data.deemedOvertimePay > 0 ? `
        <tr>
          <th>みなし残業手当</th>
          <td>${formatCurrency(data.deemedOvertimePay)}</td>
        </tr>
        ` : ''}
        <tr>
          <th>休日出勤手当</th>
          <td>${formatCurrency(data.holidayPay)}</td>
        </tr>
        <tr style="background:#e0f2fe;">
          <th style="font-weight:bold;">総支給額</th>
          <td style="font-weight:bold;color:#2563eb;">${formatCurrency(data.grossSalary)}</td>
        </tr>
      </table>
    </div>

    <div class="section">
      <div class="section-title">控除</div>
      <table>
        <tr>
          <th>社会保険料</th>
          <td>${formatCurrency(data.socialInsurance)}</td>
        </tr>
        <tr>
          <th>雇用保険料</th>
          <td>${formatCurrency(data.employmentInsurance)}</td>
        </tr>
        <tr>
          <th>所得税</th>
          <td>${formatCurrency(data.incomeTax)}</td>
        </tr>
        <tr style="background:#fef2f2;">
          <th style="font-weight:bold;">控除合計</th>
          <td style="font-weight:bold;color:#dc2626;">${formatCurrency(data.totalDeductions)}</td>
        </tr>
      </table>
    </div>

    <div class="summary">
      <div class="summary-row">
        <span>総支給額</span>
        <span>${formatCurrency(data.grossSalary)}</span>
      </div>
      <div class="summary-row">
        <span>控除合計</span>
        <span>- ${formatCurrency(data.totalDeductions)}</span>
      </div>
      <div class="summary-row total">
        <span>差引支給額</span>
        <span>${formatCurrency(data.netSalary)}</span>
      </div>
    </div>

    <div class="footer">
      <div class="company">${COMPANY_NAME}</div>
      <div>この明細書は電子的に発行されたものです</div>
    </div>
  </div>
</body>
</html>
  `
}

// PDFを生成
export async function generatePayslipPdf(data: PayslipData): Promise<Buffer> {
    const html = generatePayslipHtml(data)

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

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
