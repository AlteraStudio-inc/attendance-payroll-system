'use client'

import { useState, useEffect, useCallback } from 'react'

interface AuditLog {
    id: string
    action: string
    targetType: string
    targetId: string
    createdAt: string
    ipAddress: string | null
    actor: {
        id: string
        email: string | null
        role: string
        employee: { id: string; employeeCode: string; name: string } | null
    } | null
    beforeJson: string | null
    afterJson: string | null
    metadataJson: string | null
}

interface Pagination {
    total: number
    page: number
    limit: number
    totalPages: number
}

const actionColorMap: Record<string, string> = {
    CREATE: 'bg-green-100 text-green-700',
    UPDATE: 'bg-blue-100 text-blue-700',
    DELETE: 'bg-red-100 text-red-700',
    DEACTIVATE: 'bg-orange-100 text-orange-700',
    FINALIZE: 'bg-purple-100 text-purple-700',
    CALCULATE: 'bg-cyan-100 text-cyan-700',
    LOGIN: 'bg-slate-100 text-slate-600',
    LOGOUT: 'bg-slate-100 text-slate-600',
}

function getActionColor(action: string): string {
    const key = Object.keys(actionColorMap).find((k) => action.startsWith(k))
    return key ? actionColorMap[key] : 'bg-slate-100 text-slate-600'
}

export default function AuditLogsPage() {
    const [logs, setLogs] = useState<AuditLog[]>([])
    const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 50, totalPages: 1 })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [expandedId, setExpandedId] = useState<string | null>(null)

    const [filters, setFilters] = useState({
        action: '',
        targetType: '',
        from: '',
        to: '',
        page: 1,
    })

    const fetchLogs = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (filters.action) params.set('action', filters.action)
            if (filters.targetType) params.set('targetType', filters.targetType)
            if (filters.from) params.set('from', filters.from)
            if (filters.to) params.set('to', filters.to)
            params.set('page', filters.page.toString())
            params.set('limit', '50')

            const res = await fetch(`/api/admin/audit-logs?${params}`, { credentials: 'include' })
            const data = await res.json()

            if (!res.ok || !data.success) throw new Error(data.error?.message || '取得に失敗しました')
            setLogs(data.data.logs)
            setPagination(data.data.pagination)
        } catch (err) {
            setError(err instanceof Error ? err.message : '取得に失敗しました')
        } finally {
            setLoading(false)
        }
    }, [filters])

    useEffect(() => { fetchLogs() }, [fetchLogs])

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        setFilters((prev) => ({ ...prev, [name]: value, page: 1 }))
    }

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr)
        return d.toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">監査ログ</h1>
                <p className="text-sm text-slate-500 mt-0.5">システム操作の履歴を確認します</p>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                    {error} <button onClick={() => setError('')} className="ml-2">✕</button>
                </div>
            )}

            {/* フィルター */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">アクション</label>
                        <input
                            type="text"
                            name="action"
                            value={filters.action}
                            onChange={handleFilterChange}
                            placeholder="例: CREATE_EMPLOYEE"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">対象タイプ</label>
                        <select
                            name="targetType"
                            value={filters.targetType}
                            onChange={handleFilterChange}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">すべて</option>
                            <option value="employee">従業員</option>
                            <option value="department">部門</option>
                            <option value="payroll_run">給与計算</option>
                            <option value="allowance_type">手当種別</option>
                            <option value="statutory_rate_master">法定控除率</option>
                            <option value="work_schedule">勤務カレンダー</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">開始日</label>
                        <input
                            type="date"
                            name="from"
                            value={filters.from}
                            onChange={handleFilterChange}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">終了日</label>
                        <input
                            type="date"
                            name="to"
                            value={filters.to}
                            onChange={handleFilterChange}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
            </div>

            {/* 件数 */}
            <div className="text-sm text-slate-500">
                全 {pagination.total.toLocaleString()} 件 / {pagination.page} ページ目（{pagination.totalPages}ページ中）
            </div>

            {/* 一覧 */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-sm">ログが見つかりません</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-slate-50">
                                    <th className="text-left font-medium text-slate-600 px-4 py-3 border-b border-slate-200">日時</th>
                                    <th className="text-left font-medium text-slate-600 px-4 py-3 border-b border-slate-200">操作者</th>
                                    <th className="text-left font-medium text-slate-600 px-4 py-3 border-b border-slate-200">アクション</th>
                                    <th className="text-left font-medium text-slate-600 px-4 py-3 border-b border-slate-200">対象</th>
                                    <th className="text-left font-medium text-slate-600 px-4 py-3 border-b border-slate-200">IPアドレス</th>
                                    <th className="text-left font-medium text-slate-600 px-4 py-3 border-b border-slate-200">詳細</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log) => (
                                    <>
                                        <tr key={log.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 border-b border-slate-100 text-xs text-slate-500 whitespace-nowrap font-mono">
                                                {formatDate(log.createdAt)}
                                            </td>
                                            <td className="px-4 py-3 border-b border-slate-100">
                                                {log.actor?.employee ? (
                                                    <div>
                                                        <div className="font-medium text-slate-800">{log.actor.employee.name}</div>
                                                        <div className="text-xs text-slate-500 font-mono">{log.actor.employee.employeeCode}</div>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-500 text-xs">{log.actor?.email ?? 'システム'}</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 border-b border-slate-100">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getActionColor(log.action)}`}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 border-b border-slate-100 text-xs text-slate-600">
                                                <div>{log.targetType}</div>
                                                <div className="font-mono text-slate-400 truncate max-w-[120px]">{log.targetId}</div>
                                            </td>
                                            <td className="px-4 py-3 border-b border-slate-100 text-xs text-slate-500 font-mono">
                                                {log.ipAddress ?? '-'}
                                            </td>
                                            <td className="px-4 py-3 border-b border-slate-100">
                                                {((log.beforeJson as string | null) || (log.afterJson as string | null) || (log.metadataJson as string | null)) && (
                                                    <button
                                                        onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                                                        className="text-blue-600 hover:text-blue-800 text-xs"
                                                    >
                                                        {expandedId === log.id ? '閉じる' : '詳細'}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                        {expandedId === log.id && (
                                            <tr key={`${log.id}-detail`}>
                                                <td colSpan={6} className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                                                    <div className="grid sm:grid-cols-3 gap-4 text-xs">
                                                        {log.beforeJson && (
                                                            <div>
                                                                <div className="font-medium text-slate-600 mb-1">変更前</div>
                                                                <pre className="bg-white border border-slate-200 rounded p-2 text-slate-700 overflow-auto max-h-40">
                                                                    {log.beforeJson as string}
                                                                </pre>
                                                            </div>
                                                        )}
                                                        {log.afterJson && (
                                                            <div>
                                                                <div className="font-medium text-slate-600 mb-1">変更後</div>
                                                                <pre className="bg-white border border-slate-200 rounded p-2 text-slate-700 overflow-auto max-h-40">
                                                                    {log.afterJson as string}
                                                                </pre>
                                                            </div>
                                                        )}
                                                        {log.metadataJson && (
                                                            <div>
                                                                <div className="font-medium text-slate-600 mb-1">メタデータ</div>
                                                                <pre className="bg-white border border-slate-200 rounded p-2 text-slate-700 overflow-auto max-h-40">
                                                                    {log.metadataJson as string}
                                                                </pre>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ページネーション */}
            {pagination.totalPages > 1 && (
                <div className="flex justify-center gap-2">
                    <button
                        disabled={pagination.page <= 1}
                        onClick={() => setFilters((prev) => ({ ...prev, page: prev.page - 1 }))}
                        className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        ← 前
                    </button>
                    <span className="px-4 py-2 text-sm text-slate-600">
                        {pagination.page} / {pagination.totalPages}
                    </span>
                    <button
                        disabled={pagination.page >= pagination.totalPages}
                        onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
                        className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        次 →
                    </button>
                </div>
            )}
        </div>
    )
}
