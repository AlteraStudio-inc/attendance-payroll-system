'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
    const router = useRouter()
    const [employeeCode, setEmployeeCode] = useState('')
    const [password, setPassword] = useState('')
    const [loginType, setLoginType] = useState<'password' | 'pin'>('password')
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
                    loginType,
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
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-800 p-4">
            <div className="card max-w-md w-full">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-slate-800">ログイン</h1>
                    <p className="text-slate-500 mt-2">勤怠・給与管理システム</p>
                </div>

                {/* ログインタイプ切り替え */}
                <div className="flex mb-6 bg-slate-100 rounded-lg p-1">
                    <button
                        type="button"
                        onClick={() => setLoginType('password')}
                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${loginType === 'password'
                                ? 'bg-white text-primary-700 shadow-sm'
                                : 'text-slate-600 hover:text-slate-800'
                            }`}
                    >
                        パスワード
                    </button>
                    <button
                        type="button"
                        onClick={() => setLoginType('pin')}
                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${loginType === 'pin'
                                ? 'bg-white text-primary-700 shadow-sm'
                                : 'text-slate-600 hover:text-slate-800'
                            }`}
                    >
                        PIN
                    </button>
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
                            placeholder="例: EMP001"
                            required
                            autoComplete="username"
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                            {loginType === 'password' ? 'パスワード' : 'PIN'}
                        </label>
                        <input
                            id="password"
                            type={loginType === 'pin' ? 'tel' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="input"
                            placeholder={loginType === 'pin' ? '4桁のPIN' : 'パスワード'}
                            required
                            autoComplete={loginType === 'pin' ? 'one-time-code' : 'current-password'}
                            pattern={loginType === 'pin' ? '[0-9]{4,6}' : undefined}
                            inputMode={loginType === 'pin' ? 'numeric' : undefined}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-primary w-full"
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

                <div className="mt-6 text-center">
                    <a href="/kiosk" className="text-primary-600 hover:text-primary-700 text-sm">
                        打刻専用画面へ →
                    </a>
                </div>
            </div>
        </div>
    )
}
