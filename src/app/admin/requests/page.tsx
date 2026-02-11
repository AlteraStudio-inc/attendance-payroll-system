'use client'

import { useState, useEffect } from 'react'

interface WorkTimeRequest {
    id: string
    employee: { name: string; employeeCode: string }
    timeEntry: { date: string; clockIn: string; clockOut: string | null }
    requestedClockIn: string
    requestedClockOut: string
    reason: string
    status: 'PENDING' | 'APPROVED' | 'REJECTED'
    reviewedBy: { name: string } | null
    reviewedAt: string | null
    createdAt: string
}

interface PaidLeaveRequest {
    id: string
    employee: { name: string; employeeCode: string }
    leaveDate: string
    reason: string | null
    status: 'PENDING' | 'APPROVED' | 'REJECTED'
    reviewedBy: { name: string } | null
    reviewedAt: string | null
    createdAt: string
}

export default function RequestsPage() {
    const [workTimeRequests, setWorkTimeRequests] = useState<WorkTimeRequest[]>([])
    const [paidLeaveRequests, setPaidLeaveRequests] = useState<PaidLeaveRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [filter, setFilter] = useState<'all' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING')
    const [tab, setTab] = useState<'work_time' | 'paid_leave'>('work_time')
    const [processing, setProcessing] = useState<string | null>(null)

    const fetchRequests = async () => {
        try {
            const res = await fetch(`/api/requests?status=${filter}`)
            const data = await res.json()
            if (res.ok) {
                setWorkTimeRequests(data.workTimeRequests || [])
                setPaidLeaveRequests(data.paidLeaveRequests || [])
            }
        } catch (err) {
            setError('取得に失敗しました')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchRequests()
    }, [filter])

    const handleProcess = async (id: string, type: string, action: 'approve' | 'reject') => {
        if (!confirm(`この申請を${action === 'approve' ? '承認' : '却下'}しますか？`)) return

        setProcessing(id)
        try {
            const res = await fetch(`/api/requests/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, action }),
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error)
            }

            fetchRequests()
        } catch (err) {
            setError(err instanceof Error ? err.message : '処理に失敗しました')
        } finally {
            setProcessing(null)
        }
    }

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('ja-JP')
    }

    const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
    }

    const statusBadge = (status: string) => {
        const colors = {
            PENDING: 'badge-pending',
            APPROVED: 'badge-approved',
            REJECTED: 'badge-rejected',
        }
        const labels = {
            PENDING: '保留中',
            APPROVED: '承認',
            REJECTED: '却下',
        }
        return <span className={`badge ${colors[status as keyof typeof colors]}`}>{labels[status as keyof typeof labels]}</span>
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-slate-800">申請管理</h1>

            {error && <div className="alert alert-error">{error}</div>}

            {/* フィルター */}
            <div className="card">
                <div className="flex flex-wrap gap-4">
                    <div className="flex gap-2">
                        {(['all', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((s) => (
                            <button
                                key={s}
                                onClick={() => setFilter(s)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === s
                                        ? 'bg-primary-600 text-white'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                            >
                                {s === 'all' ? 'すべて' : s === 'PENDING' ? '保留中' : s === 'APPROVED' ? '承認済み' : '却下'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* タブ */}
            <div className="flex border-b border-slate-200">
                <button
                    onClick={() => setTab('work_time')}
                    className={`px-6 py-3 font-medium border-b-2 transition-colors ${tab === 'work_time'
                            ? 'border-primary-600 text-primary-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                >
                    労働時間修正 ({workTimeRequests.length})
                </button>
                <button
                    onClick={() => setTab('paid_leave')}
                    className={`px-6 py-3 font-medium border-b-2 transition-colors ${tab === 'paid_leave'
                            ? 'border-primary-600 text-primary-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                >
                    有給申請 ({paidLeaveRequests.length})
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="spinner w-10 h-10"></div>
                </div>
            ) : (
                <div className="card p-0">
                    {tab === 'work_time' ? (
                        workTimeRequests.length === 0 ? (
                            <p className="p-8 text-center text-slate-500">申請がありません</p>
                        ) : (
                            <div className="table-container">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>従業員</th>
                                            <th>対象日</th>
                                            <th>現在</th>
                                            <th>申請内容</th>
                                            <th>理由</th>
                                            <th>状態</th>
                                            <th>操作</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {workTimeRequests.map((req) => (
                                            <tr key={req.id}>
                                                <td>
                                                    <div className="font-medium">{req.employee.name}</div>
                                                    <div className="text-sm text-slate-500">{req.employee.employeeCode}</div>
                                                </td>
                                                <td>{formatDate(req.timeEntry.date)}</td>
                                                <td className="text-sm">
                                                    {formatTime(req.timeEntry.clockIn)} - {req.timeEntry.clockOut ? formatTime(req.timeEntry.clockOut) : '-'}
                                                </td>
                                                <td className="text-sm text-primary-600">
                                                    {formatTime(req.requestedClockIn)} - {formatTime(req.requestedClockOut)}
                                                </td>
                                                <td className="max-w-xs truncate">{req.reason}</td>
                                                <td>{statusBadge(req.status)}</td>
                                                <td>
                                                    {req.status === 'PENDING' && (
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => handleProcess(req.id, 'work_time', 'approve')}
                                                                disabled={processing === req.id}
                                                                className="text-green-600 hover:text-green-800 font-medium"
                                                            >
                                                                承認
                                                            </button>
                                                            <button
                                                                onClick={() => handleProcess(req.id, 'work_time', 'reject')}
                                                                disabled={processing === req.id}
                                                                className="text-red-600 hover:text-red-800 font-medium"
                                                            >
                                                                却下
                                                            </button>
                                                        </div>
                                                    )}
                                                    {req.reviewedBy && (
                                                        <span className="text-sm text-slate-500">
                                                            {req.reviewedBy.name}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    ) : paidLeaveRequests.length === 0 ? (
                        <p className="p-8 text-center text-slate-500">申請がありません</p>
                    ) : (
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>従業員</th>
                                        <th>有給日</th>
                                        <th>理由</th>
                                        <th>申請日</th>
                                        <th>状態</th>
                                        <th>操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paidLeaveRequests.map((req) => (
                                        <tr key={req.id}>
                                            <td>
                                                <div className="font-medium">{req.employee.name}</div>
                                                <div className="text-sm text-slate-500">{req.employee.employeeCode}</div>
                                            </td>
                                            <td>{formatDate(req.leaveDate)}</td>
                                            <td className="max-w-xs truncate">{req.reason || '-'}</td>
                                            <td className="text-sm text-slate-500">{formatDate(req.createdAt)}</td>
                                            <td>{statusBadge(req.status)}</td>
                                            <td>
                                                {req.status === 'PENDING' && (
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleProcess(req.id, 'paid_leave', 'approve')}
                                                            disabled={processing === req.id}
                                                            className="text-green-600 hover:text-green-800 font-medium"
                                                        >
                                                            承認
                                                        </button>
                                                        <button
                                                            onClick={() => handleProcess(req.id, 'paid_leave', 'reject')}
                                                            disabled={processing === req.id}
                                                            className="text-red-600 hover:text-red-800 font-medium"
                                                        >
                                                            却下
                                                        </button>
                                                    </div>
                                                )}
                                                {req.reviewedBy && (
                                                    <span className="text-sm text-slate-500">
                                                        {req.reviewedBy.name}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
