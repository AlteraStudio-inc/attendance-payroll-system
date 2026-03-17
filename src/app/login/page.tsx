'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Tab = 'admin' | 'employee'

export default function LoginPage() {
    const router = useRouter()
    const [tab, setTab] = useState<Tab>('employee')

    // 管理者
    const [adminEmail, setAdminEmail] = useState('')
    const [adminPassword, setAdminPassword] = useState('')

    // 従業員
    const [employeeCode, setEmployeeCode] = useState('')
    const [employeePassword, setEmployeePassword] = useState('')

    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const body =
                tab === 'admin'
                    ? { email: adminEmail, password: adminPassword }
                    : { employeeCode, password: employeePassword }

            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })

            const data = await res.json()

            if (!res.ok || !data.success) {
                throw new Error(data.error || 'ログインに失敗しました')
            }

            const role = data.user?.role
            if (role === 'admin') {
                router.push('/admin/dashboard')
            } else {
                router.push('/employee/dashboard')
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'ログインに失敗しました')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 p-4">
            <div className="max-w-md w-full">
                {/* ロゴ */}
                <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800">勤怠管理システム</h1>
                </div>

                <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
                    {/* タブ */}
                    <div className="flex border-b border-slate-200">
                        <button
                            onClick={() => { setTab('employee'); setError('') }}
                            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                                tab === 'employee'
                                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                            }`}
                        >
                            従業員
                        </button>
                        <button
                            onClick={() => { setTab('admin'); setError('') }}
                            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                                tab === 'admin'
                                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                            }`}
                        >
                            管理者
                        </button>
                    </div>

                    <div className="p-6">
                        {error && (
                            <div className="mb-4 bg-red-100 border border-red-200 text-red-800 rounded-lg px-4 py-3 text-sm">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {tab === 'employee' ? (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            従業員コード
                                        </label>
                                        <input
                                            type="text"
                                            value={employeeCode}
                                            onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())}
                                            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="例: EMP001"
                                            required
                                            autoFocus
                                            autoComplete="username"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            パスワード / PIN
                                        </label>
                                        <input
                                            type="password"
                                            value={employeePassword}
                                            onChange={(e) => setEmployeePassword(e.target.value)}
                                            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="パスワードまたはPINを入力"
                                            required
                                            autoComplete="current-password"
                                        />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            メールアドレス
                                        </label>
                                        <input
                                            type="email"
                                            value={adminEmail}
                                            onChange={(e) => setAdminEmail(e.target.value)}
                                            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="admin@example.com"
                                            required
                                            autoFocus
                                            autoComplete="email"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            パスワード
                                        </label>
                                        <input
                                            type="password"
                                            value={adminPassword}
                                            onChange={(e) => setAdminPassword(e.target.value)}
                                            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="パスワードを入力"
                                            required
                                            autoComplete="current-password"
                                        />
                                    </div>
                                </>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm mt-2"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                        ログイン中...
                                    </span>
                                ) : (
                                    'ログイン'
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    )
}
