import nodemailer from 'nodemailer'
import { prisma } from './prisma'

// SMTP設定
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.example.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
})

const FROM_ADDRESS = process.env.SMTP_FROM || 'noreply@example.com'
const COMPANY_NAME = process.env.COMPANY_NAME || '株式会社サンプル'

export interface SendPayslipEmailParams {
    employeeId: string
    employeeEmail: string
    employeeName: string
    yearMonth: string
    pdfBuffer: Buffer
    pdfFilename: string
}

// 給与明細メールを送信
export async function sendPayslipEmail(params: SendPayslipEmailParams): Promise<void> {
    const { employeeId, employeeEmail, employeeName, yearMonth, pdfBuffer, pdfFilename } = params

    const [year, month] = yearMonth.split('-')
    const subject = `【${COMPANY_NAME}】${year}年${month}月分 給与明細のお知らせ`

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f8fafc; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${COMPANY_NAME}</h1>
    </div>
    <div class="content">
      <p>${employeeName} 様</p>
      <p>いつもお勤めいただきありがとうございます。</p>
      <p>${year}年${month}月分の給与明細を添付いたします。</p>
      <p>ご確認くださいますようお願いいたします。</p>
      <br>
      <p>※ 本メールは自動送信されています。</p>
      <p>※ ご不明な点がございましたら、経理担当までお問い合わせください。</p>
    </div>
    <div class="footer">
      <p>${COMPANY_NAME}</p>
    </div>
  </div>
</body>
</html>
  `

    const textContent = `
${employeeName} 様

いつもお勤めいただきありがとうございます。

${year}年${month}月分の給与明細を添付いたします。
ご確認くださいますようお願いいたします。

※ 本メールは自動送信されています。
※ ご不明な点がございましたら、経理担当までお問い合わせください。

${COMPANY_NAME}
  `

    await transporter.sendMail({
        from: FROM_ADDRESS,
        to: employeeEmail,
        subject,
        text: textContent,
        html: htmlContent,
        attachments: [
            {
                filename: pdfFilename,
                content: pdfBuffer,
                contentType: 'application/pdf',
            },
        ],
    })
}

// メールログを作成
export async function createEmailLog(
    payrollItemId: string,
    employeeId: string
): Promise<string> {
    const log = await prisma.emailLog.create({
        data: {
            payrollItemId,
            employeeId,
            status: 'PENDING',
        },
    })
    return log.id
}

// メールログを更新（送信成功）
export async function markEmailSent(logId: string): Promise<void> {
    await prisma.emailLog.update({
        where: { id: logId },
        data: {
            status: 'SENT',
            sentAt: new Date(),
        },
    })
}

// メールログを更新（送信失敗）
export async function markEmailFailed(logId: string, errorMessage: string): Promise<void> {
    const log = await prisma.emailLog.findUnique({ where: { id: logId } })

    await prisma.emailLog.update({
        where: { id: logId },
        data: {
            status: 'FAILED',
            errorMessage,
            retryCount: (log?.retryCount ?? 0) + 1,
        },
    })
}

// 未送信・失敗のメールを取得
export async function getPendingEmails() {
    return prisma.emailLog.findMany({
        where: {
            OR: [
                { status: 'PENDING' },
                { status: 'FAILED', retryCount: { lt: 3 } },
            ],
        },
        include: {
            payrollItem: {
                include: {
                    employee: true,
                    payrollRun: true,
                },
            },
            employee: true,
        },
    })
}
