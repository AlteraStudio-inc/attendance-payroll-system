import { redirect } from 'next/navigation'

export default function HomePage() {
    // 独立したURL（/login または /kiosk）でのアクセスを促すため、
    // ルートページは管理者/従業員向けの /login へリダイレクトします。
    redirect('/login')
}
