'use client'

import { useState, useEffect } from 'react'

interface AllowanceType {
    id: string
    code: string
    name: string
    category: string
    includedInBaseWage: boolean
    calculationType: string
    isUniformPayment: boolean
    isActualCostBased: boolean
    taxable: boolean
    socialInsuranceApplicable: boolean
    notes: string | null
    _count: { employeeAllowances: number }
}

const categoryLabels: Record<string, string> = {
    position: '役職手当',
    job: '職務手当',
    skill: 'スキル手当',
    family: '家族手当',
    commuting: '通勤手当',
    housing: '住宅手当',
    overtime: '残業手当',
    incentive: '業績手当',
    other: 'その他',
}

const calcTypeLabels: Record<string, string> = {
    fixed: '固定額',
    rate: '率計算',
    hours: '時間単価',
}

export default function AllowanceTypesPage() {
    const [allowanceTypes, setAllowanceTypes] = useState<AllowanceType[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [editTarget, setEditTarget] = useState<AllowanceType | null>(null)
    const [showNew, setShowNew] = useState(false)
    const [saving, setSaving] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<AllowanceType | null>(null)

    const defaultForm = {
        code: '',
        name: '',
        category: 'other',
        includedInBaseWage: true,
        exclusionReason: '',
        calculationType: 'fixed',
        isUniformPayment: false,
        isActualCostBased: false,
        taxable: true,
        socialInsuranceApplicable: true,
        notes: '',
    }
    const [form, setForm] = useState(defaultForm)

    const fetchData = async () => {
        try {
            const res = await fetch('/api/admin/allowance-types', { credentials: 'include' })
            const data = await res.json()
            if (data.success) setAllowanceTypes(data.data)
        } catch {
            setError('データの取得に失敗しました')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchData() }, [])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target
        setForm((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
        }))
    }

    const openEdit = (at: AllowanceType) => {
        setEditTarget(at)
        setForm({
            code: at.code,
            name: at.name,
            category: at.category,
            includedInBaseWage: at.includedInBaseWage,
            exclusionReason: '',
            calculationType: at.calculationType,
            isUniformPayment: at.isUniformPayment,
            isActualCostBased: at.isActualCostBased,
            taxable: at.taxable,
            socialInsuranceApplicable: at.socialInsuranceApplicable,
            notes: at.notes ?? '',
        })
        setShowNew(false)
    }

    const openNew = () => {
        setEditTarget(null)
        setForm(defaultForm)
        setShowNew(true)
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        setError('')
        setSuccess('')

        try {
            const payload = {
                code: form.code,
                name: form.name,
                category: form.category,
                includedInBaseWage: form.includedInBaseWage,
                exclusionReason: form.exclusionReason || null,
                calculationType: form.calculationType,
                isUniformPayment: form.isUniformPayment,
                isActualCostBased: form.isActualCostBased,
                taxable: form.taxable,
                socialInsuranceApplicable: form.socialInsuranceApplicable,
                notes: form.notes || null,
            }

            let res: Response
            if (editTarget) {
                res = await fetch(`/api/admin/allowance-types/${editTarget.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(payload),
                })
            } else {
                res = await fetch('/api/admin/allowance-types', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(payload),
                })
            }

            const data = await res.json()
            if (!res.ok || !data.success) throw new Error(data.error?.message || '保存に失敗しました')

            setSuccess(editTarget ? '手当種別を更新しました' : '手当種別を作成しました')
            setEditTarget(null)
            setShowNew(false)
            setTimeout(() => setSuccess(''), 3000)
            await fetchData()
        } catch (err) {
            setError(err instanceof Error ? err.message : '保存に失敗しました')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!deleteTarget) return
        try {
            const res = await fetch(`/api/admin/allowance-types/${deleteTarget.id}`, {
                method: 'DELETE',
                credentials: 'include',
            })
            const data = await res.json()
            if (!res.ok || !data.success) throw new Error(data.error?.message || '削除に失敗しました')
            setSuccess('手当種別を削除しました')
            setDeleteTarget(null)
            setTimeout(() => setSuccess(''), 3000)
            await fetchData()
        } catch (err) {
            setError(err instanceof Error ? err.message : '削除に失敗しました')
            setDeleteTarget(null)
        }
    }

    const isFormOpen = showNew || editTarget !== null

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">手当種別マスタ</h1>
                    <p className="text-sm text-slate-500 mt-0.5">手当の種類と計算方法を管理します</p>
                </div>
                <button onClick={openNew} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                    + 新規手当
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
                ) : allowanceTypes.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-sm">手当種別が登録されていません</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-slate-50">
                                    <th className="text-left font-medium text-slate-600 px-4 py-3 border-b border-slate-200">コード</th>
                                    <th className="text-left font-medium text-slate-600 px-4 py-3 border-b border-slate-200">手当名</th>
                                    <th className="text-left font-medium text-slate-600 px-4 py-3 border-b border-slate-200">区分</th>
                                    <th className="text-left font-medium text-slate-600 px-4 py-3 border-b border-slate-200">計算</th>
                                    <th className="text-center font-medium text-slate-600 px-4 py-3 border-b border-slate-200">基本賃金算入</th>
                                    <th className="text-center font-medium text-slate-600 px-4 py-3 border-b border-slate-200">課税</th>
                                    <th className="text-center font-medium text-slate-600 px-4 py-3 border-b border-slate-200">社保対象</th>
                                    <th className="text-left font-medium text-slate-600 px-4 py-3 border-b border-slate-200">適用人数</th>
                                    <th className="text-left font-medium text-slate-600 px-4 py-3 border-b border-slate-200">操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allowanceTypes.map((at) => (
                                    <tr key={at.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 border-b border-slate-100 font-mono text-slate-600">{at.code}</td>
                                        <td className="px-4 py-3 border-b border-slate-100 font-medium text-slate-800">{at.name}</td>
                                        <td className="px-4 py-3 border-b border-slate-100 text-slate-700">{categoryLabels[at.category] || at.category}</td>
                                        <td className="px-4 py-3 border-b border-slate-100 text-slate-700">{calcTypeLabels[at.calculationType] || at.calculationType}</td>
                                        <td className="px-4 py-3 border-b border-slate-100 text-center">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${at.includedInBaseWage ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                                {at.includedInBaseWage ? '算入' : '除外'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 border-b border-slate-100 text-center">
                                            <span className={`text-xs ${at.taxable ? 'text-orange-600' : 'text-slate-400'}`}>{at.taxable ? '課税' : '非課税'}</span>
                                        </td>
                                        <td className="px-4 py-3 border-b border-slate-100 text-center">
                                            <span className={`text-xs ${at.socialInsuranceApplicable ? 'text-blue-600' : 'text-slate-400'}`}>{at.socialInsuranceApplicable ? '対象' : '対象外'}</span>
                                        </td>
                                        <td className="px-4 py-3 border-b border-slate-100 text-slate-700">{at._count.employeeAllowances}名</td>
                                        <td className="px-4 py-3 border-b border-slate-100">
                                            <div className="flex gap-3">
                                                <button onClick={() => openEdit(at)} className="text-blue-600 hover:text-blue-800 font-medium text-sm">編集</button>
                                                <button onClick={() => setDeleteTarget(at)} className="text-red-600 hover:text-red-800 text-sm">削除</button>
                                            </div>
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
                            {editTarget ? `手当種別の編集: ${editTarget.name}` : '新規手当種別の作成'}
                        </h2>
                        <button onClick={() => { setEditTarget(null); setShowNew(false) }} className="text-slate-400 hover:text-slate-600">✕</button>
                    </div>

                    <form onSubmit={handleSave} className="space-y-5">
                        <div className="grid sm:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">コード <span className="text-red-500">*</span></label>
                                <input type="text" name="code" value={form.code} onChange={handleChange} required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">手当名 <span className="text-red-500">*</span></label>
                                <input type="text" name="name" value={form.name} onChange={handleChange} required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">区分 <span className="text-red-500">*</span></label>
                                <select name="category" value={form.category} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    {Object.entries(categoryLabels).map(([v, l]) => (
                                        <option key={v} value={v}>{l}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">計算方法</label>
                                <select name="calculationType" value={form.calculationType} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    <option value="fixed">固定額</option>
                                    <option value="rate">率計算</option>
                                    <option value="hours">時間単価</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">除外理由（基本賃金から除外の場合）</label>
                                <input type="text" name="exclusionReason" value={form.exclusionReason} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-6">
                            {[
                                { name: 'includedInBaseWage', label: '基本賃金算入' },
                                { name: 'isUniformPayment', label: '一律支給' },
                                { name: 'isActualCostBased', label: '実費精算' },
                                { name: 'taxable', label: '課税対象' },
                                { name: 'socialInsuranceApplicable', label: '社保対象' },
                            ].map((item) => (
                                <label key={item.name} className="flex items-center gap-2 text-sm text-slate-700">
                                    <input
                                        type="checkbox"
                                        name={item.name}
                                        checked={form[item.name as keyof typeof form] as boolean}
                                        onChange={handleChange}
                                        className="rounded border-slate-300"
                                    />
                                    {item.label}
                                </label>
                            ))}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">備考</label>
                            <textarea name="notes" value={form.notes} onChange={handleChange} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={() => { setEditTarget(null); setShowNew(false) }} className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">
                                キャンセル
                            </button>
                            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                                {saving ? '保存中...' : '保存する'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* 削除確認 */}
            {deleteTarget && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDeleteTarget(null)}>
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-slate-800 mb-2">手当種別の削除</h3>
                        <p className="text-slate-600 mb-6">
                            <strong>{deleteTarget.name}</strong>（{deleteTarget.code}）を削除しますか？
                            {deleteTarget._count.employeeAllowances > 0 && (
                                <span className="block text-red-600 text-sm mt-2">
                                    注意: {deleteTarget._count.employeeAllowances}名の従業員に適用されています
                                </span>
                            )}
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">キャンセル</button>
                            <button onClick={handleDelete} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700">削除する</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
