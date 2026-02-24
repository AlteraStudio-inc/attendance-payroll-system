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
    note: string
}

export default function AttendancePage() {
    const [entries, setEntries] = useState<TimeEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [selectedDate, setSelectedDate] = useState(() => {
        const now = new Date()
        return now.toISOString().split('T')[0]
    })
    const [view, setView] = useState<'day' | 'week' | 'month' | 'employee_monthly'>('day')
    const [employees, setEmployees] = useState<{ id: string; name: string }[]>([])
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
    const [downloadingPdf, setDownloadingPdf] = useState(false)

    useEffect(() => {
        const fetchEmployees = async () => {
            try {
                const res = await fetch('/api/employees')
                if (res.ok) {
                    const data = await res.json()
                    setEmployees(data.employees || [])
                    if (data.employees?.length > 0) setSelectedEmployeeId(data.employees[0].id)
                }
            } catch (error) {
                console.error(error)
            }
        }
        fetchEmployees()
    }, [])

    const handleDownloadPdf = async () => {
        if (!selectedEmployeeId) return
        setDownloadingPdf(true)
        setError('')
        try {
            const res = await fetch('/api/attendance/pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employeeId: selectedEmployeeId,
                    yearMonth: selectedDate.substring(0, 7)
                })
            })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'PDF生成に失敗しました')
            }

            const blob = await res.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `出勤簿_${selectedDate.substring(0, 7)}.pdf`
            document.body.appendChild(a)
            a.click()
            a.remove()
            window.URL.revokeObjectURL(url)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'エラーが発生しました')
        } finally {
            setDownloadingPdf(false)
        }
    }

    const fetchEntries = useCallback(async () => {
        try {
            const url = `/api/attendance?date=${selectedDate}&view=${view}${view === 'employee_monthly' && selectedEmployeeId ? '&employeeId=' + selectedEmployeeId : ''}`
            const res = await fetch(url)
            const data = await res.json()
            if (res.ok) {
                setEntries(data.entries || [])
            }
        } catch (err) {
            setError('取得に失敗しました')
        } finally {
            setLoading(false)
        }
    }, [selectedDate, view, selectedEmployeeId])

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
                    {(['day', 'week', 'month', 'employee_monthly'] as const).map((v) => (
                        <button
                            key={v}
                            onClick={() => setView(v)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === v
                                ? 'bg-primary-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            {v === 'day' ? '日' : v === 'week' ? '週' : v === 'month' ? '月' : '従業員別'}
                        </button>
                    ))}
                </div>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            {/* 日付選択 */}
            <div className="card">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-4">
                        <label className="text-sm font-medium text-slate-700">表示期間:</label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="input w-auto"
                        />
                    </div>
                    {view === 'employee_monthly' && (
                        <div className="flex items-center gap-4 border-l pl-4 border-slate-200">
                            <label className="text-sm font-medium text-slate-700">対象従業員:</label>
                            <select
                                value={selectedEmployeeId}
                                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                                className="input w-auto min-w-[200px]"
                            >
                                <option value="">選択してください</option>
                                {employees.map((emp) => (
                                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                                ))}
                            </select>
                            <button
                                onClick={handleDownloadPdf}
                                disabled={downloadingPdf || !selectedEmployeeId}
                                className="btn btn-primary ml-2"
                            >
                                {downloadingPdf ? '生成中...' : '出勤簿PDFを出力'}
                            </button>
                        </div>
                    )}
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
                                    <th>備考</th>
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
                                        <td className="text-sm text-slate-600 truncate max-w-[150px]" title={entry.note || ''}>
                                            {entry.note || '-'}
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
