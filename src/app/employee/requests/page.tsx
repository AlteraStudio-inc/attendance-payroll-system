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
                if (res.ok && data.success) {
                    setRequests(data.data?.requests || data.data || [])
                }
            } catch (error) {
                console.error('Failed to fetch:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchRequests()
    }, [])

    const statusInfo = (status: string) => {
        switch (status) {
            case 'PENDING': return { label: '審査中', color: 'bg-yellow-100 text-yellow-700' }
            case 'APPROVED': return { label: '承認', color: 'bg-green-100 text-green-700' }
            case 'REJECTED': return { label: '却下', color: 'bg-red-100 text-red-700' }
            default: return { label: status, color: 'bg-slate-100 text-slate-600' }
        }
    }

    const typeLabel = (type: string) =>
        type === 'work_time' ? '打刻修正' : '有給申請'

    return (
        <div className="space-y-4">
            <h1 className="text-xl font-bold text-slate-800">申請一覧</h1>

            {/* 新規申請ボタン */}
            <div className="grid grid-cols-2 gap-3">
                <Link
                    href="/employee/requests/new"
                    className="bg-blue-600 text-white text-center py-3 rounded-xl font-medium text-sm hover:bg-blue-700 transition-colors shadow-sm"
                >
                    修正申請
                </Link>
                <Link
                    href="/employee/requests/leave"
                    className="bg-white text-blue-600 border border-blue-600 text-center py-3 rounded-xl font-medium text-sm hover:bg-blue-50 transition-colors shadow-sm"
                >
                    有給申請
                </Link>
            </div>

            {/* 申請一覧 */}
            {loading ? (
                <div className="flex justify-center py-8">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : requests.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                    <div className="text-4xl mb-3">📝</div>
                    <p>申請履歴がありません</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {requests.map((req) => {
                        const s = statusInfo(req.status)
                        return (
                            <div key={req.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                                                {typeLabel(req.type)}
                                            </span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>
                                                {s.label}
                                            </span>
                                        </div>
                                        <div className="text-sm font-medium text-slate-800">
                                            {new Date(req.date).toLocaleDateString('ja-JP')}
                                        </div>
                                        {req.reason && (
                                            <div className="text-xs text-slate-500 mt-1 truncate">{req.reason}</div>
                                        )}
                                    </div>
                                    <div className="text-xs text-slate-400 flex-shrink-0 ml-2">
                                        {new Date(req.createdAt).toLocaleDateString('ja-JP')}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
