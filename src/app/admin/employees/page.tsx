'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface Department {
    id: string
    code: string
    name: string
}

interface SalarySetting {
    monthlySalary: number | null
    hourlyRate: number | null
}

interface Employee {
    id: string
    employeeCode: string
    name: string
    email: string | null
    employmentType: string
    payType: string
    active: boolean
    joinDate: string | null
    department: Department | null
    salarySettings: SalarySetting[]
}

const employmentTypeLabels: Record<string, string> = {
    full_time: '正社員',
    contract: '契約社員',
    part_time: 'パート',
    hourly: 'アルバイト',
    FULL_TIME: '正社員',
    CONTRACT: '契約社員',
    PART_TIME: 'パート',
    HOURLY: 'アルバイト',
}

const payTypeLabels: Record<string, string> = {
    monthly: '月給制',
    hourly: '時給制',
    daily: '日給制',
}

export default function EmployeesPage() {
    const [employees, setEmployees] = useState<Employee[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [includeInactive, setIncludeInactive] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null)
    const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 })

    const fetchEmployees = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (search) params.set('search', search)
            if (!includeInactive) params.set('active', 'true')
            params.set('limit', '50')

            const res = await fetch(`/api/admin/employees?${params}`, { credentials: 'include' })
            const data = await res.json()

            if (!res.ok || !data.success) throw new Error(data.error?.message || '取得に失敗しました')

            setEmployees(data.data.employees)
            setPagination(data.data.pagination)
        } catch (err) {
            setError(err instanceof Error ? err.message : '取得に失敗しました')
        } finally {
            setLoading(false)
        }
    }, [search, includeInactive])

    useEffect(() => {
        const timer = setTimeout(() => fetchEmployees(), 300)
        return () => clearTimeout(timer)
    }, [fetchEmployees])

    const handleDelete = async () => {
        if (!deleteTarget) return

        try {
            const res = await fetch(`/api/admin/employees/${deleteTarget.id}`, {
                method: 'DELETE',
                credentials: 'include',
            })

            const data = await res.json()
            if (!res.ok || !data.success) throw new Error(data.error?.message || '削除に失敗しました')

            setDeleteTarget(null)
            fetchEmployees()
        } catch (err) {
            setError(err instanceof Error ? err.message : '削除に失敗しました')
            setDeleteTarget(null)
        }
    }

    const latestSalary = (emp: Employee) => {
        const s = emp.salarySettings?.[0]
        if (!s) return '-'
        if (s.hourlyRate) return `¥${s.hourlyRate.toLocaleString()}/時`
        if (s.monthlySalary) return `¥${s.monthlySalary.toLocaleString()}/月`
        return '-'
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">従業員管理</h1>
                    <p className="text-sm text-slate-500 mt-0.5">全{pagination.total}名</p>
                </div>
                <Link
                    href="/admin/employees/new"
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                    + 新規追加
                </Link>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                    {error}
                    <button onClick={() => setError('')} className="ml-2 text-red-500 hover:text-red-700">✕</button>
                </div>
            )}

            {/* 検索・フィルター */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                    <input
                        type="text"
                        placeholder="名前・コード・メールで検索..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                            type="checkbox"
                            checked={includeInactive}
                            onChange={(e) => setIncludeInactive(e.target.checked)}
                            className="rounded border-slate-300"
                        />
                        退職者を含む
                    </label>
                </div>
            </div>

            {/* 従業員一覧 */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    </div>
                ) : employees.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-sm">
                        従業員が見つかりません
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-slate-50">
                                    <th className="text-left font-medium text-slate-600 px-4 py-3 border-b border-slate-200">コード</th>
                                    <th className="text-left font-medium text-slate-600 px-4 py-3 border-b border-slate-200">氏名</th>
                                    <th className="text-left font-medium text-slate-600 px-4 py-3 border-b border-slate-200">部門</th>
                                    <th className="text-left font-medium text-slate-600 px-4 py-3 border-b border-slate-200">雇用形態</th>
                                    <th className="text-left font-medium text-slate-600 px-4 py-3 border-b border-slate-200">給与形態</th>
                                    <th className="text-left font-medium text-slate-600 px-4 py-3 border-b border-slate-200">給与</th>
                                    <th className="text-left font-medium text-slate-600 px-4 py-3 border-b border-slate-200">状態</th>
                                    <th className="text-left font-medium text-slate-600 px-4 py-3 border-b border-slate-200">操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {employees.map((emp) => (
                                    <tr key={emp.id} className={`hover:bg-slate-50 ${!emp.active ? 'opacity-60' : ''}`}>
                                        <td className="px-4 py-3 border-b border-slate-100 font-mono text-slate-600">{emp.employeeCode}</td>
                                        <td className="px-4 py-3 border-b border-slate-100">
                                            <div className="font-medium text-slate-800">{emp.name}</div>
                                            {emp.email && <div className="text-xs text-slate-500">{emp.email}</div>}
                                        </td>
                                        <td className="px-4 py-3 border-b border-slate-100 text-slate-700">
                                            {emp.department?.name ?? <span className="text-slate-400">未設定</span>}
                                        </td>
                                        <td className="px-4 py-3 border-b border-slate-100 text-slate-700">
                                            {employmentTypeLabels[emp.employmentType] || emp.employmentType}
                                        </td>
                                        <td className="px-4 py-3 border-b border-slate-100 text-slate-700">
                                            {payTypeLabels[emp.payType] || emp.payType}
                                        </td>
                                        <td className="px-4 py-3 border-b border-slate-100 text-slate-700 font-mono text-xs">
                                            {latestSalary(emp)}
                                        </td>
                                        <td className="px-4 py-3 border-b border-slate-100">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                                emp.active
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-slate-100 text-slate-600'
                                            }`}>
                                                {emp.active ? '在籍' : '退職'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 border-b border-slate-100">
                                            <div className="flex gap-3">
                                                <Link
                                                    href={`/admin/employees/${emp.id}`}
                                                    className="text-blue-600 hover:text-blue-800 font-medium"
                                                >
                                                    編集
                                                </Link>
                                                <button
                                                    onClick={() => setDeleteTarget(emp)}
                                                    className="text-red-600 hover:text-red-800"
                                                >
                                                    無効化
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* 無効化確認ダイアログ */}
            {deleteTarget && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDeleteTarget(null)}>
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-slate-800 mb-2">従業員の無効化</h3>
                        <p className="text-slate-600 mb-6">
                            <strong>{deleteTarget.name}</strong>（{deleteTarget.employeeCode}）を無効化しますか？
                            <br />
                            <span className="text-sm text-slate-500">※ 勤怠・給与データは保持されます</span>
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handleDelete}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
                            >
                                無効化する
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
