'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface AttendanceEntry {
    id: string
    date: string
    clockIn: string | null
    clockOut: string | null
}

export default function NewRequestPage() {
    const router = useRouter()
    const [entries, setEntries] = useState<AttendanceEntry[]>([])
    const [entryId, setEntryId] = useState('')
    const [clockIn, setClockIn] = useState('')
    const [clockOut, setClockOut] = useState('')
    const [reason, setReason] = useState('')
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        const fetchEntries = async () => {
            try {
                const now = new Date()
                const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
                const res = await fetch(`/api/employee/attendance?month=${month}`)
                const data = await res.json()
                if (res.ok && data.success) {
                    const all = data.data?.entries || []
                    setEntries(all.filter((e: AttendanceEntry) => e.clockIn))
                }
            } catch (err) {
                console.error('Failed to fetch:', err)
            } finally {
                setLoading(false)
            }
        }
        fetchEntries()
    }, [])

    const handleEntryChange = (id: string) => {
        setEntryId(id)
        const entry = entries.find((e) => e.id === id)
        if (entry) {
            if (entry.clockIn) {
                const d = new Date(entry.clockIn)
                setClockIn(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)
            }
            if (entry.clockOut) {
                const d = new Date(entry.clockOut)
                setClockOut(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)
            } else {
                setClockOut('')
            }
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!entryId || !clockIn || !clockOut || !reason) {
            setError('すべての項目を入力してください')
            return
        }

        setSubmitting(true)
        setError('')

        try {
            const entry = entries.find((e) => e.id === entryId)
            if (!entry) throw new Error('勤怠データが選択されていません')

            const dateStr = new Date(entry.date).toISOString().split('T')[0]

            const res = await fetch('/api/employee/requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'work_time',
                    timeEntryId: entryId,
                    requestedClockIn: new Date(`${dateStr}T${clockIn}:00`).toISOString(),
                    requestedClockOut: new Date(`${dateStr}T${clockOut}:00`).toISOString(),
                    reason,
                }),
            })

            const data = await res.json()
            if (!res.ok || !data.success) throw new Error(data.error || '申請に失敗しました')

            router.push('/employee/requests')
        } catch (err) {
            setError(err instanceof Error ? err.message : '申請に失敗しました')
        } finally {
            setSubmitting(false)
        }
    }

    const formatEntry = (entry: AttendanceEntry) => {
        const date = new Date(entry.date).toLocaleDateString('ja-JP')
        const ci = entry.clockIn
            ? new Date(entry.clockIn).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
            : '--:--'
        const co = entry.clockOut
            ? new Date(entry.clockOut).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
            : '未退勤'
        return `${date} (${ci} - ${co})`
    }

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <button onClick={() => router.back()} className="text-slate-500 hover:text-slate-700">
                    ← 戻る
                </button>
                <h1 className="text-xl font-bold text-slate-800">勤怠修正申請</h1>
            </div>

            {error && (
                <div className="bg-red-100 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">対象日 <span className="text-red-500">*</span></label>
                        <select
                            value={entryId}
                            onChange={(e) => handleEntryChange(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                            required
                        >
                            <option value="">選択してください</option>
                            {entries.map((e) => (
                                <option key={e.id} value={e.id}>{formatEntry(e)}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">修正後の出勤 <span className="text-red-500">*</span></label>
                            <input
                                type="time"
                                value={clockIn}
                                onChange={(e) => setClockIn(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">修正後の退勤 <span className="text-red-500">*</span></label>
                            <input
                                type="time"
                                value={clockOut}
                                onChange={(e) => setClockOut(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">申請理由 <span className="text-red-500">*</span></label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none text-sm"
                            placeholder="修正が必要な理由を入力してください"
                            required
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
                >
                    {submitting ? '送信中...' : '申請する'}
                </button>
            </form>
        </div>
    )
}
