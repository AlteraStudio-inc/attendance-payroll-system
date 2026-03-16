'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, subMonths, addMonths } from 'date-fns'
import { ja } from 'date-fns/locale'

interface PayrollItem {
    id: string
    employeeId: string
    employeeName: string
    employeeCode: string
    isActive: boolean
    baseSalary: number
    overtimePay: number
    holidayPay: number
    deemedOvertimePay: number
    grossSalary: number
    socialInsurance: number
    employmentInsurance: number
    incomeTax: number
    totalDeductions: number
    netSalary: number
    workHours: number
    overtimeHours: number
    holidayHours: number
}

interface PayrollRun {
    id: string
    yearMonth: string
    status: 'DRAFT' | 'CONFIRMED' | 'REVERTED'
    confirmedBy: string | null
    confirmedAt: string | null
}

type EditableField = keyof Omit<PayrollItem, 'id' | 'employeeId' | 'employeeName' | 'employeeCode' | 'isActive'>

interface EditState {
    [employeeId: string]: Partial<Record<EditableField, number>>
}

const FIELD_CONFIG: { key: EditableField; label: string; group: 'hours' | 'salary' | 'deduction' }[] = [
    { key: 'workHours', label: '勤務時間(h)', group: 'hours' },
    { key: 'overtimeHours', label: '残業時間(h)', group: 'hours' },
    { key: 'holidayHours', label: '休日時間(h)', group: 'hours' },
    { key: 'baseSalary', label: '基本給', group: 'salary' },
    { key: 'overtimePay', label: '残業代', group: 'salary' },
    { key: 'holidayPay', label: '休日出勤手当', group: 'salary' },
    { key: 'deemedOvertimePay', label: 'みなし残業代', group: 'salary' },
    { key: 'grossSalary', label: '総支給額', group: 'salary' },
    { key: 'socialInsurance', label: '社会保険料', group: 'deduction' },
    { key: 'employmentInsurance', label: '雇用保険料', group: 'deduction' },
    { key: 'incomeTax', label: '所得税', group: 'deduction' },
    { key: 'totalDeductions', label: '控除合計', group: 'deduction' },
    { key: 'netSalary', label: '差引支給額', group: 'salary' },
]

export default function PayrollAdjustmentPage() {
    const [payrollRun, setPayrollRun] = useState<PayrollRun | null>(null)
    const [items, setItems] = useState<PayrollItem[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState<Record<string, boolean>>({})
    const [currentMonth, setCurrentMonth] = useState(
        format(subMonths(new Date(), 1), 'yyyy-MM')
    )
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [editState, setEditState] = useState<EditState>({})
    const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null)

    const fetchPayroll = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const res = await fetch(`/api/payroll/adjustment?month=${currentMonth}`)
            const data = await res.json()
            if (res.ok) {
                setPayrollRun(data.payrollRun)
                setItems(data.items || [])
                setEditState({})
                setExpandedEmployee(null)
            } else {
                setError(data.error || 'データの取得に失敗しました')
            }
        } catch (err) {
            console.error('Failed to fetch payroll:', err)
            setError('データの取得に失敗しました')
        } finally {
            setLoading(false)
        }
    }, [currentMonth])

    useEffect(() => {
        fetchPayroll()
    }, [fetchPayroll])

    const handleFieldChange = (employeeId: string, field: EditableField, value: string) => {
        const numValue = value === '' ? 0 : parseFloat(value)
        if (isNaN(numValue)) return

        setEditState((prev) => ({
            ...prev,
            [employeeId]: {
                ...prev[employeeId],
                [field]: numValue,
            },
        }))
    }

    const getFieldValue = (item: PayrollItem, field: EditableField): number => {
        const edited = editState[item.employeeId]
        if (edited && field in edited) {
            return edited[field]!
        }
        return item[field]
    }

    const hasChanges = (employeeId: string): boolean => {
        const edited = editState[employeeId]
        if (!edited) return false

        const item = items.find((i) => i.employeeId === employeeId)
        if (!item) return false

        return Object.entries(edited).some(([key, value]) => {
            return item[key as EditableField] !== value
        })
    }

    const handleSave = async (item: PayrollItem) => {
        const edited = editState[item.employeeId]
        if (!edited || !hasChanges(item.employeeId)) return

        // Build updates only for changed fields
        const updates: Partial<Record<EditableField, number>> = {}
        for (const [key, value] of Object.entries(edited)) {
            if (item[key as EditableField] !== value) {
                updates[key as EditableField] = value
            }
        }

        setSaving((prev) => ({ ...prev, [item.employeeId]: true }))
        setError('')
        setSuccess('')

        try {
            const res = await fetch('/api/payroll/adjustment', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payrollItemId: item.id,
                    updates,
                }),
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            // Update item in list with returned data
            setItems((prev) =>
                prev.map((i) =>
                    i.id === item.id
                        ? { ...i, ...data.item }
                        : i
                )
            )

            // Clear edit state for this employee
            setEditState((prev) => {
                const next = { ...prev }
                delete next[item.employeeId]
                return next
            })

            setSuccess(`${item.employeeName}さんの給与を修正しました`)
            setTimeout(() => setSuccess(''), 3000)
        } catch (err) {
            setError(err instanceof Error ? err.message : '修正に失敗しました')
        } finally {
            setSaving((prev) => ({ ...prev, [item.employeeId]: false }))
        }
    }

    const handleReset = (employeeId: string) => {
        setEditState((prev) => {
            const next = { ...prev }
            delete next[employeeId]
            return next
        })
    }

    const [pdfProcessing, setPdfProcessing] = useState<Record<string, boolean>>({})

    const handleGeneratePdf = async (employeeId: string) => {
        setPdfProcessing((prev) => ({ ...prev, [employeeId]: true }))
        try {
            const res = await fetch('/api/payroll/pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ yearMonth: currentMonth, employeeId }),
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error)
            }

            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            window.open(url, '_blank')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'PDF生成に失敗しました')
        } finally {
            setPdfProcessing((prev) => ({ ...prev, [employeeId]: false }))
        }
    }

    const handleGenerateWageLedger = async (employeeId: string) => {
        setPdfProcessing((prev) => ({ ...prev, [employeeId]: true }))
        try {
            const res = await fetch('/api/payroll/wage-ledger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ yearMonth: currentMonth, employeeId }),
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error)
            }

            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            window.open(url, '_blank')
        } catch (err) {
            setError(err instanceof Error ? err.message : '賃金台帳の生成に失敗しました')
        } finally {
            setPdfProcessing((prev) => ({ ...prev, [employeeId]: false }))
        }
    }

    const formatCurrency = (amount: number) => '¥' + amount.toLocaleString()

    const statusBadge = (status: string) => {
        const colors: Record<string, string> = {
            DRAFT: 'badge-draft',
            CONFIRMED: 'badge-confirmed',
            REVERTED: 'badge-pending',
        }
        const labels: Record<string, string> = {
            DRAFT: '下書き',
            CONFIRMED: '確定',
            REVERTED: '差し戻し',
        }
        return <span className={`badge ${colors[status]}`}>{labels[status]}</span>
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">前月修正</h1>
                    <p className="text-sm text-slate-500 mt-1">給与明細の各項目を個別に修正できます</p>
                </div>

                {/* 月選択 */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() =>
                            setCurrentMonth(format(subMonths(new Date(currentMonth + '-01'), 1), 'yyyy-MM'))
                        }
                        className="btn btn-secondary"
                    >
                        &larr;
                    </button>
                    <span className="text-lg font-medium px-4">
                        {format(new Date(currentMonth + '-01'), 'yyyy年M月', { locale: ja })}
                    </span>
                    <button
                        onClick={() =>
                            setCurrentMonth(format(addMonths(new Date(currentMonth + '-01'), 1), 'yyyy-MM'))
                        }
                        className="btn btn-secondary"
                    >
                        &rarr;
                    </button>
                </div>
            </div>

            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            {/* ステータス表示 */}
            <div className="card">
                <div className="flex items-center gap-4">
                    <div>
                        <div className="text-sm text-slate-500">ステータス</div>
                        <div className="flex items-center gap-3 mt-1">
                            {payrollRun ? (
                                <>
                                    {statusBadge(payrollRun.status)}
                                    {payrollRun.confirmedBy && (
                                        <span className="text-sm text-slate-500">
                                            {payrollRun.confirmedBy}が確定
                                        </span>
                                    )}
                                </>
                            ) : (
                                <span className="text-slate-500">この月の給与データがありません</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 従業員一覧 */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="spinner w-10 h-10"></div>
                </div>
            ) : items.length === 0 ? (
                <div className="card text-center text-slate-500 py-12">
                    この月の給与データがありません。<br />
                    先に給与管理画面で給与計算を実行してください。
                </div>
            ) : (
                <div className="space-y-4">
                    {items.map((item) => {
                        const isExpanded = expandedEmployee === item.employeeId
                        const changed = hasChanges(item.employeeId)
                        const isSaving = saving[item.employeeId] || false

                        return (
                            <div key={item.id} className="card p-0 overflow-hidden">
                                {/* ヘッダー行 */}
                                <button
                                    onClick={() =>
                                        setExpandedEmployee(isExpanded ? null : item.employeeId)
                                    }
                                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors text-left"
                                >
                                    <div className="flex items-center gap-4">
                                        <div
                                            className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                                                item.isActive ? 'bg-primary-600' : 'bg-slate-400'
                                            }`}
                                        >
                                            {item.employeeName.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="font-medium text-slate-800">
                                                {item.employeeName}
                                                {!item.isActive && (
                                                    <span className="ml-2 text-xs text-slate-400">(無効)</span>
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-500">{item.employeeCode}</div>
                                        </div>
                                        {changed && (
                                            <span className="badge bg-orange-100 text-orange-800">未保存の変更あり</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="flex gap-2 items-center">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleGeneratePdf(item.employeeId)
                                                }}
                                                disabled={pdfProcessing[item.employeeId]}
                                                className="text-primary-600 hover:text-primary-800 text-xs px-2 py-1 border border-primary-200 rounded hover:bg-primary-50 transition-colors"
                                            >
                                                給与明細
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleGenerateWageLedger(item.employeeId)
                                                }}
                                                disabled={pdfProcessing[item.employeeId]}
                                                className="text-green-600 hover:text-green-800 text-xs px-2 py-1 border border-green-200 rounded hover:bg-green-50 transition-colors"
                                            >
                                                賃金台帳
                                            </button>
                                        </div>
                                        <div className="text-right hidden sm:block">
                                            <div className="text-xs text-slate-500">差引支給額</div>
                                            <div className="font-bold text-primary-600">
                                                {formatCurrency(getFieldValue(item, 'netSalary'))}
                                            </div>
                                        </div>
                                        <svg
                                            className={`w-5 h-5 text-slate-400 transition-transform ${
                                                isExpanded ? 'rotate-180' : ''
                                            }`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M19 9l-7 7-7-7"
                                            />
                                        </svg>
                                    </div>
                                </button>

                                {/* 編集フォーム */}
                                {isExpanded && (
                                    <div className="border-t border-slate-200 px-6 py-5 bg-slate-50">
                                        {/* 勤務時間 */}
                                        <div className="mb-6">
                                            <h3 className="text-sm font-semibold text-slate-700 mb-3">
                                                勤務時間
                                            </h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                {FIELD_CONFIG.filter((f) => f.group === 'hours').map(
                                                    (field) => (
                                                        <div key={field.key}>
                                                            <label className="block text-xs text-slate-500 mb-1">
                                                                {field.label}
                                                            </label>
                                                            <input
                                                                type="number"
                                                                step="0.1"
                                                                value={getFieldValue(item, field.key)}
                                                                onChange={(e) =>
                                                                    handleFieldChange(
                                                                        item.employeeId,
                                                                        field.key,
                                                                        e.target.value
                                                                    )
                                                                }
                                                                className={`input text-sm ${
                                                                    editState[item.employeeId]?.[field.key] !== undefined &&
                                                                    editState[item.employeeId]?.[field.key] !== item[field.key]
                                                                        ? 'border-orange-400 bg-orange-50'
                                                                        : ''
                                                                }`}
                                                            />
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        </div>

                                        {/* 支給項目 */}
                                        <div className="mb-6">
                                            <h3 className="text-sm font-semibold text-slate-700 mb-3">
                                                支給項目
                                            </h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {FIELD_CONFIG.filter(
                                                    (f) => f.group === 'salary' && f.key !== 'netSalary'
                                                ).map((field) => (
                                                    <div key={field.key}>
                                                        <label className="block text-xs text-slate-500 mb-1">
                                                            {field.label}
                                                        </label>
                                                        <input
                                                            type="number"
                                                            step="1"
                                                            value={getFieldValue(item, field.key)}
                                                            onChange={(e) =>
                                                                handleFieldChange(
                                                                    item.employeeId,
                                                                    field.key,
                                                                    e.target.value
                                                                )
                                                            }
                                                            className={`input text-sm ${
                                                                editState[item.employeeId]?.[field.key] !== undefined &&
                                                                editState[item.employeeId]?.[field.key] !== item[field.key]
                                                                    ? 'border-orange-400 bg-orange-50'
                                                                    : ''
                                                            }`}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* 控除項目 */}
                                        <div className="mb-6">
                                            <h3 className="text-sm font-semibold text-slate-700 mb-3">
                                                控除項目
                                            </h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                                {FIELD_CONFIG.filter((f) => f.group === 'deduction').map(
                                                    (field) => (
                                                        <div key={field.key}>
                                                            <label className="block text-xs text-slate-500 mb-1">
                                                                {field.label}
                                                            </label>
                                                            <input
                                                                type="number"
                                                                step="1"
                                                                value={getFieldValue(item, field.key)}
                                                                onChange={(e) =>
                                                                    handleFieldChange(
                                                                        item.employeeId,
                                                                        field.key,
                                                                        e.target.value
                                                                    )
                                                                }
                                                                className={`input text-sm ${
                                                                    editState[item.employeeId]?.[field.key] !== undefined &&
                                                                    editState[item.employeeId]?.[field.key] !== item[field.key]
                                                                        ? 'border-orange-400 bg-orange-50'
                                                                        : ''
                                                                }`}
                                                            />
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        </div>

                                        {/* 差引支給額 */}
                                        <div className="mb-6">
                                            <h3 className="text-sm font-semibold text-slate-700 mb-3">
                                                最終金額
                                            </h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-xs text-slate-500 mb-1">
                                                        差引支給額
                                                    </label>
                                                    <input
                                                        type="number"
                                                        step="1"
                                                        value={getFieldValue(item, 'netSalary')}
                                                        onChange={(e) =>
                                                            handleFieldChange(
                                                                item.employeeId,
                                                                'netSalary',
                                                                e.target.value
                                                            )
                                                        }
                                                        className={`input text-sm font-bold ${
                                                            editState[item.employeeId]?.netSalary !== undefined &&
                                                            editState[item.employeeId]?.netSalary !== item.netSalary
                                                                ? 'border-orange-400 bg-orange-50'
                                                                : ''
                                                        }`}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* アクションボタン */}
                                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                                            <button
                                                onClick={() => handleReset(item.employeeId)}
                                                disabled={!changed || isSaving}
                                                className="btn btn-secondary text-sm"
                                            >
                                                リセット
                                            </button>
                                            <button
                                                onClick={() => handleSave(item)}
                                                disabled={!changed || isSaving}
                                                className="btn btn-primary text-sm"
                                            >
                                                {isSaving ? (
                                                    <span className="flex items-center gap-2">
                                                        <div className="spinner w-4 h-4"></div>
                                                        保存中...
                                                    </span>
                                                ) : (
                                                    '保存'
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
