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
    { href: '/employee/dashboard', label: 'ホーム' },
    { href: '/employee/shifts', label: 'シフト希望' },
    { href: '/employee/attendance', label: '勤怠履歴' },
    { href: '/employee/requests', label: '申請' },
    { href: '/employee/payslips', label: '給与明細' },
    { href: '/employee/profile', label: '設定' },
]

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const pathname = usePathname()
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const res = await fetch('/api/auth/me')
                const data = await res.json()

                if (!res.ok) {
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
        <div className="min-h-screen bg-slate-50">
            {/* ヘッダー */}
            <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-40">
                <div className="max-w-lg mx-auto flex items-center justify-between">
                    <h1 className="font-bold text-primary-700">勤怠管理</h1>
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-600">{user?.name}</span>
                        <button
                            onClick={handleLogout}
                            className="text-sm text-slate-500 hover:text-red-600"
                        >
                            ログアウト
                        </button>
                    </div>
                </div>
            </header>

            {/* メインコンテンツ */}
            <main className="max-w-lg mx-auto p-4 pb-24">
                {children}
            </main>

            {/* ナビゲーション */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40">
                <div className="max-w-lg mx-auto flex">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex-1 flex flex-col items-center py-3 text-xs transition-colors ${pathname.startsWith(item.href)
                                ? 'text-primary-600'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <span>{item.label}</span>
                        </Link>
                    ))}
                </div>
            </nav>
        </div>
    )
}
