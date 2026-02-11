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
                if (res.ok) {
                    setPayslips(data.payslips || [])
                }
            } catch (error) {
                console.error('Failed to fetch:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchPayslips()
    }, [])

    const handleDownload = async (yearMonth: string) => {
        try {
            const res = await fetch(`/api/employee/payslips/${yearMonth}/pdf`)
            if (!res.ok) throw new Error('PDF取得に失敗しました')

            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            window.open(url, '_blank')
        } catch (error) {
            console.error('Failed to download:', error)
            alert('PDFの取得に失敗しました')
        }
    }

    const formatCurrency = (amount: number) => '¥' + amount.toLocaleString()

    const formatYearMonth = (ym: string) => {
        const [year, month] = ym.split('-')
        return `${year}年${parseInt(month)}月`
    }

    return (
        <div className="space-y-4">
            <h1 className="text-xl font-bold text-slate-800">給与明細</h1>

            {loading ? (
                <div className="flex justify-center py-8">
                    <div className="spinner w-8 h-8"></div>
                </div>
            ) : payslips.length === 0 ? (
                <p className="text-center text-slate-500 py-8">給与明細がありません</p>
            ) : (
                <div className="space-y-2">
                    {payslips.map((p) => (
                        <div key={p.id} className="card p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-bold text-slate-800">{formatYearMonth(p.yearMonth)}</div>
                                    <div className="text-sm text-slate-500">
                                        総支給 {formatCurrency(p.grossSalary)}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-lg font-bold text-primary-600">
                                        {formatCurrency(p.netSalary)}
                                    </div>
                                    <button
                                        onClick={() => handleDownload(p.yearMonth)}
                                        className="text-sm text-primary-600 hover:text-primary-800 mt-1"
                                    >
                                        PDF表示
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
