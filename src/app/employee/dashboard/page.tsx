'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface TodayStatus {
    hasClockedIn: boolean
    hasClockedOut: boolean
    clockIn: string | null
    clockOut: string | null
}

export default function EmployeeDashboard() {
    const [todayStatus, setTodayStatus] = useState<TodayStatus | null>(null)
    const [loading, setLoading] = useState(true)
    const [punching, setPunching] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    useEffect(() => {
        fetchTodayStatus()
    }, [])

    const fetchTodayStatus = async () => {
        try {
            const res = await fetch('/api/employee/today')
            const data = await res.json()
            if (res.ok) {
                setTodayStatus(data)
            }
        } catch (error) {
            console.error('Failed to fetch status:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleClockIn = async () => {
        setPunching(true)
        setMessage(null)
        try {
            const res = await fetch('/api/employee/clock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'clock_in' }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setMessage({ type: 'success', text: `出勤しました (${data.clockIn})` })
            fetchTodayStatus()
        } catch (err) {
            setMessage({ type: 'error', text: err instanceof Error ? err.message : '出勤に失敗しました' })
        } finally {
            setPunching(false)
        }
    }

    const handleClockOut = async () => {
        setPunching(true)
        setMessage(null)
        try {
            const res = await fetch('/api/employee/clock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'clock_out' }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setMessage({ type: 'success', text: `退勤しました (${data.clockOut})` })
            fetchTodayStatus()
        } catch (err) {
            setMessage({ type: 'error', text: err instanceof Error ? err.message : '退勤に失敗しました' })
        } finally {
            setPunching(false)
        }
    }

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <div className="spinner w-10 h-10"></div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <h1 className="text-xl font-bold text-slate-800">ホーム</h1>

            {message && (
                <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
                    {message.text}
                </div>
            )}

            {/* 今日の勤怠状況 */}
            <div className="card">
                <h2 className="text-lg font-semibold text-slate-700 mb-4">本日の勤務</h2>

                <div className="flex justify-around text-center mb-6">
                    <div>
                        <div className="text-sm text-slate-500">出勤</div>
                        <div className="text-2xl font-bold text-slate-800">
                            {todayStatus?.clockIn || '--:--'}
                        </div>
                    </div>
                    <div>
                        <div className="text-sm text-slate-500">退勤</div>
                        <div className="text-2xl font-bold text-slate-800">
                            {todayStatus?.clockOut || '--:--'}
                        </div>
                    </div>
                </div>

                {/* 打刻ボタン */}
                {!todayStatus?.hasClockedIn ? (
                    <button
                        onClick={handleClockIn}
                        disabled={punching}
                        className="w-full h-20 text-xl font-bold rounded-xl bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50"
                    >
                        {punching ? '処理中...' : '出勤する'}
                    </button>
                ) : !todayStatus?.hasClockedOut ? (
                    <button
                        onClick={handleClockOut}
                        disabled={punching}
                        className="w-full h-20 text-xl font-bold rounded-xl bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-50"
                    >
                        {punching ? '処理中...' : '退勤する'}
                    </button>
                ) : (
                    <div className="text-center py-4 text-green-600 font-medium">
                        ✓ 本日の勤務は終了しました
                    </div>
                )}
            </div>

            {/* クイックメニュー */}
            <div className="grid grid-cols-2 gap-3">
                <Link href="/employee/requests/new" className="card text-center py-6 hover:shadow-md transition-shadow">
                    <span className="text-2xl mb-2 block">📝</span>
                    <span className="text-sm font-medium text-slate-700">修正申請</span>
                </Link>
                <Link href="/employee/requests/leave" className="card text-center py-6 hover:shadow-md transition-shadow">
                    <span className="text-2xl mb-2 block">🌴</span>
                    <span className="text-sm font-medium text-slate-700">有給申請</span>
                </Link>
                <Link href="/employee/attendance" className="card text-center py-6 hover:shadow-md transition-shadow">
                    <span className="text-2xl mb-2 block">📅</span>
                    <span className="text-sm font-medium text-slate-700">勤怠履歴</span>
                </Link>
                <Link href="/employee/payslips" className="card text-center py-6 hover:shadow-md transition-shadow">
                    <span className="text-2xl mb-2 block">💰</span>
                    <span className="text-sm font-medium text-slate-700">給与明細</span>
                </Link>
            </div>
        </div>
    )
}
