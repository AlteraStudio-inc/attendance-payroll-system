'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

interface User {
    id: string
    employeeCode?: string
    name: string
    role: 'admin' | 'employee'
    companyId?: string
    departmentId?: string
}

const navItems = [
    { href: '/admin/dashboard', label: 'ダッシュボード', icon: '📊' },
    { href: '/admin/employees', label: '従業員管理', icon: '👥' },
    { href: '/admin/departments', label: '部門管理', icon: '🏢' },
    { href: '/admin/attendance', label: '勤怠管理', icon: '🕐' },
    { href: '/admin/payroll', label: '給与管理', icon: '💴' },
    { href: '/admin/allowance-types', label: '手当種別', icon: '📋' },
    { href: '/admin/work-schedules', label: '勤務カレンダー', icon: '📅' },
    { href: '/admin/statutory-rates', label: '法定控除率', icon: '⚖️' },
    { href: '/admin/audit-logs', label: '監査ログ', icon: '🔍' },
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
                const res = await fetch('/api/auth/me', { credentials: 'include' })
                const data = await res.json()

                const authUser = data.data || data.user
                if (!res.ok || authUser?.role !== 'admin') {
                    router.push('/login')
                    return
                }

                setUser(authUser)
            } catch {
                router.push('/login')
            } finally {
                setLoading(false)
            }
        }

        checkAuth()
    }, [router])

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
        router.push('/login')
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-500">読み込み中...</p>
                </div>
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
                className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transform transition-transform duration-300 flex flex-col ${
                    sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
                }`}
            >
                {/* ロゴ */}
                <div className="p-5 border-b border-slate-200 bg-blue-600">
                    <h1 className="text-lg font-bold text-white">勤怠・給与管理</h1>
                    <p className="text-xs text-blue-200 mt-0.5">管理者パネル</p>
                </div>

                {/* ナビゲーション */}
                <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
                    {navItems.map((item) => {
                        const isActive = pathname.startsWith(item.href)
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setSidebarOpen(false)}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                                    isActive
                                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                                }`}
                            >
                                <span className="text-base">{item.icon}</span>
                                <span>{item.label}</span>
                            </Link>
                        )
                    })}
                </nav>

                {/* ユーザー情報 */}
                <div className="p-4 border-t border-slate-200">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
                            {user?.name?.charAt(0) ?? 'A'}
                        </div>
                        <div className="min-w-0">
                            <p className="font-medium text-slate-800 text-sm truncate">{user?.name}</p>
                            <p className="text-xs text-slate-500">管理者</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full text-left text-sm text-slate-500 hover:text-red-600 transition-colors px-1"
                    >
                        ログアウト →
                    </button>
                </div>
            </aside>

            {/* メインコンテンツ */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* ヘッダー（モバイル用） */}
                <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-4 lg:hidden sticky top-0 z-30">
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-2 rounded-lg hover:bg-slate-100"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    <h1 className="font-semibold text-slate-800">勤怠・給与管理システム</h1>
                </header>

                {/* ページコンテンツ */}
                <main className="flex-1 p-4 lg:p-8 overflow-auto">
                    {children}
                </main>
            </div>
        </div>
    )
}
