'use client'

import { useState, useEffect } from 'react'

interface AttendanceEntry {
    id: string
    date: string
    clockIn: string | null
    clockOut: string | null
    isHolidayWork: boolean
    isPaidLeave: boolean
    note: string | null
}

export default function EmployeeAttendancePage() {
    const [entries, setEntries] = useState<AttendanceEntry[]>([])
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
                if (res.ok && data.success) {
                    setEntries(data.data?.entries || [])
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

    const formatTime = (dateStr: string) =>
        new Date(dateStr).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })

    const calcHours = (clockIn: string | null, clockOut: string | null): string => {
        if (!clockIn || !clockOut) return '-'
        const h = (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 3600000
        return h.toFixed(1) + 'h'
    }

    const totalHours = entries.reduce((sum, e) => {
        if (e.isPaidLeave) return sum + 8
        if (!e.clockIn || !e.clockOut) return sum
        return sum + (new Date(e.clockOut).getTime() - new Date(e.clockIn).getTime()) / 3600000
    }, 0)

    const workDays = entries.filter((e) => e.clockIn || e.isPaidLeave).length

    return (
        <div className="space-y-4">
            <h1 className="text-xl font-bold text-slate-800">勤怠履歴</h1>

            {/* 月選択 */}
            <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />

            {/* サマリー */}
            <div className="bg-blue-50 rounded-2xl p-4 flex justify-around text-center border border-blue-100">
                <div>
                    <div className="text-2xl font-bold text-blue-600">{totalHours.toFixed(1)}</div>
                    <div className="text-xs text-slate-500 mt-1">総時間 (h)</div>
                </div>
                <div className="w-px bg-blue-200"></div>
                <div>
                    <div className="text-2xl font-bold text-blue-600">{workDays}</div>
                    <div className="text-xs text-slate-500 mt-1">出勤日数</div>
                </div>
            </div>

            {/* 勤怠一覧 */}
            {loading ? (
                <div className="flex justify-center py-8">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : entries.length === 0 ? (
                <p className="text-center text-slate-500 py-8">データがありません</p>
            ) : (
                <div className="space-y-2">
                    {entries.map((entry) => {
                        const { day, weekday } = formatDate(entry.date)
                        const isSunday = weekday === '日'
                        const isSaturday = weekday === '土'
                        return (
                            <div
                                key={entry.id}
                                className={`bg-white rounded-xl border p-3 shadow-sm ${
                                    entry.isPaidLeave
                                        ? 'border-green-200 bg-green-50'
                                        : entry.isHolidayWork
                                        ? 'border-orange-200 bg-orange-50'
                                        : 'border-slate-200'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 text-center flex-shrink-0">
                                        <div className="text-lg font-bold text-slate-800">{day}</div>
                                        <div className={`text-xs font-medium ${isSunday ? 'text-red-500' : isSaturday ? 'text-blue-500' : 'text-slate-500'}`}>
                                            {weekday}
                                        </div>
                                    </div>
                                    <div className="flex-1 grid grid-cols-3 text-center">
                                        <div>
                                            <div className="text-xs text-slate-400">出勤</div>
                                            <div className="text-sm font-medium text-slate-800">
                                                {entry.isPaidLeave ? '-' : entry.clockIn ? formatTime(entry.clockIn) : '-'}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-slate-400">退勤</div>
                                            <div className="text-sm font-medium text-slate-800">
                                                {entry.isPaidLeave ? '-' : entry.clockOut ? formatTime(entry.clockOut) : <span className="text-orange-500">未</span>}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-slate-400">時間</div>
                                            <div className="text-sm font-medium text-slate-800">
                                                {entry.isPaidLeave ? '8.0h' : calcHours(entry.clockIn, entry.clockOut)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0">
                                        {entry.isPaidLeave && (
                                            <span className="inline-block bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">有給</span>
                                        )}
                                        {entry.isHolidayWork && (
                                            <span className="inline-block bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full font-medium">休出</span>
                                        )}
                                    </div>
                                </div>
                                {entry.note && (
                                    <div className="mt-1 ml-13 text-xs text-slate-400 pl-13">{entry.note}</div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
