'use client'

import { useState, useEffect } from 'react'
import { startOfMonth, endOfMonth, eachDayOfInterval, format, addMonths } from 'date-fns'
import { ja } from 'date-fns/locale'

interface ShiftEntry {
    date: string
    startTime: string
    endTime: string
    isRest: boolean
    note: string
}

export default function EmployeeShiftsPage() {
    const [targetYearMonth, setTargetYearMonth] = useState('')
    const [entries, setEntries] = useState<Record<string, ShiftEntry>>({})
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [deadlineWarning, setDeadlineWarning] = useState(false)

    // デフォルトで翌月を選択
    useEffect(() => {
        const nextMonth = addMonths(new Date(), 1)
        const ym = format(nextMonth, 'yyyy-MM')
        setTargetYearMonth(ym)
    }, [])

    useEffect(() => {
        // 20日を過ぎているかどうかの警告
        const today = new Date().getDate()
        if (today > 20) {
            setDeadlineWarning(true)
        } else {
            setDeadlineWarning(false)
        }

        if (targetYearMonth) {
            initializeEntries(targetYearMonth)
            fetchExistingRequest(targetYearMonth)
        }
    }, [targetYearMonth])

    const initializeEntries = (ym: string) => {
        const [year, month] = ym.split('-')
        const start = startOfMonth(new Date(Number(year), Number(month) - 1))
        const end = endOfMonth(start)
        const days = eachDayOfInterval({ start, end })

        const initial: Record<string, ShiftEntry> = {}
        days.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd')
            initial[dateStr] = {
                date: dateStr,
                startTime: '09:00',
                endTime: '18:00',
                isRest: false,
                note: ''
            }
        })
        setEntries(initial)
    }

    const fetchExistingRequest = async (ym: string) => {
        setLoading(true)
        try {
            const res = await fetch(`/api/shifts/requests?yearMonth=${ym}`)
            const data = await res.json()
            if (res.ok && data.length > 0) {
                const request = data[0]
                const loadedEntries: Record<string, ShiftEntry> = {}
                request.shiftEntries.forEach((e: any) => {
                    const dStr = e.date.split('T')[0]
                    loadedEntries[dStr] = {
                        date: dStr,
                        startTime: e.startTime ? format(new Date(e.startTime), 'HH:mm') : '09:00',
                        endTime: e.endTime ? format(new Date(e.endTime), 'HH:mm') : '18:00',
                        isRest: e.isRest,
                        note: e.note || ''
                    }
                })
                setEntries((prev) => ({ ...prev, ...loadedEntries }))
            }
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const handleEntryChange = (date: string, field: keyof ShiftEntry, value: any) => {
        setEntries(prev => ({
            ...prev,
            [date]: {
                ...prev[date],
                [field]: value
            }
        }))
    }

    const handleSubmit = async () => {
        setLoading(true)
        setMessage(null)
        try {
            const payloadEntries = Object.values(entries).map(e => {
                const baseDate = e.date
                return {
                    date: baseDate,
                    startTime: e.isRest ? null : `${baseDate}T${e.startTime}`,
                    endTime: e.isRest ? null : `${baseDate}T${e.endTime}`,
                    isRest: e.isRest,
                    note: e.note
                }
            })

            const res = await fetch('/api/shifts/requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ yearMonth: targetYearMonth, entries: payloadEntries })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            setMessage({ type: 'success', text: 'シフト希望を提出しました。' })
        } catch (error) {
            setMessage({ type: 'error', text: error instanceof Error ? error.message : '提出に失敗しました' })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            <h1 className="text-xl font-bold text-slate-800">シフト希望提出</h1>

            {deadlineWarning && (
                <div className="alert alert-error">
                    <strong>注意:</strong> 毎月20日の締切を過ぎています。管理者に別途ご相談ください。
                </div>
            )}

            {message && (
                <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
                    {message.text}
                </div>
            )}

            <div className="card">
                <div className="mb-4 flex items-center justify-between">
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
                        onClick={handleSubmit}
                        disabled={loading}
                        className="btn btn-primary"
                    >
                        {loading ? '送信中...' : 'シフトを提出・更新する'}
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-y border-slate-200 text-sm font-medium text-slate-500">
                                <th className="p-3">日付</th>
                                <th className="p-3 w-24">休み希望</th>
                                <th className="p-3">開始時間</th>
                                <th className="p-3">終了時間</th>
                                <th className="p-3">備考</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {Object.values(entries).sort((a, b) => a.date.localeCompare(b.date)).map(entry => {
                                const dayObj = new Date(entry.date)
                                const isWeekend = dayObj.getDay() === 0 || dayObj.getDay() === 6
                                return (
                                    <tr key={entry.date} className={isWeekend ? 'bg-slate-50' : 'hover:bg-slate-50'}>
                                        <td className="p-3">
                                            <div className="font-medium text-slate-700">
                                                {format(dayObj, 'M/d (E)', { locale: ja })}
                                            </div>
                                        </td>
                                        <td className="p-3 text-center">
                                            <input
                                                type="checkbox"
                                                checked={entry.isRest}
                                                onChange={(e) => handleEntryChange(entry.date, 'isRest', e.target.checked)}
                                                className="h-5 w-5 text-primary-600 rounded border-slate-300 focus:ring-primary-500"
                                            />
                                        </td>
                                        <td className="p-3">
                                            <input
                                                type="time"
                                                value={entry.startTime}
                                                onChange={(e) => handleEntryChange(entry.date, 'startTime', e.target.value)}
                                                disabled={entry.isRest}
                                                className="input"
                                            />
                                        </td>
                                        <td className="p-3">
                                            <input
                                                type="time"
                                                value={entry.endTime}
                                                onChange={(e) => handleEntryChange(entry.date, 'endTime', e.target.value)}
                                                disabled={entry.isRest}
                                                className="input"
                                            />
                                        </td>
                                        <td className="p-3">
                                            <input
                                                type="text"
                                                value={entry.note}
                                                onChange={(e) => handleEntryChange(entry.date, 'note', e.target.value)}
                                                placeholder="希望事項等"
                                                className="input w-full"
                                            />
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
