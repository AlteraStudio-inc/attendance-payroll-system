'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Stats {
    totalEmployees: number
    activeEmployees: number
    todayClockIns: number
    pendingRequests: number
    unconfirmedPayrolls: number
}

interface RecentClockIn {
    id: string
    employeeName: string
    clockIn: string
    clockOut: string | null
}

export default function AdminDashboard() {
    const [stats, setStats] = useState<Stats | null>(null)
    const [recentClockIns, setRecentClockIns] = useState<RecentClockIn[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('/api/admin/dashboard')
                const data = await res.json()
                if (res.ok) {
                    setStats(data.stats)
                    setRecentClockIns(data.recentClockIns || [])
                }
            } catch (error) {
                console.error('Dashboard fetch error:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="spinner w-12 h-12"></div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-slate-800">ダッシュボード</h1>

            {/* 統計カード */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card">
                    <div className="text-sm text-slate-500 mb-1">総従業員数</div>
                    <div className="text-3xl font-bold text-slate-800">
                        {stats?.totalEmployees ?? '-'}
                    </div>
                    <div className="text-sm text-slate-500">
                        在籍: {stats?.activeEmployees ?? '-'}名
                    </div>
                </div>

                <div className="card">
                    <div className="text-sm text-slate-500 mb-1">本日の出勤</div>
                    <div className="text-3xl font-bold text-primary-600">
                        {stats?.todayClockIns ?? '-'}
                    </div>
                    <Link href="/admin/attendance" className="text-sm text-primary-600 hover:underline">
                        詳細を見る →
                    </Link>
                </div>

                <div className="card">
                    <div className="text-sm text-slate-500 mb-1">未処理の申請</div>
                    <div className="text-3xl font-bold text-orange-500">
                        {stats?.pendingRequests ?? '-'}
                    </div>
                    <Link href="/admin/requests" className="text-sm text-primary-600 hover:underline">
                        申請を確認 →
                    </Link>
                </div>

                <div className="card">
                    <div className="text-sm text-slate-500 mb-1">未確定の給与</div>
                    <div className="text-3xl font-bold text-yellow-600">
                        {stats?.unconfirmedPayrolls ?? '-'}
                    </div>
                    <Link href="/admin/payroll" className="text-sm text-primary-600 hover:underline">
                        給与管理 →
                    </Link>
                </div>
            </div>

            {/* クイックアクション */}
            <div className="card">
                <h2 className="text-lg font-semibold text-slate-800 mb-4">クイックアクション</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Link href="/admin/employees/new" className="btn btn-secondary">
                        従業員追加
                    </Link>
                    <Link href="/admin/calendar" className="btn btn-secondary">
                        カレンダー設定
                    </Link>
                    <Link href="/admin/payroll" className="btn btn-secondary">
                        給与計算
                    </Link>
                    <Link href="/kiosk" className="btn btn-secondary" target="_blank">
                        打刻画面
                    </Link>
                </div>
            </div>

            {/* 最近の打刻 */}
            <div className="card">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-slate-800">本日の打刻</h2>
                    <Link href="/admin/attendance" className="text-sm text-primary-600 hover:underline">
                        すべて表示
                    </Link>
                </div>

                {recentClockIns.length === 0 ? (
                    <p className="text-slate-500 text-center py-4">本日の打刻はありません</p>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>従業員名</th>
                                    <th>出勤</th>
                                    <th>退勤</th>
                                    <th>状態</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentClockIns.map((entry) => (
                                    <tr key={entry.id}>
                                        <td className="font-medium">{entry.employeeName}</td>
                                        <td>{entry.clockIn}</td>
                                        <td>{entry.clockOut || '-'}</td>
                                        <td>
                                            <span className={`badge ${entry.clockOut ? 'badge-approved' : 'badge-pending'}`}>
                                                {entry.clockOut ? '退勤済' : '勤務中'}
                                            </span>
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
