'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface Employee {
    id: string
    employeeCode: string
    name: string
    email: string
    role: 'EMPLOYEE' | 'ADMIN'
    employmentType: string
    wageType: string
    hourlyRate: number | null
    monthlySalary: number | null
    isActive: boolean
}

export default function EmployeesPage() {
    const [employees, setEmployees] = useState<Employee[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [includeInactive, setIncludeInactive] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null)

    const employmentTypeLabels: Record<string, string> = {
        FULL_TIME: '正社員',
        CONTRACT: '契約社員',
        PART_TIME: 'パート',
        HOURLY: 'アルバイト',
    }

    const wageTypeLabels: Record<string, string> = {
        HOURLY: '時給制',
        FIXED: '固定給',
    }

    const fetchEmployees = useCallback(async () => {
        try {
            const params = new URLSearchParams()
            if (search) params.set('search', search)
            if (includeInactive) params.set('includeInactive', 'true')

            const res = await fetch(`/api/employees?${params}`)
            const data = await res.json()

            if (!res.ok) throw new Error(data.error)

            setEmployees(data.employees)
        } catch (err) {
            setError(err instanceof Error ? err.message : '取得に失敗しました')
        } finally {
            setLoading(false)
        }
    }, [search, includeInactive])

    useEffect(() => {
        fetchEmployees()
    }, [fetchEmployees])

    const handleDelete = async () => {
        if (!deleteTarget) return

        try {
            const res = await fetch(`/api/employees/${deleteTarget.id}`, {
                method: 'DELETE',
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error)
            }

            setDeleteTarget(null)
            fetchEmployees()
        } catch (err) {
            setError(err instanceof Error ? err.message : '削除に失敗しました')
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-800">従業員管理</h1>
                <Link href="/admin/employees/new" className="btn btn-primary">
                    新規追加
                </Link>
            </div>

            {error && (
                <div className="alert alert-error">{error}</div>
            )}

            {/* 検索・フィルター */}
            <div className="card">
                <div className="flex flex-col sm:flex-row gap-4">
                    <input
                        type="text"
                        placeholder="名前・コード・メールで検索..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="input flex-1"
                    />
                    <label className="flex items-center gap-2 text-slate-700">
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
            <div className="card p-0">
                {loading ? (
                    <div className="p-8 text-center">
                        <div className="spinner w-8 h-8 mx-auto"></div>
                    </div>
                ) : employees.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        従業員が見つかりません
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>コード</th>
                                    <th>氏名</th>
                                    <th>メール</th>
                                    <th>雇用形態</th>
                                    <th>給与形態</th>
                                    <th>状態</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {employees.map((emp) => (
                                    <tr key={emp.id} className={!emp.isActive ? 'opacity-50' : ''}>
                                        <td className="font-mono">{emp.employeeCode}</td>
                                        <td className="font-medium">{emp.name}</td>
                                        <td className="text-slate-600">{emp.email}</td>
                                        <td>{employmentTypeLabels[emp.employmentType]}</td>
                                        <td>
                                            {wageTypeLabels[emp.wageType]}
                                            {emp.wageType === 'HOURLY' && emp.hourlyRate && (
                                                <span className="text-slate-500 text-sm ml-1">
                                                    (¥{emp.hourlyRate.toLocaleString()})
                                                </span>
                                            )}
                                            {emp.wageType === 'FIXED' && emp.monthlySalary && (
                                                <span className="text-slate-500 text-sm ml-1">
                                                    (¥{emp.monthlySalary.toLocaleString()})
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <span className={`badge ${emp.isActive ? 'badge-approved' : 'badge-rejected'}`}>
                                                {emp.isActive ? '在籍' : '退職'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="flex gap-2">
                                                <Link
                                                    href={`/admin/employees/${emp.id}`}
                                                    className="text-primary-600 hover:text-primary-800"
                                                >
                                                    編集
                                                </Link>
                                                <button
                                                    onClick={() => setDeleteTarget(emp)}
                                                    className="text-red-600 hover:text-red-800"
                                                >
                                                    削除
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

            {/* 削除確認ダイアログ */}
            {deleteTarget && (
                <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-slate-800 mb-4">
                            従業員の削除確認
                        </h3>
                        <p className="text-slate-600 mb-6">
                            本当に <strong>{deleteTarget.name}</strong>（{deleteTarget.employeeCode}）を削除しますか？
                            <br />
                            <span className="text-sm text-slate-500">
                                ※ 削除後も勤怠データは保持されます
                            </span>
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                className="btn btn-secondary"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handleDelete}
                                className="btn btn-danger"
                            >
                                削除する
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
