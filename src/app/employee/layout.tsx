'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

interface User {
    id: string
    employeeId: string
    employeeCode: string
    name: string
    email: string
    role: 'admin' | 'employee'
    departmentId: string | null
    companyId: string
}

const navItems = [
    { href: '/employee/dashboard', label: 'ホーム' },
    { href: '/employee/attendance', label: '勤怠' },
    { href: '/employee/requests', label: '申請' },
    { href: '/employee/payslips', label: '給与' },
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

                if (!res.ok || !data.success) {
                    router.push('/login')
                    return
                }

                const u = data.user
                if (u.role !== 'employee') {
                    router.push('/admin/dashboard')
                    return
                }

                setUser(u)
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
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* ヘッダー */}
            <header className="bg-blue-600 text-white px-4 py-3 sticky top-0 z-40 shadow-md">
                <div className="max-w-lg mx-auto flex items-center justify-between">
                    <h1 className="font-bold text-lg">勤怠管理</h1>
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-blue-100">{user?.name}</span>
                        <button
                            onClick={handleLogout}
                            className="text-sm text-blue-200 hover:text-white transition-colors"
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

            {/* ボトムナビゲーション */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 shadow-lg">
                <div className="max-w-lg mx-auto flex">
                    {navItems.map((item) => {
                        const active = pathname.startsWith(item.href)
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex-1 flex flex-col items-center py-3 text-xs font-medium transition-colors ${
                                    active
                                        ? 'text-blue-600'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                <span className={`text-base mb-0.5 ${active ? 'text-blue-600' : 'text-slate-400'}`}>
                                    {item.href.includes('dashboard') ? '🏠' :
                                     item.href.includes('attendance') ? '📋' :
                                     item.href.includes('requests') ? '📝' : '💴'}
                                </span>
                                <span>{item.label}</span>
                            </Link>
                        )
                    })}
                </div>
            </nav>
        </div>
    )
}
