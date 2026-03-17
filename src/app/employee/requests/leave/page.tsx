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
            const res = await fetch('/api/employee/requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'paid_leave',
                    leaveDate,
                    reason: reason || undefined,
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

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <button onClick={() => router.back()} className="text-slate-500 hover:text-slate-700">
                    ← 戻る
                </button>
                <h1 className="text-xl font-bold text-slate-800">有給休暇申請</h1>
            </div>

            {error && (
                <div className="bg-red-100 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            取得希望日 <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="date"
                            value={leaveDate}
                            onChange={(e) => setLeaveDate(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            min={new Date().toISOString().split('T')[0]}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">理由（任意）</label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none text-sm"
                            placeholder="理由があれば入力してください"
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
