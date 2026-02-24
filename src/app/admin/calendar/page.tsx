'use client'

import { useState, useEffect } from 'react'
import { format, addMonths, subMonths } from 'date-fns'
import { ja } from 'date-fns/locale'

interface CalendarDay {
    date: string
    dayOfWeek: number
    isHoliday: boolean
    note: string | null
    id: string | null
}

export default function CalendarPage() {
    const [calendar, setCalendar] = useState<CalendarDay[]>([])
    const [loading, setLoading] = useState(true)
    const [currentMonth, setCurrentMonth] = useState(format(new Date(), 'yyyy-MM'))
    const [saving, setSaving] = useState<string | null>(null)
    const [downloadingPdf, setDownloadingPdf] = useState(false)

    const fetchCalendar = async () => {
        try {
            const res = await fetch(`/api/calendar?month=${currentMonth}`)
            const data = await res.json()
            if (res.ok) {
                setCalendar(data.calendar)
            }
        } catch (error) {
            console.error('Failed to fetch calendar:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchCalendar()
    }, [currentMonth])

    const toggleHoliday = async (day: CalendarDay) => {
        setSaving(day.date)
        try {
            const res = await fetch('/api/calendar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: day.date,
                    isHoliday: !day.isHoliday,
                    note: day.note,
                }),
            })

            if (res.ok) {
                setCalendar((prev) =>
                    prev.map((d) =>
                        d.date === day.date ? { ...d, isHoliday: !d.isHoliday } : d
                    )
                )
            }
        } catch (error) {
            console.error('Failed to update:', error)
        } finally {
            setSaving(null)
        }
    }

    const goToPreviousMonth = () => {
        const date = new Date(currentMonth + '-01')
        setCurrentMonth(format(subMonths(date, 1), 'yyyy-MM'))
    }

    const goToNextMonth = () => {
        const date = new Date(currentMonth + '-01')
        setCurrentMonth(format(addMonths(date, 1), 'yyyy-MM'))
    }

    const handleDownloadPdf = async () => {
        setDownloadingPdf(true)
        try {
            const res = await fetch('/api/calendar/pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ yearMonth: currentMonth })
            })

            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'PDFの生成に失敗しました')
            }

            const blob = await res.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `calendar_${currentMonth}.pdf`
            document.body.appendChild(a)
            a.click()
            a.remove()
            window.URL.revokeObjectURL(url)
        } catch (error) {
            console.error('PDF download error:', error)
            alert(error instanceof Error ? error.message : 'PDFの生成に失敗しました')
        } finally {
            setDownloadingPdf(false)
        }
    }

    const dayNames = ['日', '月', '火', '水', '木', '金', '土']

    // カレンダーグリッド用のパディング
    const firstDayOfMonth = calendar[0]?.dayOfWeek ?? 0
    const paddingDays = Array(firstDayOfMonth).fill(null)

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <h1 className="text-2xl font-bold text-slate-800">営業カレンダー</h1>
                <button
                    onClick={handleDownloadPdf}
                    disabled={downloadingPdf}
                    className="btn btn-primary"
                >
                    {downloadingPdf ? 'PDF生成中...' : 'PDF出力'}
                </button>
            </div>

            {/* 月選択 */}
            <div className="card">
                <div className="flex items-center justify-between">
                    <button
                        onClick={goToPreviousMonth}
                        className="btn btn-secondary"
                    >
                        ← 前月
                    </button>
                    <h2 className="text-xl font-bold text-slate-800">
                        {format(new Date(currentMonth + '-01'), 'yyyy年 M月', { locale: ja })}
                    </h2>
                    <button
                        onClick={goToNextMonth}
                        className="btn btn-secondary"
                    >
                        翌月 →
                    </button>
                </div>
            </div>

            {/* カレンダー */}
            <div className="card">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="spinner w-10 h-10"></div>
                    </div>
                ) : (
                    <>
                        {/* 曜日ヘッダー */}
                        <div className="grid grid-cols-7 gap-1 mb-2">
                            {dayNames.map((name, i) => (
                                <div
                                    key={name}
                                    className={`text-center font-medium py-2 ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-600'
                                        }`}
                                >
                                    {name}
                                </div>
                            ))}
                        </div>

                        {/* 日付グリッド */}
                        <div className="grid grid-cols-7 gap-1">
                            {/* パディング */}
                            {paddingDays.map((_, i) => (
                                <div key={`pad-${i}`} className="h-20"></div>
                            ))}

                            {/* 日付 */}
                            {calendar.map((day) => (
                                <button
                                    key={day.date}
                                    onClick={() => toggleHoliday(day)}
                                    disabled={saving === day.date}
                                    className={`h-20 p-2 rounded-lg border transition-all text-left ${day.isHoliday
                                        ? 'bg-red-50 border-red-200 hover:bg-red-100'
                                        : 'bg-white border-slate-200 hover:bg-slate-50'
                                        } ${saving === day.date ? 'opacity-50' : ''}`}
                                >
                                    <div
                                        className={`font-bold ${day.dayOfWeek === 0 || day.isHoliday
                                            ? 'text-red-500'
                                            : day.dayOfWeek === 6
                                                ? 'text-blue-500'
                                                : 'text-slate-800'
                                            }`}
                                    >
                                        {new Date(day.date).getDate()}
                                    </div>
                                    <div className="text-xs mt-1">
                                        {day.isHoliday ? (
                                            <span className="text-red-500">休日</span>
                                        ) : (
                                            <span className="text-slate-400">営業日</span>
                                        )}
                                    </div>
                                    {day.note && (
                                        <div className="text-xs text-slate-500 truncate">{day.note}</div>
                                    )}
                                </button>
                            ))}
                        </div>

                        <div className="mt-4 text-sm text-slate-500">
                            ※ クリックで営業日/休日を切り替えられます
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
