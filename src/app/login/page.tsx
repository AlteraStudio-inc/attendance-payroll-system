'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
    const router = useRouter()
    const [employeeCode, setEmployeeCode] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    employeeCode,
                    password,
                    loginType: 'password',
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'ログインに失敗しました')
            }

            // ロールに応じてリダイレクト
            if (data.user.role === 'ADMIN') {
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
        <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
            <div className="max-w-md w-full">

                {/* ログインカード */}
                <div className="bg-white rounded-2xl shadow-md p-8 border border-slate-200">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-slate-800">ログイン</h1>
                        <p className="text-slate-500 mt-1 text-sm">管理画面・マイページにアクセス</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="alert alert-error">
                                {error}
                            </div>
                        )}

                        <div>
                            <label htmlFor="employeeCode" className="block text-sm font-medium text-slate-700 mb-1">
                                従業員コード
                            </label>
                            <input
                                id="employeeCode"
                                type="text"
                                value={employeeCode}
                                onChange={(e) => setEmployeeCode(e.target.value)}
                                className="input"
                                placeholder="例: ADMIN001"
                                required
                                autoComplete="username"
                                autoFocus
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                                パスワード
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="input"
                                placeholder="パスワードを入力"
                                required
                                autoComplete="current-password"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn btn-primary w-full py-3"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="spinner w-5 h-5"></span>
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
    )
}
