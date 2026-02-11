'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface TimeEntry {
    id: string
    date: string
    clockIn: string
    clockOut: string | null
}

export default function NewRequestPage() {
    const router = useRouter()
    const [entries, setEntries] = useState<TimeEntry[]>([])
    const [timeEntryId, setTimeEntryId] = useState('')
    const [clockIn, setClockIn] = useState('')
    const [clockOut, setClockOut] = useState('')
    const [reason, setReason] = useState('')
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        const fetchEntries = async () => {
            try {
                const res = await fetch('/api/employee/attendance')
                const data = await res.json()
                if (res.ok) {
                    setEntries(data.entries || [])
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
        setTimeEntryId(id)
        const entry = entries.find((e) => e.id === id)
        if (entry) {
            const inDate = new Date(entry.clockIn)
            setClockIn(`${String(inDate.getHours()).padStart(2, '0')}:${String(inDate.getMinutes()).padStart(2, '0')}`)
            if (entry.clockOut) {
                const outDate = new Date(entry.clockOut)
                setClockOut(`${String(outDate.getHours()).padStart(2, '0')}:${String(outDate.getMinutes()).padStart(2, '0')}`)
            } else {
                setClockOut('')
            }
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!timeEntryId || !clockIn || !clockOut || !reason) {
            setError('すべての項目を入力してください')
            return
        }

        setSubmitting(true)
        setError('')

        try {
            const entry = entries.find((e) => e.id === timeEntryId)
            if (!entry) throw new Error('勤怠データが選択されていません')

            const dateStr = new Date(entry.date).toISOString().split('T')[0]
            const requestedClockIn = new Date(`${dateStr}T${clockIn}:00`)
            const requestedClockOut = new Date(`${dateStr}T${clockOut}:00`)

            const res = await fetch('/api/requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'work_time',
                    timeEntryId,
                    requestedClockIn: requestedClockIn.toISOString(),
                    requestedClockOut: requestedClockOut.toISOString(),
                    reason,
                }),
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            router.push('/employee/requests')
        } catch (err) {
            setError(err instanceof Error ? err.message : '申請に失敗しました')
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <div className="spinner w-8 h-8"></div>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <h1 className="text-xl font-bold text-slate-800">勤怠修正申請</h1>

            {error && <div className="alert alert-error">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="card">
                    <label className="block text-sm font-medium text-slate-700 mb-2">対象日</label>
                    <select
                        value={timeEntryId}
                        onChange={(e) => handleEntryChange(e.target.value)}
                        className="input w-full"
                    >
                        <option value="">選択してください</option>
                        {entries.map((e) => (
                            <option key={e.id} value={e.id}>
                                {new Date(e.date).toLocaleDateString('ja-JP')} (
                                {new Date(e.clockIn).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} -
                                {e.clockOut ? new Date(e.clockOut).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '未退勤'})
                            </option>
                        ))}
                    </select>
                </div>

                <div className="card">
                    <label className="block text-sm font-medium text-slate-700 mb-2">修正後の出勤時刻</label>
                    <input
                        type="time"
                        value={clockIn}
                        onChange={(e) => setClockIn(e.target.value)}
                        className="input w-full"
                    />
                </div>

                <div className="card">
                    <label className="block text-sm font-medium text-slate-700 mb-2">修正後の退勤時刻</label>
                    <input
                        type="time"
                        value={clockOut}
                        onChange={(e) => setClockOut(e.target.value)}
                        className="input w-full"
                    />
                </div>

                <div className="card">
                    <label className="block text-sm font-medium text-slate-700 mb-2">申請理由</label>
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="input w-full h-24"
                        placeholder="修正が必要な理由を入力してください"
                    />
                </div>

                <button
                    type="submit"
                    disabled={submitting}
                    className="btn btn-primary w-full"
                >
                    {submitting ? '送信中...' : '申請する'}
                </button>
            </form>
        </div>
    )
}
