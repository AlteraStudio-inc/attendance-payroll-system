'use client'

import { useState, useEffect } from 'react'
import { format, addMonths, subMonths } from 'date-fns'
import { ja } from 'date-fns/locale'

interface PayrollItem {
    id: string
    employeeId: string
    employeeName: string
    employeeCode: string
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
    pdfPath: string | null
    warnings?: string[]
}

interface PayrollRun {
    id: string
    yearMonth: string
    status: 'DRAFT' | 'CONFIRMED' | 'REVERTED'
    confirmedBy: string | null
    confirmedAt: string | null
}

export default function PayrollPage() {
    const [payrollRun, setPayrollRun] = useState<PayrollRun | null>(null)
    const [items, setItems] = useState<PayrollItem[]>([])
    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState(false)
    const [currentMonth, setCurrentMonth] = useState(format(new Date(), 'yyyy-MM'))
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const fetchPayroll = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/payroll?month=${currentMonth}`)
            const data = await res.json()
            if (res.ok) {
                setPayrollRun(data.payrollRun)
                setItems(data.items || [])
            }
        } catch (err) {
            console.error('Failed to fetch payroll:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchPayroll()
    }, [currentMonth])

    const handleCalculate = async () => {
        if (!confirm('給与計算を実行しますか？\n既存の計算結果は上書きされます。')) return

        setProcessing(true)
        setError('')
        setSuccess('')

        try {
            const res = await fetch('/api/payroll', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'calculate', yearMonth: currentMonth }),
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            setSuccess(`${data.itemCount}名分の給与を計算しました`)
            fetchPayroll()
        } catch (err) {
            setError(err instanceof Error ? err.message : '計算に失敗しました')
        } finally {
            setProcessing(false)
        }
    }

    const handleConfirm = async () => {
        if (!payrollRun) return
        if (!confirm('給与を確定しますか？\n確定後は編集できなくなります。')) return

        setProcessing(true)
        setError('')

        try {
            const res = await fetch('/api/payroll', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'confirm',
                    yearMonth: currentMonth,
                    payrollRunId: payrollRun.id,
                }),
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            setSuccess('給与を確定しました')
            fetchPayroll()
        } catch (err) {
            setError(err instanceof Error ? err.message : '確定に失敗しました')
        } finally {
            setProcessing(false)
        }
    }

    const handleRevert = async () => {
        if (!payrollRun) return
        if (!confirm('給与を差し戻しますか？')) return

        setProcessing(true)
        setError('')

        try {
            const res = await fetch('/api/payroll', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'revert',
                    yearMonth: currentMonth,
                    payrollRunId: payrollRun.id,
                }),
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            setSuccess('給与を差し戻しました')
            fetchPayroll()
        } catch (err) {
            setError(err instanceof Error ? err.message : '差し戻しに失敗しました')
        } finally {
            setProcessing(false)
        }
    }
    const handleSendBulkEmail = async () => {
        if (!payrollRun) return
        if (!confirm('全員に給与明細をメールで送信しますか？\n※メールアドレスが登録されている従業員のみ送信されます。')) return

        setProcessing(true)
        setError('')
        setSuccess('')

        try {
            const res = await fetch('/api/payroll/send-bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ yearMonth: currentMonth }),
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            setSuccess(`${data.sentCount}件のメール送信が完了しました`)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'メール送信に失敗しました')
        } finally {
            setProcessing(false)
        }
    }

    const handleGeneratePdf = async (employeeId: string) => {
        setProcessing(true)
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
            setProcessing(false)
        }
    }

    const formatCurrency = (amount: number) => '¥' + amount.toLocaleString()

    const statusBadge = (status: string) => {
        const colors = {
            DRAFT: 'badge-draft',
            CONFIRMED: 'badge-confirmed',
            REVERTED: 'badge-pending',
        }
        const labels = {
            DRAFT: '下書き',
            CONFIRMED: '確定',
            REVERTED: '差し戻し',
        }
        return <span className={`badge ${colors[status as keyof typeof colors]}`}>{labels[status as keyof typeof labels]}</span>
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl font-bold text-slate-800">給与管理</h1>

                {/* 月選択 */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setCurrentMonth(format(subMonths(new Date(currentMonth + '-01'), 1), 'yyyy-MM'))}
                        className="btn btn-secondary"
                    >
                        ←
                    </button>
                    <span className="text-lg font-medium px-4">
                        {format(new Date(currentMonth + '-01'), 'yyyy年M月', { locale: ja })}
                    </span>
                    <button
                        onClick={() => setCurrentMonth(format(addMonths(new Date(currentMonth + '-01'), 1), 'yyyy-MM'))}
                        className="btn btn-secondary"
                    >
                        →
                    </button>
                </div>
            </div>

            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            {/* ステータスとアクション */}
            <div className="card">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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
                                <span className="text-slate-500">未計算</span>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleCalculate}
                            disabled={processing || payrollRun?.status === 'CONFIRMED'}
                            className="btn btn-primary"
                        >
                            給与計算
                        </button>
                        {payrollRun && payrollRun.status !== 'CONFIRMED' && (
                            <button
                                onClick={handleConfirm}
                                disabled={processing}
                                className="btn btn-success"
                            >
                                確定
                            </button>
                        )}
                        {payrollRun?.status === 'CONFIRMED' && (
                            <>
                                <button
                                    onClick={handleSendBulkEmail}
                                    disabled={processing}
                                    className="btn btn-primary"
                                >
                                    全員に明細をメール送信
                                </button>
                                <button
                                    onClick={handleRevert}
                                    disabled={processing}
                                    className="btn btn-danger"
                                >
                                    差し戻し
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* 給与一覧 */}
            <div className="card p-0">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="spinner w-10 h-10"></div>
                    </div>
                ) : items.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        給与データがありません<br />
                        「給与計算」ボタンをクリックして計算を実行してください
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table text-sm">
                            <thead>
                                <tr>
                                    <th>従業員</th>
                                    <th className="text-right">勤務時間</th>
                                    <th className="text-right">基本給</th>
                                    <th className="text-right">残業代</th>
                                    <th className="text-right">休日出勤</th>
                                    <th className="text-right">総支給</th>
                                    <th className="text-right">控除</th>
                                    <th className="text-right">差引支給</th>
                                    <th>PDF</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item) => (
                                    <tr key={item.id}>
                                        <td>
                                            <div className="font-medium">{item.employeeName}</div>
                                            <div className="text-xs text-slate-500">{item.employeeCode}</div>
                                        </td>
                                        <td className="text-right font-mono">
                                            {item.workHours}h
                                            {item.overtimeHours > 0 && (
                                                <span className="text-orange-500 text-xs ml-1">
                                                    (+{item.overtimeHours}h)
                                                </span>
                                            )}
                                        </td>
                                        <td className="text-right">{formatCurrency(item.baseSalary)}</td>
                                        <td className="text-right">{formatCurrency(item.overtimePay + item.deemedOvertimePay)}</td>
                                        <td className="text-right">{formatCurrency(item.holidayPay)}</td>
                                        <td className="text-right font-medium">{formatCurrency(item.grossSalary)}</td>
                                        <td className="text-right text-red-600">-{formatCurrency(item.totalDeductions)}</td>
                                        <td className="text-right font-bold text-primary-600">{formatCurrency(item.netSalary)}</td>
                                        <td>
                                            <button
                                                onClick={() => handleGeneratePdf(item.employeeId)}
                                                disabled={processing}
                                                className="text-primary-600 hover:text-primary-800 text-sm"
                                            >
                                                PDF
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-slate-50 font-medium">
                                    <td>合計 ({items.length}名)</td>
                                    <td className="text-right">{items.reduce((s, i) => s + i.workHours, 0).toFixed(1)}h</td>
                                    <td className="text-right">{formatCurrency(items.reduce((s, i) => s + i.baseSalary, 0))}</td>
                                    <td className="text-right">{formatCurrency(items.reduce((s, i) => s + i.overtimePay + i.deemedOvertimePay, 0))}</td>
                                    <td className="text-right">{formatCurrency(items.reduce((s, i) => s + i.holidayPay, 0))}</td>
                                    <td className="text-right">{formatCurrency(items.reduce((s, i) => s + i.grossSalary, 0))}</td>
                                    <td className="text-right text-red-600">-{formatCurrency(items.reduce((s, i) => s + i.totalDeductions, 0))}</td>
                                    <td className="text-right text-primary-600">{formatCurrency(items.reduce((s, i) => s + i.netSalary, 0))}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
