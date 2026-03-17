'use client'

import { useState, useEffect } from 'react'

interface WorkSchedule {
    id: string
    targetDate: string
    dayType: string
    note: string | null
    departmentId: string | null
    department: { id: string; code: string; name: string } | null
}

interface Department {
    id: string
    code: string
    name: string
}

const dayTypeLabels: Record<string, string> = {
    workday: '営業日',
    holiday: '休日',
    national_holiday: '祝日',
    special_holiday: '特別休日',
    half_day: '半日勤務',
}

const dayTypeColors: Record<string, string> = {
    workday: 'bg-blue-50 text-blue-700 border-blue-200',
    holiday: 'bg-slate-100 text-slate-500 border-slate-200',
    national_holiday: 'bg-red-50 text-red-600 border-red-200',
    special_holiday: 'bg-purple-50 text-purple-600 border-purple-200',
    half_day: 'bg-yellow-50 text-yellow-700 border-yellow-200',
}

function getDaysInMonth(year: number, month: number): Date[] {
    const days: Date[] = []
    const date = new Date(year, month - 1, 1)
    while (date.getMonth() === month - 1) {
        days.push(new Date(date))
        date.setDate(date.getDate() + 1)
    }
    return days
}

export default function WorkSchedulesPage() {
    const today = new Date()
    const [year, setYear] = useState(today.getFullYear())
    const [month, setMonth] = useState(today.getMonth() + 1)
    const [companyId, setCompanyId] = useState('')
    const [departments, setDepartments] = useState<Department[]>([])
    const [filterDeptId, setFilterDeptId] = useState('')
    const [schedules, setSchedules] = useState<WorkSchedule[]>([])
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [editDate, setEditDate] = useState<string | null>(null)
    const [editForm, setEditForm] = useState({ dayType: 'workday', note: '', departmentId: '' })

    useEffect(() => {
        const init = async () => {
            try {
                const [meRes, deptRes] = await Promise.all([
                    fetch('/api/auth/me', { credentials: 'include' }),
                    fetch('/api/admin/departments', { credentials: 'include' }),
                ])
                const meData = await meRes.json()
                const deptData = await deptRes.json()
                const authUser = meData.data || meData.user
                if (authUser?.companyId) setCompanyId(authUser.companyId)
                if (deptData.success) setDepartments(deptData.data)
            } catch {
                setError('初期データの取得に失敗しました')
            }
        }
        init()
    }, [])

    useEffect(() => {
        if (!companyId) return
        const fetchSchedules = async () => {
            setLoading(true)
            try {
                const params = new URLSearchParams({ companyId, year: year.toString(), month: month.toString() })
                if (filterDeptId) params.set('departmentId', filterDeptId)
                const res = await fetch(`/api/admin/work-schedules?${params}`, { credentials: 'include' })
                const data = await res.json()
                if (data.success) setSchedules(data.data)
            } catch {
                setError('勤務カレンダーの取得に失敗しました')
            } finally {
                setLoading(false)
            }
        }
        fetchSchedules()
    }, [companyId, year, month, filterDeptId])

    const days = getDaysInMonth(year, month)

    const getScheduleForDate = (dateStr: string) => {
        return schedules.find((s) => s.targetDate.startsWith(dateStr) && s.departmentId === (filterDeptId || null))
    }

    const openEdit = (dateStr: string) => {
        const existing = getScheduleForDate(dateStr)
        setEditDate(dateStr)
        setEditForm({
            dayType: existing?.dayType ?? 'workday',
            note: existing?.note ?? '',
            departmentId: filterDeptId,
        })
    }

    const handleSave = async () => {
        if (!editDate || !companyId) return
        setSaving(true)
        setError('')

        try {
            const payload = {
                companyId,
                departmentId: editForm.departmentId || null,
                targetDate: editDate,
                dayType: editForm.dayType,
                note: editForm.note || null,
            }

            const res = await fetch('/api/admin/work-schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload),
            })
            const data = await res.json()
            if (!res.ok || !data.success) throw new Error(data.error?.message || '保存に失敗しました')

            setSuccess(`${editDate}のスケジュールを保存しました`)
            setEditDate(null)
            setTimeout(() => setSuccess(''), 3000)

            // Refresh
            const params = new URLSearchParams({ companyId, year: year.toString(), month: month.toString() })
            if (filterDeptId) params.set('departmentId', filterDeptId)
            const refreshRes = await fetch(`/api/admin/work-schedules?${params}`, { credentials: 'include' })
            const refreshData = await refreshRes.json()
            if (refreshData.success) setSchedules(refreshData.data)
        } catch (err) {
            setError(err instanceof Error ? err.message : '保存に失敗しました')
        } finally {
            setSaving(false)
        }
    }

    const prevMonth = () => {
        if (month === 1) { setYear(y => y - 1); setMonth(12) }
        else setMonth(m => m - 1)
    }
    const nextMonth = () => {
        if (month === 12) { setYear(y => y + 1); setMonth(1) }
        else setMonth(m => m + 1)
    }

    const weekDayLabels = ['日', '月', '火', '水', '木', '金', '土']

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">勤務カレンダー</h1>
                <p className="text-sm text-slate-500 mt-0.5">営業日・休日の設定を管理します</p>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                    {error} <button onClick={() => setError('')} className="ml-2">✕</button>
                </div>
            )}
            {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">{success}</div>
            )}

            {/* コントロール */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={prevMonth} className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">← 前月</button>
                    <span className="text-lg font-semibold text-slate-800 w-32 text-center">{year}年{month}月</span>
                    <button onClick={nextMonth} className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">次月 →</button>
                </div>
                <div className="flex items-center gap-3">
                    <label className="text-sm text-slate-600">部門フィルター:</label>
                    <select
                        value={filterDeptId}
                        onChange={(e) => setFilterDeptId(e.target.value)}
                        className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">全社共通</option>
                        {departments.map((d) => (
                            <option key={d.id} value={d.id}>[{d.code}] {d.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* 凡例 */}
            <div className="flex flex-wrap gap-2">
                {Object.entries(dayTypeLabels).map(([k, v]) => (
                    <span key={k} className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs border ${dayTypeColors[k]}`}>
                        {v}
                    </span>
                ))}
            </div>

            {/* カレンダー */}
            {loading ? (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    {/* 曜日ヘッダー */}
                    <div className="grid grid-cols-7 border-b border-slate-200">
                        {weekDayLabels.map((d, i) => (
                            <div key={d} className={`py-2 text-center text-sm font-medium ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-600'}`}>
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* 日付グリッド */}
                    <div className="grid grid-cols-7">
                        {/* 月初の空白 */}
                        {Array.from({ length: days[0].getDay() }).map((_, i) => (
                            <div key={`empty-${i}`} className="border-r border-b border-slate-100 min-h-[80px]"></div>
                        ))}

                        {days.map((day) => {
                            const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
                            const schedule = getScheduleForDate(dateStr)
                            const isToday = dateStr === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
                            const dow = day.getDay()
                            const isWeekend = dow === 0 || dow === 6
                            const dayType = schedule?.dayType ?? (isWeekend ? 'holiday' : 'workday')

                            return (
                                <button
                                    key={dateStr}
                                    onClick={() => openEdit(dateStr)}
                                    className={`border-r border-b border-slate-100 min-h-[80px] p-2 text-left hover:opacity-80 transition-opacity ${
                                        isWeekend && !schedule ? 'bg-slate-50' : ''
                                    }`}
                                >
                                    <div className={`text-sm font-medium mb-1 w-7 h-7 flex items-center justify-center rounded-full ${
                                        isToday ? 'bg-blue-600 text-white' : dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-slate-700'
                                    }`}>
                                        {day.getDate()}
                                    </div>
                                    <div className={`text-xs px-1.5 py-0.5 rounded border text-center ${dayTypeColors[dayType] ?? ''}`}>
                                        {dayTypeLabels[dayType] ?? dayType}
                                    </div>
                                    {schedule?.note && (
                                        <div className="text-xs text-slate-400 mt-1 truncate">{schedule.note}</div>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* 編集ダイアログ */}
            {editDate && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditDate(null)}>
                    <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-slate-800">{editDate} の設定</h3>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">日区分</label>
                            <select
                                value={editForm.dayType}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, dayType: e.target.value }))}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {Object.entries(dayTypeLabels).map(([v, l]) => (
                                    <option key={v} value={v}>{l}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">備考</label>
                            <input
                                type="text"
                                value={editForm.note}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, note: e.target.value }))}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="例: 創立記念日"
                            />
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setEditDate(null)} className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">
                                キャンセル
                            </button>
                            <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                                {saving ? '保存中...' : '保存'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
