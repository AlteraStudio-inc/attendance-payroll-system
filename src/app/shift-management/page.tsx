'use client'

import { useState, useEffect, useMemo } from 'react'
import { format, addMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth } from 'date-fns'
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

    // Tab & Calendar state
    const [activeTab, setActiveTab] = useState<'calendar' | 'details'>('calendar')
    const [selectedEntry, setSelectedEntry] = useState<{
        entry: ShiftRequest['shiftEntries'][0]
        employee: Employee
        status: string
    } | null>(null)

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

    const handleExportMonthlyPdf = async () => {
        setProcessingId('export_pdf')
        setMessage(null)
        try {
            const res = await fetch(`/api/shifts/export-pdf?yearMonth=${targetYearMonth}`)
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'PDF出力に失敗しました')
            }

            const blob = await res.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `シフト管理表_${targetYearMonth}.pdf`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            window.URL.revokeObjectURL(url)

            setMessage({ type: 'success', text: 'シフト表PDFを出力しました' })
        } catch (error) {
            setMessage({ type: 'error', text: error instanceof Error ? error.message : 'PDF出力エラー' })
        } finally {
            setProcessingId(null)
        }
    }

    // カレンダー用のデータ処理
    const { days, entriesByDate } = useMemo(() => {
        if (!targetYearMonth) return { days: [], entriesByDate: new Map() }

        try {
            const [year, month] = targetYearMonth.split('-')
            const start = startOfMonth(new Date(Number(year), Number(month) - 1))
            const end = endOfMonth(start)
            // 日曜始まりの週カレンダー
            const startDate = startOfWeek(start, { weekStartsOn: 0 })
            const endDate = endOfWeek(end, { weekStartsOn: 0 })
            const daysArr = eachDayOfInterval({ start: startDate, end: endDate })

            const entriesMap = new Map<string, { entry: ShiftRequest['shiftEntries'][0], employee: Employee, status: string }[]>()

            requests.forEach(req => {
                req.shiftEntries.forEach(entry => {
                    const dateStr = format(new Date(entry.date), 'yyyy-MM-dd')
                    if (!entriesMap.has(dateStr)) {
                        entriesMap.set(dateStr, [])
                    }
                    entriesMap.get(dateStr)!.push({ entry, employee: req.employee, status: req.status })
                })
            })

            return { days: daysArr, entriesByDate: entriesMap }
        } catch (e) {
            return { days: [], entriesByDate: new Map() }
        }
    }, [targetYearMonth, requests])

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
                    <div className="flex gap-4 mb-6 items-end justify-between">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">対象年月</label>
                            <input
                                type="month"
                                value={targetYearMonth}
                                onChange={(e) => setTargetYearMonth(e.target.value)}
                                className="input"
                            />
                        </div>
                        <button
                            className="btn btn-primary"
                            disabled={processingId === 'export_pdf' || requests.length === 0}
                            onClick={handleExportMonthlyPdf}
                        >
                            {processingId === 'export_pdf' ? '出力中...' : '月次シフト表PDFを出力'}
                        </button>
                    </div>

                    {/* タブ */}
                    <div className="border-b border-slate-200 mb-6 flex gap-6">
                        <button
                            className={`pb-3 font-medium text-sm border-b-2 px-1 transition-colors ${activeTab === 'calendar' ? 'border-primary-600 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            onClick={() => setActiveTab('calendar')}
                        >
                            カレンダーで確認
                        </button>
                        <button
                            className={`pb-3 font-medium text-sm border-b-2 px-1 transition-colors ${activeTab === 'details' ? 'border-primary-600 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            onClick={() => setActiveTab('details')}
                        >
                            詳細表示 (一覧)
                        </button>
                    </div>

                    {/* カレンダービュー */}
                    {activeTab === 'calendar' && (
                        <div className="overflow-x-auto">
                            <div className="min-w-[800px]">
                                <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden">
                                    {['日', '月', '火', '水', '木', '金', '土'].map((day, i) => (
                                        <div key={day} className={`bg-slate-50 py-2 text-center text-sm font-bold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-600'}`}>
                                            {day}
                                        </div>
                                    ))}
                                    {days.map((day: Date, dIdx: number) => {
                                        const dateStr = format(day, 'yyyy-MM-dd')
                                        const dayEntries = entriesByDate.get(dateStr) || []
                                        const isCurrentMonth = targetYearMonth ? isSameMonth(day, new Date(targetYearMonth)) : true

                                        return (
                                            <div key={dateStr} className={`min-h-[140px] h-full flex flex-col bg-white p-1 hover:bg-slate-50 transition-colors border-b border-r border-slate-100 ${!isCurrentMonth ? 'opacity-40 bg-slate-50' : ''}`}>
                                                <div className="text-right text-xs font-medium text-slate-500 mb-1 p-1">
                                                    {format(day, 'd')}
                                                </div>
                                                <div className="space-y-1 flex-1 overflow-visible">
                                                    {dayEntries.map((item: { entry: ShiftRequest['shiftEntries'][0], employee: Employee, status: string }, i: number) => {
                                                        const isRest = item.entry.isRest
                                                        const hasNote = !!item.entry.note
                                                        return (
                                                            <div
                                                                key={i}
                                                                onClick={() => setSelectedEntry(item)}
                                                                className={`text-xs p-1.5 rounded cursor-pointer leading-tight border transition-shadow hover:shadow-sm
                                                                    ${isRest ? 'bg-red-50 border-red-100 text-red-700' : 'bg-blue-50 border-blue-100 text-blue-700'}`}
                                                            >
                                                                <div className="font-bold truncate" title={item.employee.name}>{item.employee.name}</div>
                                                                <div className="flex items-center justify-between mt-0.5">
                                                                    <span className="opacity-90">
                                                                        {isRest ? '(休)' : `${item.entry.startTime ? format(new Date(item.entry.startTime), 'HH:mm') : ''}-${item.entry.endTime ? format(new Date(item.entry.endTime), 'HH:mm') : ''}`}
                                                                    </span>
                                                                    {hasNote && <span title="メモあり" className="inline-block px-1 ml-1 text-[10px] bg-yellow-100 text-yellow-800 rounded border border-yellow-200">メモ</span>}
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 詳細表示 (従来のリスト) */}
                    {activeTab === 'details' && (
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
                                                            {req.status !== 'CONFIRMED' ? (
                                                                <button
                                                                    className="btn btn-sm btn-primary"
                                                                    disabled={processingId === req.id}
                                                                    onClick={() => handleConfirm(req.id)}
                                                                >
                                                                    {processingId === req.id ? '処理中...' : '承認・確定'}
                                                                </button>
                                                            ) : (
                                                                <span className="text-sm font-medium text-slate-400">操作なし</span>
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
                    )}
                </div>
            </div>

            {/* 詳細モーダル */}
            {selectedEntry && (
                <div
                    className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200"
                    onClick={() => setSelectedEntry(null)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100">
                            <h3 className="text-lg font-bold text-slate-800">シフト詳細</h3>
                            <button
                                onClick={() => setSelectedEntry(null)}
                                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-slate-400 mb-1 block">日付</label>
                                <p className="text-slate-800 font-medium">{format(new Date(selectedEntry.entry.date), 'yyyy年MM月dd日 (E)', { locale: ja })}</p>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-slate-400 mb-1 block">従業員</label>
                                <p className="text-slate-800 font-medium">{selectedEntry.employee.name} <span className="text-slate-500 text-sm font-normal">({selectedEntry.employee.jobType === 'CONSTRUCTION' ? '現場作業員' : 'その他'})</span></p>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <label className="text-xs font-semibold text-slate-400 mb-2 block">申請内容</label>
                                <p className="font-bold text-xl">
                                    {selectedEntry.entry.isRest ? (
                                        <span className="text-red-500 flex items-center gap-2">休み希望</span>
                                    ) : (
                                        <span className="text-primary-600 flex items-center gap-2">
                                            {selectedEntry.entry.startTime ? format(new Date(selectedEntry.entry.startTime), 'HH:mm') : '--:--'}
                                            <span className="text-slate-300 mx-1">/</span>
                                            {selectedEntry.entry.endTime ? format(new Date(selectedEntry.entry.endTime), 'HH:mm') : '--:--'}
                                        </span>
                                    )}
                                </p>
                            </div>

                            {selectedEntry.entry.note && (
                                <div>
                                    <label className="text-xs font-semibold text-slate-400 mb-1 block">メモ・備考</label>
                                    <div className="bg-yellow-50/50 p-3 rounded-lg border border-yellow-100 text-slate-700 text-sm whitespace-pre-wrap leading-relaxed">
                                        {selectedEntry.entry.note}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="text-xs font-semibold text-slate-400 mb-1 block">全体ステータス</label>
                                <div>
                                    <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${selectedEntry.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                        {selectedEntry.status === 'CONFIRMED' ? '月次シフト確定済' : '確認待ち・調整中'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 pt-4 flex gap-3">
                            <button className="btn btn-secondary flex-1" onClick={() => setSelectedEntry(null)}>閉じる</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
