import Link from 'next/link'

export default function HomePage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-800">
            <div className="text-center text-white p-8">
                <h1 className="text-4xl md:text-5xl font-bold mb-4">
                    勤怠・給与管理システム
                </h1>
                <p className="text-lg md:text-xl text-primary-100 mb-12">
                    従業員の勤怠管理から給与計算まで一元管理
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link
                        href="/login"
                        className="btn btn-lg bg-white text-primary-700 hover:bg-primary-50"
                    >
                        ログイン
                    </Link>
                    <Link
                        href="/kiosk"
                        className="btn btn-lg bg-primary-500/30 text-white border-2 border-white/50 hover:bg-primary-500/50"
                    >
                        打刻画面
                    </Link>
                </div>
            </div>
        </div>
    )
}
