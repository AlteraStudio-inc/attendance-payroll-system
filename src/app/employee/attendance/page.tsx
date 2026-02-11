'use client'

import { useState, useEffect } from 'react'

interface TimeEntry {
    id: string
    date: string
    clockIn: string
    clockOut: string | null
    isHolidayWork: boolean
    isPaidLeave: boolean
}

export default function EmployeeAttendancePage() {
    const [entries, setEntries] = useState<TimeEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [month, setMonth] = useState(() => {
        const now = new Date()
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    })

    useEffect(() => {
        const fetchEntries = async () => {
            setLoading(true)
            try {
                const res = await fetch(`/api/employee/attendance?month=${month}`)
                const data = await res.json()
                if (res.ok) {
                    setEntries(data.entries || [])
                }
            } catch (error) {
                console.error('Failed to fetch:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchEntries()
    }, [month])

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        const day = date.getDate()
        const weekday = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()]
        return { day, weekday }
    }

    const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
    }

    const calculateHours = (clockIn: string, clockOut: string | null): string => {
        if (!clockOut) return '-'
        const hours = (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / (1000 * 60 * 60)
        return hours.toFixed(1) + 'h'
    }

    const totalHours = entries.reduce((sum, e) => {
        if (e.isPaidLeave) return sum + 8
        if (!e.clockOut) return sum
        return sum + (new Date(e.clockOut).getTime() - new Date(e.clockIn).getTime()) / (1000 * 60 * 60)
    }, 0)

    return (
        <div className="space-y-4">
            <h1 className="text-xl font-bold text-slate-800">勤怠履歴</h1>

            {/* 月選択 */}
            <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="input w-full"
            />

            {/* サマリー */}
            <div className="card bg-primary-50">
                <div className="text-center">
                    <div className="text-sm text-slate-600">今月の勤務時間</div>
                    <div className="text-3xl font-bold text-primary-600">{totalHours.toFixed(1)}h</div>
                </div>
            </div>

            {/* 勤怠一覧 */}
            {loading ? (
                <div className="flex justify-center py-8">
                    <div className="spinner w-8 h-8"></div>
                </div>
            ) : entries.length === 0 ? (
                <p className="text-center text-slate-500 py-8">データがありません</p>
            ) : (
                <div className="space-y-2">
                    {entries.map((entry) => {
                        const { day, weekday } = formatDate(entry.date)
                        return (
                            <div
                                key={entry.id}
                                className={`card p-3 ${entry.isPaidLeave ? 'bg-green-50' : entry.isHolidayWork ? 'bg-orange-50' : ''}`}
                            >
                                <div className="flex items-center">
                                    <div className="w-12 text-center">
                                        <div className="text-lg font-bold text-slate-800">{day}</div>
                                        <div className={`text-xs ${['日', '土'].includes(weekday) ? 'text-red-500' : 'text-slate-500'}`}>
                                            {weekday}
                                        </div>
                                    </div>
                                    <div className="flex-1 flex items-center justify-around">
                                        <div className="text-center">
                                            <div className="text-xs text-slate-500">出勤</div>
                                            <div className="font-medium">{entry.isPaidLeave ? '-' : formatTime(entry.clockIn)}</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-xs text-slate-500">退勤</div>
                                            <div className="font-medium">
                                                {entry.isPaidLeave ? '-' : entry.clockOut ? formatTime(entry.clockOut) : <span className="text-orange-500">未</span>}
                                            </div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-xs text-slate-500">時間</div>
                                            <div className="font-medium">
                                                {entry.isPaidLeave ? '8.0h' : calculateHours(entry.clockIn, entry.clockOut)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="w-16 text-right">
                                        {entry.isPaidLeave && <span className="badge badge-approved text-xs">有給</span>}
                                        {entry.isHolidayWork && <span className="badge badge-pending text-xs">休出</span>}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
