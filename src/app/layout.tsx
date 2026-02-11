import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
    title: '勤怠・給与管理システム',
    description: '従業員の勤怠管理、給与計算、各種申請を一元管理するシステム',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="ja">
            <body className="min-h-screen bg-slate-50">
                {children}
            </body>
        </html>
    )
}
