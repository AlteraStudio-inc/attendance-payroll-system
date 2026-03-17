'use client'

import { useState, useEffect, useCallback } from 'react'

interface PayrollItem {
    id: string
    employeeId: string
    baseSalary: number
    allowanceTotal: number
    fixedOvertimeAllowance: number
    overtimePay: number
    withinScheduledOvertimePay: number
    scheduledHolidayPay: number
    legalHolidayPay: number
    lateNightPay: number
    incentivePay: number
    commutingPay: number
    grossPay: number
    lateDeduction: number
    earlyLeaveDeduction: number
    absenceDeduction: number
    healthInsurance: number
    nursingCareInsurance: number
    welfarePension: number
    employmentInsurance: number
    incomeTax: number
    residentTax: number
    otherDeductions: number
    totalDeductions: number
    netPay: number
    totalWorkDays: number
    totalWorkedMinutes: number
    totalOvertimeMinutes: number
    employee: {
        id: string
        employeeCode: string
        name: string
        department: { id: string; code: string; name: string } | null
    }
}

interface PayrollRun {
    id: string
    year: number
    month: number
    status: 'calculated' | 'finalized' | 'reverted'
    calculatedAt: string | null
    finalizedAt: string | null
    finalizedBy: string | null
    company: { id: string; name: string } | null
    _count: { payrollItems: number }
    payrollItems?: PayrollItem[]
}

const statusLabels: Record<string, string> = {
    calculated: '計算済み（未確定）',
    finalized: '確定済み',
    reverted: '差し戻し',
}

const statusColors: Record<string, string> = {
    calculated: 'bg-yellow-100 text-yellow-700',
    finalized: 'bg-green-100 text-green-700',
    reverted: 'bg-slate-100 text-slate-600',
}

function formatCurrency(n: number) {
    return '¥' + Math.round(n).toLocaleString()
}

function formatMinutes(mins: number) {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `${h}h${m > 0 ? `${m}m` : ''}`
}

export default function PayrollPage() {
    const today = new Date()
    const [year, setYear] = useState(today.getFullYear())
    const [month, setMonth] = useState(today.getMonth() + 1)
    const [companyId, setCompanyId] = useState('')
    const [runs, setRuns] = useState<PayrollRun[]>([])
    const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null)
    const [loadingList, setLoadingList] = useState(true)
    const [loadingDetail, setLoadingDetail] = useState(false)
    const [processing, setProcessing] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    useEffect(() => {
        const init = async () => {
            try {
                const meRes = await fetch('/api/auth/me', { credentials: 'include' })
                const meData = await meRes.json()
                const authUser = meData.data || meData.user
                if (authUser?.companyId) setCompanyId(authUser.companyId)
            } catch {
                setError('認証情報の取得に失敗しました')
            }
        }
        init()
    }, [])

    const fetchRuns = useCallback(async () => {
        if (!companyId) return
        setLoadingList(true)
        try {
            const params = new URLSearchParams({ companyId, year: year.toString() })
            const res = await fetch(`/api/admin/payroll-runs?${params}`, { credentials: 'include' })
            const data = await res.json()
            if (data.success) setRuns(data.data.runs)
        } catch {
            setError('給与データの取得に失敗しました')
        } finally {
            setLoadingList(false)
        }
    }, [companyId, year])

    useEffect(() => { fetchRuns() }, [fetchRuns])

    const currentRun = runs.find((r) => r.year === year && r.month === month)

    const fetchDetail = async (runId: string) => {
        setLoadingDetail(true)
        try {
            const res = await fetch(`/api/admin/payroll-runs/${runId}`, { credentials: 'include' })
            const data = await res.json()
            if (data.success) setSelectedRun(data.data)
        } catch {
            setError('詳細の取得に失敗しました')
        } finally {
            setLoadingDetail(false)
        }
    }

    const handleCalculate = async () => {
        if (!companyId) return
        if (!confirm(`${year}年${month}月の給与計算を実行しますか？\n既存の計算結果は上書きされます。`)) return

        setProcessing(true)
        setError('')
        setSuccess('')

        try {
            const res = await fetch('/api/admin/payroll-runs/calculate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ companyId, year, month }),
            })
            const data = await res.json()
            if (!res.ok || !data.success) throw new Error(data.error?.message || '計算に失敗しました')

            setSuccess(`${data.data.itemCount}名分の給与を計算しました`)
            await fetchRuns()
            if (data.data.payrollRun?.id) await fetchDetail(data.data.payrollRun.id)
        } catch (err) {
            setError(err instanceof Error ? err.message : '計算に失敗しました')
        } finally {
            setProcessing(false)
        }
    }

    const handleFinalize = async () => {
        if (!currentRun) return
        if (!confirm('給与を確定しますか？確定後は変更できません。')) return

        setProcessing(true)
        setError('')

        try {
            const res = await fetch(`/api/admin/payroll-runs/${currentRun.id}/finalize`, {
                method: 'POST',
                credentials: 'include',
            })
            const data = await res.json()
            if (!res.ok || !data.success) throw new Error(data.error?.message || '確定に失敗しました')

            setSuccess('給与を確定しました')
            await fetchRuns()
            await fetchDetail(currentRun.id)
        } catch (err) {
            setError(err instanceof Error ? err.message : '確定に失敗しました')
        } finally {
            setProcessing(false)
        }
    }

    const handleRevert = async () => {
        if (!currentRun) return
        if (!confirm('給与を差し戻しますか？')) return

        setProcessing(true)
        setError('')

        try {
            const res = await fetch(`/api/admin/payroll-runs/${currentRun.id}/revert`, {
                method: 'POST',
                credentials: 'include',
            })
            const data = await res.json()
            if (!res.ok || !data.success) throw new Error(data.error?.message || '差し戻しに失敗しました')

            setSuccess('給与を差し戻しました')
            setSelectedRun(null)
            await fetchRuns()
        } catch (err) {
            setError(err instanceof Error ? err.message : '差し戻しに失敗しました')
        } finally {
            setProcessing(false)
        }
    }

    const prevMonth = () => {
        if (month === 1) { setYear(y => y - 1); setMonth(12) }
        else setMonth(m => m - 1)
        setSelectedRun(null)
    }
    const nextMonth = () => {
        if (month === 12) { setYear(y => y + 1); setMonth(1) }
        else setMonth(m => m + 1)
        setSelectedRun(null)
    }

    const items = selectedRun?.payrollItems ?? []

    return (
        <div className="space-y-6">
            {/* ヘッダー */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">給与管理</h1>
                    <p className="text-sm text-slate-500 mt-0.5">月次給与の計算・確定を行います</p>
                </div>

                {/* 月選択 */}
                <div className="flex items-center gap-2">
                    <button onClick={prevMonth} className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">←</button>
                    <span className="text-base font-semibold text-slate-800 w-28 text-center">{year}年{month}月</span>
                    <button onClick={nextMonth} className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">→</button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                    {error} <button onClick={() => setError('')} className="ml-2">✕</button>
                </div>
            )}
            {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">{success}</div>
            )}

            {/* ステータスとアクション */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">ステータス</div>
                        {currentRun ? (
                            <div className="flex items-center gap-3">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium ${statusColors[currentRun.status] ?? ''}`}>
                                    {statusLabels[currentRun.status] ?? currentRun.status}
                                </span>
                                <span className="text-sm text-slate-500">{currentRun._count.payrollItems}名分</span>
                                {currentRun.finalizedAt && (
                                    <span className="text-sm text-slate-500">
                                        {new Date(currentRun.finalizedAt).toLocaleDateString('ja-JP')} 確定
                                    </span>
                                )}
                            </div>
                        ) : (
                            <span className="text-slate-500 text-sm">未計算</span>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {currentRun && (
                            <button
                                onClick={() => fetchDetail(currentRun.id)}
                                disabled={loadingDetail}
                                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                            >
                                {loadingDetail ? '読込中...' : '明細を見る'}
                            </button>
                        )}
                        <button
                            onClick={handleCalculate}
                            disabled={processing || currentRun?.status === 'finalized'}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                            {processing ? '計算中...' : '給与計算を実行'}
                        </button>
                        {currentRun?.status === 'calculated' && (
                            <button
                                onClick={handleFinalize}
                                disabled={processing}
                                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                            >
                                確定する
                            </button>
                        )}
                        {currentRun?.status === 'finalized' && (
                            <button
                                onClick={handleRevert}
                                disabled={processing}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                            >
                                差し戻し
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* 明細テーブル */}
            {selectedRun && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center">
                        <h2 className="text-base font-semibold text-slate-800">
                            {selectedRun.year}年{selectedRun.month}月 給与明細一覧
                        </h2>
                        <button onClick={() => setSelectedRun(null)} className="text-sm text-slate-400 hover:text-slate-600">✕ 閉じる</button>
                    </div>

                    {loadingDetail ? (
                        <div className="p-8 text-center">
                            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 text-sm">明細データがありません</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr className="bg-slate-50">
                                        <th className="text-left font-medium text-slate-600 px-3 py-3 border-b border-slate-200">従業員</th>
                                        <th className="text-left font-medium text-slate-600 px-3 py-3 border-b border-slate-200">部門</th>
                                        <th className="text-right font-medium text-slate-600 px-3 py-3 border-b border-slate-200">勤務時間</th>
                                        <th className="text-right font-medium text-slate-600 px-3 py-3 border-b border-slate-200">基本給</th>
                                        <th className="text-right font-medium text-slate-600 px-3 py-3 border-b border-slate-200">手当</th>
                                        <th className="text-right font-medium text-slate-600 px-3 py-3 border-b border-slate-200">残業代</th>
                                        <th className="text-right font-medium text-slate-600 px-3 py-3 border-b border-slate-200">総支給</th>
                                        <th className="text-right font-medium text-slate-600 px-3 py-3 border-b border-slate-200">控除計</th>
                                        <th className="text-right font-medium text-slate-600 px-3 py-3 border-b border-slate-200 font-bold">差引支給</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-50">
                                            <td className="px-3 py-3 border-b border-slate-100">
                                                <div className="font-medium text-slate-800">{item.employee.name}</div>
                                                <div className="text-xs text-slate-500 font-mono">{item.employee.employeeCode}</div>
                                            </td>
                                            <td className="px-3 py-3 border-b border-slate-100 text-slate-600 text-xs">
                                                {item.employee.department?.name ?? '-'}
                                            </td>
                                            <td className="px-3 py-3 border-b border-slate-100 text-right font-mono text-xs">
                                                <div>{formatMinutes(item.totalWorkedMinutes)}</div>
                                                {item.totalOvertimeMinutes > 0 && (
                                                    <div className="text-orange-500">+{formatMinutes(item.totalOvertimeMinutes)}</div>
                                                )}
                                            </td>
                                            <td className="px-3 py-3 border-b border-slate-100 text-right font-mono">{formatCurrency(item.baseSalary)}</td>
                                            <td className="px-3 py-3 border-b border-slate-100 text-right font-mono">
                                                {formatCurrency(item.allowanceTotal + item.commutingPay)}
                                            </td>
                                            <td className="px-3 py-3 border-b border-slate-100 text-right font-mono">
                                                {formatCurrency(item.overtimePay + item.withinScheduledOvertimePay + item.scheduledHolidayPay + item.legalHolidayPay + item.lateNightPay)}
                                            </td>
                                            <td className="px-3 py-3 border-b border-slate-100 text-right font-mono font-medium">
                                                {formatCurrency(item.grossPay)}
                                            </td>
                                            <td className="px-3 py-3 border-b border-slate-100 text-right font-mono text-red-600">
                                                -{formatCurrency(item.totalDeductions)}
                                            </td>
                                            <td className="px-3 py-3 border-b border-slate-100 text-right font-mono font-bold text-blue-600">
                                                {formatCurrency(item.netPay)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-50 font-semibold">
                                        <td colSpan={2} className="px-3 py-3 border-t border-slate-200 text-slate-700">合計 ({items.length}名)</td>
                                        <td className="px-3 py-3 border-t border-slate-200 text-right font-mono text-xs">
                                            {formatMinutes(items.reduce((s, i) => s + i.totalWorkedMinutes, 0))}
                                        </td>
                                        <td className="px-3 py-3 border-t border-slate-200 text-right font-mono">
                                            {formatCurrency(items.reduce((s, i) => s + i.baseSalary, 0))}
                                        </td>
                                        <td className="px-3 py-3 border-t border-slate-200 text-right font-mono">
                                            {formatCurrency(items.reduce((s, i) => s + i.allowanceTotal + i.commutingPay, 0))}
                                        </td>
                                        <td className="px-3 py-3 border-t border-slate-200 text-right font-mono">
                                            {formatCurrency(items.reduce((s, i) => s + i.overtimePay + i.withinScheduledOvertimePay + i.scheduledHolidayPay + i.legalHolidayPay + i.lateNightPay, 0))}
                                        </td>
                                        <td className="px-3 py-3 border-t border-slate-200 text-right font-mono">
                                            {formatCurrency(items.reduce((s, i) => s + i.grossPay, 0))}
                                        </td>
                                        <td className="px-3 py-3 border-t border-slate-200 text-right font-mono text-red-600">
                                            -{formatCurrency(items.reduce((s, i) => s + i.totalDeductions, 0))}
                                        </td>
                                        <td className="px-3 py-3 border-t border-slate-200 text-right font-mono text-blue-600">
                                            {formatCurrency(items.reduce((s, i) => s + i.netPay, 0))}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* 年間実績一覧 */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200">
                    <h2 className="text-base font-semibold text-slate-800">{year}年 給与計算履歴</h2>
                </div>
                {loadingList ? (
                    <div className="p-8 text-center">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    </div>
                ) : runs.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-sm">給与計算の実績がありません</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-slate-50">
                                    <th className="text-left font-medium text-slate-600 px-4 py-3 border-b border-slate-200">対象月</th>
                                    <th className="text-left font-medium text-slate-600 px-4 py-3 border-b border-slate-200">ステータス</th>
                                    <th className="text-left font-medium text-slate-600 px-4 py-3 border-b border-slate-200">従業員数</th>
                                    <th className="text-left font-medium text-slate-600 px-4 py-3 border-b border-slate-200">計算日時</th>
                                    <th className="text-left font-medium text-slate-600 px-4 py-3 border-b border-slate-200">確定日時</th>
                                    <th className="text-left font-medium text-slate-600 px-4 py-3 border-b border-slate-200">操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {runs.map((run) => (
                                    <tr key={run.id} className={`hover:bg-slate-50 ${run.year === year && run.month === month ? 'bg-blue-50' : ''}`}>
                                        <td className="px-4 py-3 border-b border-slate-100 font-medium text-slate-800">
                                            {run.year}年{run.month}月
                                        </td>
                                        <td className="px-4 py-3 border-b border-slate-100">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[run.status] ?? ''}`}>
                                                {statusLabels[run.status] ?? run.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 border-b border-slate-100 text-slate-700">{run._count.payrollItems}名</td>
                                        <td className="px-4 py-3 border-b border-slate-100 text-xs text-slate-500">
                                            {run.calculatedAt ? new Date(run.calculatedAt).toLocaleString('ja-JP') : '-'}
                                        </td>
                                        <td className="px-4 py-3 border-b border-slate-100 text-xs text-slate-500">
                                            {run.finalizedAt ? new Date(run.finalizedAt).toLocaleString('ja-JP') : '-'}
                                        </td>
                                        <td className="px-4 py-3 border-b border-slate-100">
                                            <button
                                                onClick={() => { setYear(run.year); setMonth(run.month); fetchDetail(run.id) }}
                                                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                            >
                                                明細
                                            </button>
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
