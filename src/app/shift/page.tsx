'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface ShiftEntryForm {
    date: string
    isRest: boolean
    startTime: string
    endTime: string
    note: string
}

export default function StandaloneShiftPage() {
    const router = useRouter()

    // Auth state
    const [isLoggedIn, setIsLoggedIn] = useState(false)
    const [employeeCode, setEmployeeCode] = useState('')
    const [pin, setPin] = useState('')
    const [authLoading, setAuthLoading] = useState(false)
    const [authError, setAuthError] = useState('')

    // Shift state
    const [yearMonth, setYearMonth] = useState(() => {
        const nextMonth = new Date()
        nextMonth.setMonth(nextMonth.getMonth() + 1)
        return `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`
    })
    const [entries, setEntries] = useState<ShiftEntryForm[]>([])
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    // Check if already logged in by trying to fetch the current user's shift requests
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const res = await fetch(`/api/shifts/requests?yearMonth=${yearMonth}`)
                if (res.ok) {
                    setIsLoggedIn(true)
                    loadShiftData(res)
                }
            } catch (err) {
                console.error(err)
            }
        }
        checkAuth()
    }, [yearMonth])

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
                    password: pin,
                    loginType: 'pin',
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                // If the user hasn't set up a PIN, let them know.
                // Assuming standard errors
                throw new Error(data.error || 'ログインに失敗しました')
            }

            // Immediately load data
            setIsLoggedIn(true)
            const res = await fetch(`/api/shifts/requests?yearMonth=${yearMonth}`)
            if (res.ok) {
                loadShiftData(res)
            } else {
                setEntries(generateMonthEntries(yearMonth))
            }
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
        setPin('')
        setEntries([])
    }

    const loadShiftData = async (res: Response) => {
        setLoading(true)
        try {
            const data = await res.json()
            if (Array.isArray(data) && data.length > 0 && data[0].shiftEntries) {
                const existingEntries = data[0].shiftEntries
                const newEntries = generateMonthEntries(yearMonth)
                existingEntries.forEach((ex: any) => {
                    const dateStr = new Date(ex.date).toISOString().split('T')[0]
                    const target = newEntries.find(n => n.date === dateStr)
                    if (target) {
                        target.isRest = ex.isRest
                        target.startTime = ex.startTime ? new Date(ex.startTime).toTimeString().substring(0, 5) : ''
                        target.endTime = ex.endTime ? new Date(ex.endTime).toTimeString().substring(0, 5) : ''
                        target.note = ex.note || ''
                    }
                })
                setEntries(newEntries)
                return
            }
        } catch (err) {
            console.error(err)
        } finally {
            setEntries(generateMonthEntries(yearMonth))
            setLoading(false)
        }
    }

    const generateMonthEntries = (ym: string) => {
        const [year, month] = ym.split('-').map(Number)
        const daysInMonth = new Date(year, month, 0).getDate()
        const forms: ShiftEntryForm[] = []
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`
            forms.push({
                date: dateStr,
                isRest: false,
                startTime: '',
                endTime: '',
                note: ''
            })
        }
        return forms
    }

    const handleUpdateEntry = (index: number, field: keyof ShiftEntryForm, value: any) => {
        const newEntries = [...entries]
        newEntries[index] = { ...newEntries[index], [field]: value }
        setEntries(newEntries)
    }

    const handleSubmit = async () => {
        setMessage(null)
        for (const entry of entries) {
            if (!entry.isRest && ((entry.startTime && !entry.endTime) || (!entry.startTime && entry.endTime))) {
                setMessage({ type: 'error', text: `${entry.date} の出退勤時間の確認をしてください` })
                window.scrollTo(0, 0)
                return
            }
        }

        setLoading(true)

        try {
            const filledEntries = entries.filter(e => e.isRest || (e.startTime && e.endTime))
            const formattedEntries = filledEntries.map(e => {
                return {
                    date: e.date,
                    isRest: e.isRest,
                    startTime: e.startTime ? `${e.date}T${e.startTime}:00` : null,
                    endTime: e.endTime ? `${e.date}T${e.endTime}:00` : null,
                    note: e.note
                }
            })

            const res = await fetch('/api/shifts/requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    yearMonth,
                    entries: formattedEntries
                })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            setMessage({ type: 'success', text: 'シフト申請を保存しました。' })
            window.scrollTo(0, 0)
        } catch (err) {
            setMessage({ type: 'error', text: err instanceof Error ? err.message : '保存に失敗しました' })
            window.scrollTo(0, 0)
        } finally {
            setLoading(false)
        }
    }

    const getDayName = (dateStr: string) => {
        const days = ['日', '月', '火', '水', '木', '金', '土']
        return days[new Date(dateStr).getDay()]
    }

    if (!isLoggedIn) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
                <div className="max-w-sm w-full bg-white rounded-2xl shadow-md p-8 border border-slate-200">
                    <h1 className="text-2xl font-bold text-center text-slate-800 mb-6">シフト申請ログイン</h1>
                    <form onSubmit={handleLogin} className="space-y-4">
                        {authError && (
                            <div className="alert alert-error text-sm py-2">{authError}</div>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">従業員コード</label>
                            <input
                                type="text"
                                value={employeeCode}
                                onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())}
                                className="input"
                                placeholder="例: EMP001"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">PINコード (4〜6桁)</label>
                            <input
                                type="password"
                                inputMode="numeric"
                                pattern="\d*"
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                className="input tracking-widest font-mono text-center text-lg py-3"
                                placeholder="****"
                                maxLength={6}
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
        <div className="min-h-screen bg-slate-50 p-4 pb-24 md:p-8">
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <h1 className="text-xl font-bold text-slate-800">月次シフト申請</h1>
                    <button onClick={handleLogout} className="text-sm text-slate-500 hover:text-slate-800 font-medium">
                        ログアウト
                    </button>
                </div>

                {message && (
                    <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
                        {message.text}
                    </div>
                )}

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="mb-6 flex flex-col md:flex-row md:items-center gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">対象年月</label>
                            <input
                                type="month"
                                value={yearMonth}
                                onChange={(e) => {
                                    setYearMonth(e.target.value)
                                }}
                                className="input"
                            />
                        </div>
                        <div className="text-sm text-orange-600 bg-orange-50 px-3 py-2 rounded-md border border-orange-100">
                            ※ 出勤しない日、または公休希望日は「休み」にチェックを入れてください。
                        </div>
                    </div>

                    {loading || entries.length === 0 ? (
                        <div className="text-center py-10">
                            <div className="spinner w-8 h-8 mx-auto mb-2"></div>
                            <span className="text-slate-500 text-sm">読み込み中...</span>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {entries.map((entry, idx) => {
                                const dayName = getDayName(entry.date)
                                const isWeekend = dayName === '土' || dayName === '日'
                                return (
                                    <div key={entry.date} className={`border ${isWeekend ? 'border-primary-100 bg-primary-50/30' : 'border-slate-200 bg-slate-50'} rounded-lg p-4`}>
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="font-medium text-slate-800 flex items-center gap-2">
                                                <span className={`text-lg ${dayName === '日' ? 'text-red-600' : dayName === '土' ? 'text-blue-600' : ''}`}>
                                                    {parseInt(entry.date.split('-')[2])}
                                                </span>
                                                <span className={`text-sm ${dayName === '日' ? 'text-red-500' : dayName === '土' ? 'text-blue-500' : 'text-slate-500'}`}>
                                                    ({dayName})
                                                </span>
                                            </div>
                                            <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-md border border-slate-300 shadow-sm transition-colors hover:bg-slate-50">
                                                <input
                                                    type="checkbox"
                                                    checked={entry.isRest}
                                                    onChange={(e) => handleUpdateEntry(idx, 'isRest', e.target.checked)}
                                                    className="w-4 h-4 text-primary-600 rounded"
                                                />
                                                <span className="text-sm font-medium">休み</span>
                                            </label>
                                        </div>

                                        {!entry.isRest && (
                                            <div className="grid grid-cols-2 gap-3 mb-3">
                                                <div>
                                                    <label className="block text-xs text-slate-500 mb-1">出勤時間</label>
                                                    <input
                                                        type="time"
                                                        value={entry.startTime}
                                                        onChange={(e) => handleUpdateEntry(idx, 'startTime', e.target.value)}
                                                        className="input py-2 text-sm bg-white"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-slate-500 mb-1">退勤時間</label>
                                                    <input
                                                        type="time"
                                                        value={entry.endTime}
                                                        onChange={(e) => handleUpdateEntry(idx, 'endTime', e.target.value)}
                                                        className="input py-2 text-sm bg-white"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                        <div>
                                            <input
                                                type="text"
                                                value={entry.note}
                                                onChange={(e) => handleUpdateEntry(idx, 'note', e.target.value)}
                                                className="input py-2 text-sm bg-white text-slate-700 placeholder-slate-400"
                                                placeholder="備考 (午後から出社など)"
                                            />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-sm border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10 md:relative md:bg-transparent md:border-t-0 md:shadow-none md:p-0">
                    <div className="max-w-3xl mx-auto">
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="btn btn-primary w-full py-4 text-lg font-bold shadow-md hover:shadow-lg transform active:scale-[0.99] transition-all"
                        >
                            {loading ? '保存中...' : 'シフト申請を送信する'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
