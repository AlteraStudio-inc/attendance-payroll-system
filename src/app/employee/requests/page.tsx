'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Request {
    id: string
    type: 'work_time' | 'paid_leave'
    status: 'PENDING' | 'APPROVED' | 'REJECTED'
    date: string
    reason: string | null
    createdAt: string
}

export default function EmployeeRequestsPage() {
    const [requests, setRequests] = useState<Request[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchRequests = async () => {
            try {
                const res = await fetch('/api/employee/requests')
                const data = await res.json()
                if (res.ok) {
                    setRequests(data.requests || [])
                }
            } catch (error) {
                console.error('Failed to fetch:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchRequests()
    }, [])

    const statusBadge = (status: string) => {
        const styles = {
            PENDING: 'badge badge-pending',
            APPROVED: 'badge badge-approved',
            REJECTED: 'badge badge-rejected',
        }
        const labels = {
            PENDING: '審査中',
            APPROVED: '承認',
            REJECTED: '却下',
        }
        return <span className={styles[status as keyof typeof styles]}>{labels[status as keyof typeof labels]}</span>
    }

    const typeBadge = (type: string) => {
        return type === 'work_time' ? '修正' : '有給'
    }

    return (
        <div className="space-y-4">
            <h1 className="text-xl font-bold text-slate-800">申請一覧</h1>

            {/* 新規申請ボタン */}
            <div className="grid grid-cols-2 gap-3">
                <Link href="/employee/requests/new" className="btn btn-primary text-center">
                    修正申請
                </Link>
                <Link href="/employee/requests/leave" className="btn btn-secondary text-center">
                    有給申請
                </Link>
            </div>

            {/* 申請一覧 */}
            {loading ? (
                <div className="flex justify-center py-8">
                    <div className="spinner w-8 h-8"></div>
                </div>
            ) : requests.length === 0 ? (
                <p className="text-center text-slate-500 py-8">申請履歴がありません</p>
            ) : (
                <div className="space-y-2">
                    {requests.map((req) => (
                        <div key={req.id} className="card p-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">{typeBadge(req.type)}</span>
                                        {statusBadge(req.status)}
                                    </div>
                                    <div className="text-sm text-slate-600 mt-1">
                                        {new Date(req.date).toLocaleDateString('ja-JP')}
                                    </div>
                                    {req.reason && (
                                        <div className="text-xs text-slate-500 mt-1 truncate max-w-xs">{req.reason}</div>
                                    )}
                                </div>
                                <div className="text-xs text-slate-400">
                                    {new Date(req.createdAt).toLocaleDateString('ja-JP')}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
