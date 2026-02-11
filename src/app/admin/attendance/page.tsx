'use client'

import { useState, useEffect, useCallback } from 'react'

interface TimeEntry {
    id: string
    employee: { name: string; employeeCode: string }
    date: string
    clockIn: string
    clockOut: string | null
    isHolidayWork: boolean
    isPaidLeave: boolean
}

export default function AttendancePage() {
    const [entries, setEntries] = useState<TimeEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [selectedDate, setSelectedDate] = useState(() => {
        const now = new Date()
        return now.toISOString().split('T')[0]
    })
    const [view, setView] = useState<'day' | 'week' | 'month'>('day')

    const fetchEntries = useCallback(async () => {
        try {
            const res = await fetch(`/api/attendance?date=${selectedDate}&view=${view}`)
            const data = await res.json()
            if (res.ok) {
                setEntries(data.entries || [])
            }
        } catch (err) {
            setError('取得に失敗しました')
        } finally {
            setLoading(false)
        }
    }, [selectedDate, view])

    useEffect(() => {
        fetchEntries()
    }, [fetchEntries])

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('ja-JP', {
            month: 'short',
            day: 'numeric',
            weekday: 'short',
        })
    }

    const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
    }

    const calculateHours = (clockIn: string, clockOut: string | null): string => {
        if (!clockOut) return '-'
        const start = new Date(clockIn)
        const end = new Date(clockOut)
        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
        return hours.toFixed(1) + 'h'
    }

    // 未退勤者一覧
    const unclockedOut = entries.filter((e) => !e.clockOut && !e.isPaidLeave)

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl font-bold text-slate-800">勤怠管理</h1>

                <div className="flex gap-2">
                    {(['day', 'week', 'month'] as const).map((v) => (
                        <button
                            key={v}
                            onClick={() => setView(v)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === v
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            {v === 'day' ? '日' : v === 'week' ? '週' : '月'}
                        </button>
                    ))}
                </div>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            {/* 日付選択 */}
            <div className="card">
                <div className="flex items-center gap-4">
                    <label className="text-sm font-medium text-slate-700">表示期間:</label>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="input w-auto"
                    />
                </div>
            </div>

            {/* 未退勤者アラート */}
            {unclockedOut.length > 0 && (
                <div className="alert alert-warning">
                    <strong>未退勤者 ({unclockedOut.length}名):</strong>{' '}
                    {unclockedOut.map((e) => e.employee.name).join(', ')}
                </div>
            )}

            {/* 勤怠一覧 */}
            <div className="card p-0">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="spinner w-10 h-10"></div>
                    </div>
                ) : entries.length === 0 ? (
                    <p className="p-8 text-center text-slate-500">勤怠データがありません</p>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>従業員</th>
                                    <th>日付</th>
                                    <th>出勤</th>
                                    <th>退勤</th>
                                    <th>勤務時間</th>
                                    <th>区分</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map((entry) => (
                                    <tr key={entry.id}>
                                        <td>
                                            <div className="font-medium">{entry.employee.name}</div>
                                            <div className="text-sm text-slate-500">{entry.employee.employeeCode}</div>
                                        </td>
                                        <td>{formatDate(entry.date)}</td>
                                        <td>{entry.isPaidLeave ? '-' : formatTime(entry.clockIn)}</td>
                                        <td>
                                            {entry.isPaidLeave ? '-' : entry.clockOut ? formatTime(entry.clockOut) : (
                                                <span className="text-orange-500 font-medium">未退勤</span>
                                            )}
                                        </td>
                                        <td className="font-mono">
                                            {entry.isPaidLeave ? '8.0h' : calculateHours(entry.clockIn, entry.clockOut)}
                                        </td>
                                        <td>
                                            {entry.isPaidLeave && <span className="badge badge-approved">有給</span>}
                                            {entry.isHolidayWork && <span className="badge badge-pending">休日出勤</span>}
                                            {!entry.isPaidLeave && !entry.isHolidayWork && <span className="text-slate-400">-</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
