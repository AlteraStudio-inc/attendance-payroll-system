'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type ClockStatus = 'not_clocked_in' | 'clocked_in' | 'clocked_out'

interface ClockRecord {
    id: string
    clockIn: string
    clockOut: string | null
    note: string | null
}

interface ClockData {
    record: ClockRecord | null
    status: ClockStatus
}

interface MonthlySummary {
    workDays: number
    totalHours: number
    paidLeaveDays: number
}

export default function EmployeeDashboard() {
    const [clockData, setClockData] = useState<ClockData | null>(null)
    const [summary, setSummary] = useState<MonthlySummary | null>(null)
    const [loading, setLoading] = useState(true)
    const [punching, setPunching] = useState(false)
    const [note, setNote] = useState('')
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [currentTime, setCurrentTime] = useState(new Date())

    // 現在時刻を毎秒更新
    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(interval)
    }, [])

    const fetchClockStatus = useCallback(async () => {
        try {
            const res = await fetch('/api/employee/clock')
            const data = await res.json()
            if (res.ok && data.success) {
                setClockData(data.data)
            }
        } catch (error) {
            console.error('Failed to fetch clock status:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    const fetchSummary = useCallback(async () => {
        try {
            const now = new Date()
            const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
            const res = await fetch(`/api/employee/attendance?month=${month}`)
            const data = await res.json()
            if (res.ok && data.success) {
                const entries = data.data?.entries || []
                const workDays = entries.filter((e: { isPaidLeave?: boolean; clockIn?: string }) => e.clockIn || e.isPaidLeave).length
                const totalMs = entries.reduce((sum: number, e: { clockIn?: string; clockOut?: string | null; isPaidLeave?: boolean }) => {
                    if (e.isPaidLeave) return sum + 8 * 3600000
                    if (!e.clockIn || !e.clockOut) return sum
                    return sum + (new Date(e.clockOut).getTime() - new Date(e.clockIn).getTime())
                }, 0)
                const paidLeaveDays = entries.filter((e: { isPaidLeave?: boolean }) => e.isPaidLeave).length
                setSummary({
                    workDays,
                    totalHours: totalMs / 3600000,
                    paidLeaveDays,
                })
            }
        } catch (error) {
            console.error('Failed to fetch summary:', error)
        }
    }, [])

    useEffect(() => {
        fetchClockStatus()
        fetchSummary()
    }, [fetchClockStatus, fetchSummary])

    const handleClock = async (type: 'clock_in' | 'clock_out') => {
        setPunching(true)
        setMessage(null)
        try {
            const body: { type: string; note?: string } = { type }
            if (type === 'clock_out' && note) body.note = note

            const res = await fetch('/api/employee/clock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            const data = await res.json()
            if (!res.ok || !data.success) throw new Error(data.error || '打刻に失敗しました')

            const timeStr = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
            setMessage({
                type: 'success',
                text: type === 'clock_in' ? `出勤しました (${timeStr})` : `退勤しました (${timeStr})`,
            })
            setNote('')
            await fetchClockStatus()
            await fetchSummary()
        } catch (err) {
            setMessage({ type: 'error', text: err instanceof Error ? err.message : '打刻に失敗しました' })
        } finally {
            setPunching(false)
        }
    }

    const formatTime = (iso: string) =>
        new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })

    const status = clockData?.status ?? 'not_clocked_in'

    if (loading) {
        return (
            <div className="flex justify-center py-16">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        )
    }

    return (
        <div className="space-y-5">
            {/* 現在時刻 */}
            <div className="bg-blue-600 text-white rounded-2xl p-6 text-center shadow-lg">
                <div className="text-5xl font-bold tracking-tight mb-1">
                    {currentTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
                <div className="text-blue-200 text-sm">
                    {currentTime.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
                </div>
            </div>

            {/* メッセージ */}
            {message && (
                <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
                    message.type === 'success'
                        ? 'bg-green-100 text-green-800 border border-green-200'
                        : 'bg-red-100 text-red-800 border border-red-200'
                }`}>
                    {message.text}
                </div>
            )}

            {/* 本日の勤怠 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                <h2 className="text-base font-semibold text-slate-700 mb-4">本日の勤務状況</h2>

                <div className="flex justify-around text-center mb-5">
                    <div>
                        <div className="text-xs text-slate-500 mb-1">出勤</div>
                        <div className="text-2xl font-bold text-slate-800">
                            {clockData?.record?.clockIn ? formatTime(clockData.record.clockIn) : '--:--'}
                        </div>
                    </div>
                    <div className="w-px bg-slate-200"></div>
                    <div>
                        <div className="text-xs text-slate-500 mb-1">退勤</div>
                        <div className="text-2xl font-bold text-slate-800">
                            {clockData?.record?.clockOut ? formatTime(clockData.record.clockOut) : '--:--'}
                        </div>
                    </div>
                </div>

                {/* 備考欄（退勤前のみ） */}
                {status !== 'clocked_out' && (
                    <div className="mb-4">
                        <input
                            type="text"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="備考（現場名など）※任意"
                        />
                    </div>
                )}

                {/* 打刻ボタン */}
                {status === 'not_clocked_in' && (
                    <button
                        onClick={() => handleClock('clock_in')}
                        disabled={punching}
                        className="w-full h-20 text-2xl font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 shadow-md"
                    >
                        {punching ? '処理中...' : '出勤'}
                    </button>
                )}
                {status === 'clocked_in' && (
                    <button
                        onClick={() => handleClock('clock_out')}
                        disabled={punching}
                        className="w-full h-20 text-2xl font-bold rounded-xl bg-red-500 text-white hover:bg-red-600 active:scale-95 transition-all disabled:opacity-50 shadow-md"
                    >
                        {punching ? '処理中...' : '退勤'}
                    </button>
                )}
                {status === 'clocked_out' && (
                    <div className="text-center py-4 text-green-600 font-semibold text-lg">
                        ✓ 本日の勤務は終了しました
                    </div>
                )}
            </div>

            {/* 今月のサマリー */}
            {summary && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                    <h2 className="text-base font-semibold text-slate-700 mb-3">今月のサマリー</h2>
                    <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-blue-50 rounded-xl p-3">
                            <div className="text-2xl font-bold text-blue-600">{summary.workDays}</div>
                            <div className="text-xs text-slate-500 mt-1">出勤日数</div>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3">
                            <div className="text-2xl font-bold text-slate-700">{summary.totalHours.toFixed(1)}</div>
                            <div className="text-xs text-slate-500 mt-1">総時間 (h)</div>
                        </div>
                        <div className="bg-green-50 rounded-xl p-3">
                            <div className="text-2xl font-bold text-green-600">{summary.paidLeaveDays}</div>
                            <div className="text-xs text-slate-500 mt-1">有給日数</div>
                        </div>
                    </div>
                </div>
            )}

            {/* クイックリンク */}
            <div className="grid grid-cols-2 gap-3">
                <Link
                    href="/employee/requests/new"
                    className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm hover:shadow-md transition-shadow"
                >
                    <div className="text-2xl mb-1">📝</div>
                    <div className="text-sm font-medium text-slate-700">修正申請</div>
                </Link>
                <Link
                    href="/employee/requests/leave"
                    className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm hover:shadow-md transition-shadow"
                >
                    <div className="text-2xl mb-1">📅</div>
                    <div className="text-sm font-medium text-slate-700">有給申請</div>
                </Link>
                <Link
                    href="/employee/attendance"
                    className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm hover:shadow-md transition-shadow"
                >
                    <div className="text-2xl mb-1">📋</div>
                    <div className="text-sm font-medium text-slate-700">勤怠履歴</div>
                </Link>
                <Link
                    href="/employee/payslips"
                    className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm hover:shadow-md transition-shadow"
                >
                    <div className="text-2xl mb-1">💴</div>
                    <div className="text-sm font-medium text-slate-700">給与明細</div>
                </Link>
            </div>
        </div>
    )
}
