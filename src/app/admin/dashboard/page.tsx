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
    employeeCode: string
    clockIn: string | null
    clockOut: string | null
}

export default function AdminDashboard() {
    const [stats, setStats] = useState<Stats | null>(null)
    const [recentClockIns, setRecentClockIns] = useState<RecentClockIn[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('/api/admin/dashboard', { credentials: 'include' })
                const data = await res.json()
                if (res.ok && data.success) {
                    setStats(data.data.stats)
                    setRecentClockIns(data.data.recentClockIns || [])
                } else {
                    setError(data.error?.message || 'データの取得に失敗しました')
                }
            } catch (err) {
                console.error('Dashboard fetch error:', err)
                setError('ネットワークエラーが発生しました')
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        )
    }

    const statCards = [
        {
            label: '総従業員数',
            value: stats?.totalEmployees ?? '-',
            sub: `在籍: ${stats?.activeEmployees ?? '-'}名`,
            color: 'text-slate-800',
            bg: 'bg-slate-50',
        },
        {
            label: '本日の出勤',
            value: stats?.todayClockIns ?? '-',
            sub: <Link href="/admin/attendance" className="text-sm text-blue-600 hover:underline">詳細を見る →</Link>,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
        },
        {
            label: '未処理の申請',
            value: stats?.pendingRequests ?? '-',
            sub: '要確認',
            color: 'text-orange-600',
            bg: 'bg-orange-50',
        },
        {
            label: '未確定の給与',
            value: stats?.unconfirmedPayrolls ?? '-',
            sub: <Link href="/admin/payroll" className="text-sm text-blue-600 hover:underline">給与管理 →</Link>,
            color: 'text-yellow-600',
            bg: 'bg-yellow-50',
        },
    ]

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-800">ダッシュボード</h1>
                <span className="text-sm text-slate-500">
                    {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
                </span>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                    {error}
                </div>
            )}

            {/* 統計カード */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((card) => (
                    <div key={card.label} className={`${card.bg} rounded-xl border border-slate-200 p-5`}>
                        <div className="text-sm text-slate-500 mb-2">{card.label}</div>
                        <div className={`text-3xl font-bold ${card.color} mb-1`}>{card.value}</div>
                        <div className="text-sm text-slate-500">{card.sub}</div>
                    </div>
                ))}
            </div>

            {/* クイックアクション */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h2 className="text-base font-semibold text-slate-800 mb-4">クイックアクション</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Link
                        href="/admin/employees/new"
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        従業員追加
                    </Link>
                    <Link
                        href="/admin/payroll"
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-slate-700 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors"
                    >
                        給与計算
                    </Link>
                    <Link
                        href="/admin/departments"
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-slate-700 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors"
                    >
                        部門管理
                    </Link>
                    <Link
                        href="/admin/work-schedules"
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-slate-700 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors"
                    >
                        勤務カレンダー
                    </Link>
                </div>
            </div>

            {/* 最近の打刻 */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-base font-semibold text-slate-800">本日の打刻</h2>
                    <Link href="/admin/attendance" className="text-sm text-blue-600 hover:underline">
                        すべて表示
                    </Link>
                </div>

                {recentClockIns.length === 0 ? (
                    <p className="text-slate-500 text-center py-8 text-sm">本日の打刻はありません</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-slate-50">
                                    <th className="text-left font-medium text-slate-600 px-3 py-2 border border-slate-200">従業員名</th>
                                    <th className="text-left font-medium text-slate-600 px-3 py-2 border border-slate-200">コード</th>
                                    <th className="text-left font-medium text-slate-600 px-3 py-2 border border-slate-200">出勤</th>
                                    <th className="text-left font-medium text-slate-600 px-3 py-2 border border-slate-200">退勤</th>
                                    <th className="text-left font-medium text-slate-600 px-3 py-2 border border-slate-200">状態</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentClockIns.map((entry) => (
                                    <tr key={entry.id} className="hover:bg-slate-50">
                                        <td className="px-3 py-2 border border-slate-200 font-medium text-slate-800">{entry.employeeName}</td>
                                        <td className="px-3 py-2 border border-slate-200 font-mono text-slate-500">{entry.employeeCode}</td>
                                        <td className="px-3 py-2 border border-slate-200">{entry.clockIn ?? '-'}</td>
                                        <td className="px-3 py-2 border border-slate-200">{entry.clockOut ?? '-'}</td>
                                        <td className="px-3 py-2 border border-slate-200">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                                entry.clockOut
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-blue-100 text-blue-700'
                                            }`}>
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
