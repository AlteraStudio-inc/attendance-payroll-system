'use client'

import { useState, useEffect } from 'react'

interface StatutoryRate {
    id: string
    fiscalYear: number
    healthInsuranceRate: number
    nursingCareInsuranceRate: number
    welfarePensionRate: number
    childSupportRate: number
    employmentInsuranceEmployeeRate: number
    employmentInsuranceEmployerRate: number
    effectiveFrom: string
    effectiveTo: string | null
}

export default function StatutoryRatesPage() {
    const [rates, setRates] = useState<StatutoryRate[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [showNew, setShowNew] = useState(false)
    const [editTarget, setEditTarget] = useState<StatutoryRate | null>(null)
    const [saving, setSaving] = useState(false)

    const defaultForm = {
        fiscalYear: new Date().getFullYear().toString(),
        healthInsuranceRate: '0.0998',
        nursingCareInsuranceRate: '0.0182',
        welfarePensionRate: '0.1830',
        childSupportRate: '0.0036',
        employmentInsuranceEmployeeRate: '0.006',
        employmentInsuranceEmployerRate: '0.0095',
        effectiveFrom: `${new Date().getFullYear()}-04-01`,
        effectiveTo: '',
    }
    const [form, setForm] = useState(defaultForm)

    const fetchRates = async () => {
        try {
            const res = await fetch('/api/admin/statutory-rates', { credentials: 'include' })
            const data = await res.json()
            if (data.success) setRates(data.data)
        } catch {
            setError('データの取得に失敗しました')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchRates() }, [])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
        setForm((prev) => ({ ...prev, [name]: value }))
    }

    const openEdit = (rate: StatutoryRate) => {
        setEditTarget(rate)
        setForm({
            fiscalYear: rate.fiscalYear.toString(),
            healthInsuranceRate: rate.healthInsuranceRate.toString(),
            nursingCareInsuranceRate: rate.nursingCareInsuranceRate.toString(),
            welfarePensionRate: rate.welfarePensionRate.toString(),
            childSupportRate: rate.childSupportRate.toString(),
            employmentInsuranceEmployeeRate: rate.employmentInsuranceEmployeeRate.toString(),
            employmentInsuranceEmployerRate: rate.employmentInsuranceEmployerRate.toString(),
            effectiveFrom: rate.effectiveFrom.split('T')[0],
            effectiveTo: rate.effectiveTo ? rate.effectiveTo.split('T')[0] : '',
        })
        setShowNew(false)
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        setError('')
        setSuccess('')

        try {
            const payload = {
                fiscalYear: parseInt(form.fiscalYear),
                healthInsuranceRate: parseFloat(form.healthInsuranceRate),
                nursingCareInsuranceRate: parseFloat(form.nursingCareInsuranceRate),
                welfarePensionRate: parseFloat(form.welfarePensionRate),
                childSupportRate: parseFloat(form.childSupportRate),
                employmentInsuranceEmployeeRate: parseFloat(form.employmentInsuranceEmployeeRate),
                employmentInsuranceEmployerRate: parseFloat(form.employmentInsuranceEmployerRate),
                effectiveFrom: form.effectiveFrom,
                effectiveTo: form.effectiveTo || null,
            }

            let res: Response
            if (editTarget) {
                res = await fetch(`/api/admin/statutory-rates/${editTarget.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(payload),
                })
            } else {
                res = await fetch('/api/admin/statutory-rates', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(payload),
                })
            }

            const data = await res.json()
            if (!res.ok || !data.success) throw new Error(data.error?.message || '保存に失敗しました')

            setSuccess(editTarget ? '法定控除率を更新しました' : '法定控除率を登録しました')
            setEditTarget(null)
            setShowNew(false)
            setTimeout(() => setSuccess(''), 3000)
            await fetchRates()
        } catch (err) {
            setError(err instanceof Error ? err.message : '保存に失敗しました')
        } finally {
            setSaving(false)
        }
    }

    const formatRate = (r: number) => `${(r * 100).toFixed(3)}%`

    const isFormOpen = showNew || editTarget !== null

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">法定控除率マスタ</h1>
                    <p className="text-sm text-slate-500 mt-0.5">社会保険料・雇用保険の控除率を管理します</p>
                </div>
                <button
                    onClick={() => { setEditTarget(null); setForm(defaultForm); setShowNew(true) }}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                    + 新規登録
                </button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                    {error} <button onClick={() => setError('')} className="ml-2">✕</button>
                </div>
            )}
            {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">{success}</div>
            )}

            {/* 一覧 */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    </div>
                ) : rates.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-sm">法定控除率が登録されていません</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-slate-50">
                                    <th className="text-left font-medium text-slate-600 px-4 py-3 border-b border-slate-200">年度</th>
                                    <th className="text-right font-medium text-slate-600 px-4 py-3 border-b border-slate-200">健康保険</th>
                                    <th className="text-right font-medium text-slate-600 px-4 py-3 border-b border-slate-200">介護保険</th>
                                    <th className="text-right font-medium text-slate-600 px-4 py-3 border-b border-slate-200">厚生年金</th>
                                    <th className="text-right font-medium text-slate-600 px-4 py-3 border-b border-slate-200">子育て拠出金</th>
                                    <th className="text-right font-medium text-slate-600 px-4 py-3 border-b border-slate-200">雇用保険（本人）</th>
                                    <th className="text-right font-medium text-slate-600 px-4 py-3 border-b border-slate-200">雇用保険（事業主）</th>
                                    <th className="text-left font-medium text-slate-600 px-4 py-3 border-b border-slate-200">有効期間</th>
                                    <th className="text-left font-medium text-slate-600 px-4 py-3 border-b border-slate-200">操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rates.map((rate) => (
                                    <tr key={rate.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 border-b border-slate-100 font-bold text-slate-800">{rate.fiscalYear}年度</td>
                                        <td className="px-4 py-3 border-b border-slate-100 text-right font-mono text-slate-700">{formatRate(rate.healthInsuranceRate)}</td>
                                        <td className="px-4 py-3 border-b border-slate-100 text-right font-mono text-slate-700">{formatRate(rate.nursingCareInsuranceRate)}</td>
                                        <td className="px-4 py-3 border-b border-slate-100 text-right font-mono text-slate-700">{formatRate(rate.welfarePensionRate)}</td>
                                        <td className="px-4 py-3 border-b border-slate-100 text-right font-mono text-slate-700">{formatRate(rate.childSupportRate)}</td>
                                        <td className="px-4 py-3 border-b border-slate-100 text-right font-mono text-slate-700">{formatRate(rate.employmentInsuranceEmployeeRate)}</td>
                                        <td className="px-4 py-3 border-b border-slate-100 text-right font-mono text-slate-700">{formatRate(rate.employmentInsuranceEmployerRate)}</td>
                                        <td className="px-4 py-3 border-b border-slate-100 text-xs text-slate-500">
                                            {rate.effectiveFrom.split('T')[0]} 〜 {rate.effectiveTo ? rate.effectiveTo.split('T')[0] : '現在'}
                                        </td>
                                        <td className="px-4 py-3 border-b border-slate-100">
                                            <button onClick={() => openEdit(rate)} className="text-blue-600 hover:text-blue-800 font-medium text-sm">編集</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* 編集フォーム */}
            {isFormOpen && (
                <div className="bg-white rounded-xl border border-blue-200 p-6 space-y-5">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-semibold text-slate-800">
                            {editTarget ? `${editTarget.fiscalYear}年度の編集` : '新規法定控除率の登録'}
                        </h2>
                        <button onClick={() => { setEditTarget(null); setShowNew(false) }} className="text-slate-400 hover:text-slate-600">✕</button>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
                        各料率は事業主・従業員合計の料率を入力してください（例: 健康保険9.98% → 0.0998）
                    </div>

                    <form onSubmit={handleSave} className="space-y-5">
                        <div className="grid sm:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">年度 <span className="text-red-500">*</span></label>
                                <input type="number" name="fiscalYear" value={form.fiscalYear} onChange={handleChange} required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">適用開始日 <span className="text-red-500">*</span></label>
                                <input type="date" name="effectiveFrom" value={form.effectiveFrom} onChange={handleChange} required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">適用終了日</label>
                                <input type="date" name="effectiveTo" value={form.effectiveTo} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                        </div>

                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[
                                { name: 'healthInsuranceRate', label: '健康保険料率（合計）', hint: '例: 0.0998' },
                                { name: 'nursingCareInsuranceRate', label: '介護保険料率（合計）', hint: '例: 0.0182' },
                                { name: 'welfarePensionRate', label: '厚生年金料率（合計）', hint: '例: 0.1830' },
                                { name: 'childSupportRate', label: '子育て拠出金率（事業主）', hint: '例: 0.0036' },
                                { name: 'employmentInsuranceEmployeeRate', label: '雇用保険料率（本人）', hint: '例: 0.006' },
                                { name: 'employmentInsuranceEmployerRate', label: '雇用保険料率（事業主）', hint: '例: 0.0095' },
                            ].map((field) => (
                                <div key={field.name}>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">{field.label}</label>
                                    <input
                                        type="number"
                                        step="0.0001"
                                        name={field.name}
                                        value={form[field.name as keyof typeof form]}
                                        onChange={handleChange}
                                        placeholder={field.hint}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        = {(parseFloat(form[field.name as keyof typeof form] as string) * 100 || 0).toFixed(3)}%
                                    </p>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={() => { setEditTarget(null); setShowNew(false) }} className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">キャンセル</button>
                            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                                {saving ? '保存中...' : '保存する'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    )
}
