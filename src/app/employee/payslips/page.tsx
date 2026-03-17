'use client'

import { useState, useEffect } from 'react'

interface Payslip {
    id: string
    yearMonth: string
    grossSalary: number
    netSalary: number
    status: string
}

export default function EmployeePayslipsPage() {
    const [payslips, setPayslips] = useState<Payslip[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchPayslips = async () => {
            try {
                const res = await fetch('/api/employee/payslips')
                const data = await res.json()
                if (res.ok && data.success) {
                    setPayslips(data.data?.payslips || data.data || [])
                }
            } catch (error) {
                console.error('Failed to fetch:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchPayslips()
    }, [])

    const handleViewPdf = async (yearMonth: string) => {
        try {
            const res = await fetch(`/api/employee/payslips/${yearMonth}/pdf`)
            if (!res.ok) throw new Error('PDF取得に失敗しました')
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            window.open(url, '_blank')
        } catch {
            alert('PDFの取得に失敗しました')
        }
    }

    const formatCurrency = (amount: number) => '¥' + amount.toLocaleString()

    const formatYearMonth = (ym: string) => {
        const [year, month] = ym.split('-')
        return `${year}年${parseInt(month)}月`
    }

    const statusLabel = (status: string) => {
        switch (status) {
            case 'confirmed': return { label: '確定', color: 'bg-green-100 text-green-700' }
            case 'draft': return { label: '下書き', color: 'bg-slate-100 text-slate-600' }
            default: return { label: status, color: 'bg-slate-100 text-slate-600' }
        }
    }

    return (
        <div className="space-y-4">
            <h1 className="text-xl font-bold text-slate-800">給与明細</h1>

            {loading ? (
                <div className="flex justify-center py-8">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : payslips.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                    <div className="text-4xl mb-3">💴</div>
                    <p>給与明細がありません</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {payslips.map((p) => {
                        const s = statusLabel(p.status)
                        return (
                            <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-slate-800 text-lg">{formatYearMonth(p.yearMonth)}</span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>{s.label}</span>
                                        </div>
                                        <div className="text-sm text-slate-500">
                                            総支給額 {formatCurrency(p.grossSalary)}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xl font-bold text-blue-600 mb-1">
                                            {formatCurrency(p.netSalary)}
                                        </div>
                                        <button
                                            onClick={() => handleViewPdf(p.yearMonth)}
                                            className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
                                        >
                                            PDF表示
                                        </button>
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
