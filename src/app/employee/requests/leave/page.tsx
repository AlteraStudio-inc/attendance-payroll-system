'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LeaveRequestPage() {
    const router = useRouter()
    const [leaveDate, setLeaveDate] = useState('')
    const [reason, setReason] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!leaveDate) {
            setError('有給取得日を選択してください')
            return
        }

        setSubmitting(true)
        setError('')

        try {
            const res = await fetch('/api/requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'paid_leave',
                    leaveDate,
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

    return (
        <div className="space-y-4">
            <h1 className="text-xl font-bold text-slate-800">有給休暇申請</h1>

            {error && <div className="alert alert-error">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="card">
                    <label className="block text-sm font-medium text-slate-700 mb-2">取得希望日</label>
                    <input
                        type="date"
                        value={leaveDate}
                        onChange={(e) => setLeaveDate(e.target.value)}
                        className="input w-full"
                        min={new Date().toISOString().split('T')[0]}
                    />
                </div>

                <div className="card">
                    <label className="block text-sm font-medium text-slate-700 mb-2">理由（任意）</label>
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="input w-full h-24"
                        placeholder="理由があれば入力してください"
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
