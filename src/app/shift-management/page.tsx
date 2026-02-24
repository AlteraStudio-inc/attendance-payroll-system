'use client'

import { useState, useEffect } from 'react'
import { format, addMonths } from 'date-fns'
import { ja } from 'date-fns/locale'

interface Employee {
    id: string
    employeeCode: string
    name: string
    jobType: string
}

interface ShiftRequest {
    id: string
    yearMonth: string
    status: string
    employee: Employee
    shiftEntries: {
        date: string
        startTime: string | null
        endTime: string | null
        isRest: boolean
        isConfirmed: boolean
        note: string | null
    }[]
}

export default function AdminShiftsPage() {
    // Auth state
    const [isLoggedIn, setIsLoggedIn] = useState(false)
    const [employeeCode, setEmployeeCode] = useState('')
    const [password, setPassword] = useState('')
    const [authLoading, setAuthLoading] = useState(false)
    const [authError, setAuthError] = useState('')

    // Date state
    const [targetYearMonth, setTargetYearMonth] = useState('')
    const [requests, setRequests] = useState<ShiftRequest[]>([])
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [processingId, setProcessingId] = useState<string | null>(null)

    useEffect(() => {
        const checkAuth = async () => {
            try {
                // Use the user fetch endpoint to check auth
                const res = await fetch('/api/auth/me')
                const data = await res.json()
                if (res.ok && data.user?.role === 'ADMIN') {
                    setIsLoggedIn(true)
                }
            } catch (error) {
                console.error('Auth check error', error)
            }
        }
        checkAuth()

        const nextMonth = addMonths(new Date(), 1)
        setTargetYearMonth(format(nextMonth, 'yyyy-MM'))
    }, [])

    useEffect(() => {
        if (targetYearMonth && isLoggedIn) {
            fetchRequests()
        }
    }, [targetYearMonth, isLoggedIn])

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setAuthError('')
        setAuthLoading(true)

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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

            if (data.user?.role !== 'ADMIN') {
                await fetch('/api/auth/logout', { method: 'POST' })
                throw new Error('管理者権限がありません')
            }

            setIsLoggedIn(true)
        } catch (err) {
            setAuthError(err instanceof Error ? err.message : 'ログインに失敗しました')
        } finally {
            setAuthLoading(false)
        }
    }

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        setIsLoggedIn(false)
        setEmployeeCode('')
        setPassword('')
        setRequests([])
    }

    const fetchRequests = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/shifts/requests?yearMonth=${targetYearMonth}`)
            if (res.ok) {
                const data = await res.json()
                setRequests(data)
            }
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const handleConfirm = async (requestId: string) => {
        setProcessingId(requestId)
        setMessage(null)
        try {
            const res = await fetch(`/api/shifts/requests/${requestId}/confirm`, {
                method: 'POST'
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || '承認に失敗しました')
            }
            setMessage({ type: 'success', text: 'シフトを承認・確定しました' })
            fetchRequests()
        } catch (error) {
            setMessage({ type: 'error', text: error instanceof Error ? error.message : '承認エラー' })
        } finally {
            setProcessingId(null)
        }
    }

    const handleSendPdf = async (requestId: string) => {
        setProcessingId(requestId + '_pdf')
        setMessage(null)
        try {
            const res = await fetch(`/api/shifts/requests/${requestId}/send-pdf`, {
                method: 'POST'
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || '送信に失敗しました')
            }
            setMessage({ type: 'success', text: 'シフト表をメールで送信しました' })
        } catch (error) {
            setMessage({ type: 'error', text: error instanceof Error ? error.message : '送信エラー' })
        } finally {
            setProcessingId(null)
        }
    }

    if (!isLoggedIn) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
                <div className="max-w-sm w-full bg-white rounded-2xl shadow-md p-8 border border-slate-200">
                    <h1 className="text-2xl font-bold text-center text-slate-800 mb-6">シフト管理ログイン</h1>
                    <form onSubmit={handleLogin} className="space-y-4">
                        {authError && (
                            <div className="alert alert-error text-sm py-2">{authError}</div>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">管理者ID</label>
                            <input
                                type="text"
                                value={employeeCode}
                                onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())}
                                className="input"
                                placeholder="例: ADM001"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">パスワード</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="input"
                                placeholder="パスワード"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={authLoading}
                            className="btn btn-primary w-full mt-4"
                        >
                            {authLoading ? 'ログイン中...' : 'ログイン'}
                        </button>
                    </form>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <h1 className="text-xl font-bold text-slate-800">月次シフト管理 (管理者用)</h1>
                    <button onClick={handleLogout} className="text-sm text-slate-500 hover:text-slate-800 font-medium">
                        ログアウト
                    </button>
                </div>

                {message && (
                    <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
                        {message.text}
                    </div>
                )}

                <div className="card">
                    <div className="flex gap-4 mb-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">対象年月</label>
                            <input
                                type="month"
                                value={targetYearMonth}
                                onChange={(e) => setTargetYearMonth(e.target.value)}
                                className="input"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-y border-slate-200 text-sm font-medium text-slate-500">
                                    <th className="p-4">従業員</th>
                                    <th className="p-4">職種</th>
                                    <th className="p-4">ステータス</th>
                                    <th className="p-4">提出日</th>
                                    <th className="p-4">アクション</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-slate-500">読み込み中...</td>
                                    </tr>
                                ) : requests.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-slate-500">
                                            該当年月のシフト申請はありません
                                        </td>
                                    </tr>
                                ) : (
                                    requests.map(req => {
                                        // 提出日は実際のテーブルに createdAt などがあればそれを使う。ここではダミー対応や省略可
                                        return (
                                            <tr key={req.id} className="hover:bg-slate-50">
                                                <td className="p-4 font-medium text-slate-800">
                                                    {req.employee.name} ({req.employee.employeeCode})
                                                </td>
                                                <td className="p-4">
                                                    {req.employee.jobType === 'CONSTRUCTION' ? '現場作業員' :
                                                        req.employee.jobType === 'NAIL' ? 'ネイルサロン' :
                                                            req.employee.jobType === 'EYELASH' ? 'アイラッシュ' :
                                                                req.employee.jobType === 'SUPPORT' ? '就労支援' : 'その他'}
                                                </td>
                                                <td className="p-4">
                                                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${req.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
                                                        'bg-yellow-100 text-yellow-800'
                                                        }`}>
                                                        {req.status === 'CONFIRMED' ? '確定済' : '確認待ち'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-slate-500 text-sm">
                                                    {/* APIからcreatedAtを返す場合ここに表示 */}
                                                    -
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex gap-2">
                                                        {req.status !== 'CONFIRMED' && (
                                                            <button
                                                                className="btn btn-sm btn-primary"
                                                                disabled={processingId === req.id}
                                                                onClick={() => handleConfirm(req.id)}
                                                            >
                                                                {processingId === req.id ? '処理中...' : '承認・確定'}
                                                            </button>
                                                        )}
                                                        {req.status === 'CONFIRMED' && (
                                                            <button
                                                                className="btn btn-sm btn-secondary"
                                                                disabled={processingId === req.id + '_pdf'}
                                                                onClick={() => handleSendPdf(req.id)}
                                                            >
                                                                {processingId === req.id + '_pdf' ? '送信中...' : 'PDFをメール送信'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}
