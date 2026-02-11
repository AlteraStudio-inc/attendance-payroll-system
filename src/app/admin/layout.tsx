'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

interface User {
    id: string
    employeeCode: string
    name: string
    role: 'EMPLOYEE' | 'ADMIN'
}

const navItems = [
    { href: '/admin/dashboard', label: 'ダッシュボード' },
    { href: '/admin/employees', label: '従業員管理' },
    { href: '/admin/attendance', label: '勤怠管理' },
    { href: '/admin/requests', label: '申請管理' },
    { href: '/admin/calendar', label: '営業カレンダー' },
    { href: '/admin/payroll', label: '給与管理' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const pathname = usePathname()
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const [sidebarOpen, setSidebarOpen] = useState(false)

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const res = await fetch('/api/auth/me')
                const data = await res.json()

                if (!res.ok || data.user?.role !== 'ADMIN') {
                    router.push('/login')
                    return
                }

                setUser(data.user)
            } catch {
                router.push('/login')
            } finally {
                setLoading(false)
            }
        }

        checkAuth()
    }, [router])

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        router.push('/login')
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="spinner w-12 h-12"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* サイドバー（モバイル用オーバーレイ） */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                ></div>
            )}

            {/* サイドバー */}
            <aside
                className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
                    }`}
            >
                <div className="flex flex-col h-full">
                    {/* ロゴ */}
                    <div className="p-6 border-b border-slate-200">
                        <h1 className="text-xl font-bold text-primary-700">勤怠管理</h1>
                        <p className="text-sm text-slate-500">管理者パネル</p>
                    </div>

                    {/* ナビゲーション */}
                    <nav className="flex-1 p-4 space-y-1">
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`nav-link ${pathname.startsWith(item.href) ? 'active' : ''}`}
                                onClick={() => setSidebarOpen(false)}
                            >
                                <span>{item.label}</span>
                            </Link>
                        ))}
                    </nav>

                    {/* ユーザー情報 */}
                    <div className="p-4 border-t border-slate-200">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold">
                                {user?.name.charAt(0)}
                            </div>
                            <div>
                                <p className="font-medium text-slate-800">{user?.name}</p>
                                <p className="text-sm text-slate-500">管理者</p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="w-full text-left text-sm text-slate-600 hover:text-red-600 transition-colors"
                        >
                            ログアウト
                        </button>
                    </div>
                </div>
            </aside>

            {/* メインコンテンツ */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* ヘッダー */}
                <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-4 lg:hidden">
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-2 rounded-lg hover:bg-slate-100"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    <h1 className="font-semibold text-slate-800">勤怠管理システム</h1>
                </header>

                {/* ページコンテンツ */}
                <main className="flex-1 p-4 lg:p-8 overflow-auto">
                    {children}
                </main>
            </div>
        </div>
    )
}
