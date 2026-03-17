'use client'

import { useState, useEffect } from 'react'

interface Department {
    id: string
    code: string
    name: string
    startTime: string
    endTime: string
    breakMinutes: number
    scheduledWorkMinutesPerDay: number
    annualWorkDays: number
    overtimeBoundaryType: string
    lateNightEnabled: boolean
    fixedOvertimeEnabled: boolean
    fixedOvertimeMinutes: number
    notes: string | null
    company: { id: string; name: string } | null
    _count: { employees: number }
}

interface Company {
    id: string
    name: string
}

const overtimeBoundaryLabels: Record<string, string> = {
    daily_8h: '1日8時間超',
    daily_set: '所定時間超（日次）',
    weekly_40h: '週40時間超',
}

export default function DepartmentsPage() {
    const [departments, setDepartments] = useState<Department[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [editTarget, setEditTarget] = useState<Department | null>(null)
    const [showNew, setShowNew] = useState(false)
    const [companyId, setCompanyId] = useState('')
    const [saving, setSaving] = useState(false)

    const defaultForm = {
        code: '',
        name: '',
        startTime: '09:00',
        endTime: '18:00',
        breakStartTime: '12:00',
        breakEndTime: '13:00',
        breakMinutes: '60',
        scheduledWorkMinutesPerDay: '480',
        annualWorkDays: '260',
        annualHolidays: '105',
        annualWorkMinutes: '124800',
        monthlyAverageWorkMinutes: '10400',
        overtimeBoundaryType: 'daily_8h',
        lateNightEnabled: false,
        fixedOvertimeEnabled: false,
        fixedOvertimeMinutes: '0',
        fixedOvertimeAllowanceName: '',
        allowWithinScheduledOvertime: false,
        notes: '',
    }

    const [form, setForm] = useState(defaultForm)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [deptRes, meRes] = await Promise.all([
                    fetch('/api/admin/departments', { credentials: 'include' }),
                    fetch('/api/auth/me', { credentials: 'include' }),
                ])
                const deptData = await deptRes.json()
                const meData = await meRes.json()

                if (deptData.success) setDepartments(deptData.data)
                const authUser = meData.data || meData.user
                if (authUser?.companyId) setCompanyId(authUser.companyId)
            } catch (err) {
                setError('データの取得に失敗しました')
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target
        setForm((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
        }))
    }

    const openEdit = (dept: Department) => {
        setEditTarget(dept)
        setForm({
            code: dept.code,
            name: dept.name,
            startTime: dept.startTime,
            endTime: dept.endTime,
            breakStartTime: '',
            breakEndTime: '',
            breakMinutes: dept.breakMinutes.toString(),
            scheduledWorkMinutesPerDay: dept.scheduledWorkMinutesPerDay.toString(),
            annualWorkDays: dept.annualWorkDays.toString(),
            annualHolidays: dept.annualWorkDays.toString(),
            annualWorkMinutes: '124800',
            monthlyAverageWorkMinutes: '10400',
            overtimeBoundaryType: dept.overtimeBoundaryType,
            lateNightEnabled: dept.lateNightEnabled,
            fixedOvertimeEnabled: dept.fixedOvertimeEnabled,
            fixedOvertimeMinutes: dept.fixedOvertimeMinutes.toString(),
            fixedOvertimeAllowanceName: '',
            allowWithinScheduledOvertime: false,
            notes: dept.notes ?? '',
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
                companyId,
                code: form.code,
                name: form.name,
                startTime: form.startTime,
                endTime: form.endTime,
                breakStartTime: form.breakStartTime || null,
                breakEndTime: form.breakEndTime || null,
                breakMinutes: parseInt(form.breakMinutes),
                scheduledWorkMinutesPerDay: parseInt(form.scheduledWorkMinutesPerDay),
                annualWorkDays: parseInt(form.annualWorkDays),
                annualHolidays: parseInt(form.annualHolidays),
                annualWorkMinutes: parseInt(form.annualWorkMinutes),
                monthlyAverageWorkMinutes: parseInt(form.monthlyAverageWorkMinutes),
                overtimeBoundaryType: form.overtimeBoundaryType,
                lateNightEnabled: form.lateNightEnabled,
                fixedOvertimeEnabled: form.fixedOvertimeEnabled,
                fixedOvertimeMinutes: parseInt(form.fixedOvertimeMinutes),
                fixedOvertimeAllowanceName: form.fixedOvertimeAllowanceName || null,
                allowWithinScheduledOvertime: form.allowWithinScheduledOvertime,
                notes: form.notes || null,
            }

            let res: Response
            if (editTarget) {
                res = await fetch(`/api/admin/departments/${editTarget.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(payload),
                })
            } else {
                res = await fetch('/api/admin/departments', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(payload),
                })
            }

            const data = await res.json()
            if (!res.ok || !data.success) throw new Error(data.error?.message || '保存に失敗しました')

            setSuccess(editTarget ? '部門情報を更新しました' : '部門を作成しました')
            setEditTarget(null)
            setShowNew(false)
            setTimeout(() => setSuccess(''), 3000)

            // Refresh list
            const deptRes = await fetch('/api/admin/departments', { credentials: 'include' })
            const deptData = await deptRes.json()
            if (deptData.success) setDepartments(deptData.data)
        } catch (err) {
            setError(err instanceof Error ? err.message : '保存に失敗しました')
        } finally {
            setSaving(false)
        }
    }

    const isFormOpen = showNew || editTarget !== null

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">部門管理</h1>
                    <p className="text-sm text-slate-500 mt-0.5">部門の勤務設定を管理します</p>
                </div>
                <button
                    onClick={openNew}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                    + 新規部門
                </button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                    {error}
                    <button onClick={() => setError('')} className="ml-2 text-red-500">✕</button>
                </div>
            )}
            {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
                    {success}
                </div>
            )}

            {/* 部門一覧 */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    </div>
                ) : departments.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-sm">部門が登録されていません</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-slate-50">
                                    <th className="text-left font-medium text-slate-600 px-4 py-3 border-b border-slate-200">コード</th>
                                    <th className="text-left font-medium text-slate-600 px-4 py-3 border-b border-slate-200">部門名</th>
                                    <th className="text-left font-medium text-slate-600 px-4 py-3 border-b border-slate-200">勤務時間</th>
                                    <th className="text-left font-medium text-slate-600 px-4 py-3 border-b border-slate-200">休憩</th>
                                    <th className="text-left font-medium text-slate-600 px-4 py-3 border-b border-slate-200">残業境界</th>
                                    <th className="text-left font-medium text-slate-600 px-4 py-3 border-b border-slate-200">従業員数</th>
                                    <th className="text-left font-medium text-slate-600 px-4 py-3 border-b border-slate-200">操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {departments.map((dept) => (
                                    <tr key={dept.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 border-b border-slate-100 font-mono text-slate-600">{dept.code}</td>
                                        <td className="px-4 py-3 border-b border-slate-100 font-medium text-slate-800">{dept.name}</td>
                                        <td className="px-4 py-3 border-b border-slate-100 text-slate-700 font-mono text-xs">{dept.startTime} 〜 {dept.endTime}</td>
                                        <td className="px-4 py-3 border-b border-slate-100 text-slate-700">{dept.breakMinutes}分</td>
                                        <td className="px-4 py-3 border-b border-slate-100 text-slate-700 text-xs">{overtimeBoundaryLabels[dept.overtimeBoundaryType] || dept.overtimeBoundaryType}</td>
                                        <td className="px-4 py-3 border-b border-slate-100 text-slate-700">{dept._count.employees}名</td>
                                        <td className="px-4 py-3 border-b border-slate-100">
                                            <button
                                                onClick={() => openEdit(dept)}
                                                className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                                            >
                                                編集
                                            </button>
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
                <div className="bg-white rounded-xl border border-blue-200 p-6 space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-semibold text-slate-800">
                            {editTarget ? `部門の編集: ${editTarget.name}` : '新規部門の作成'}
                        </h2>
                        <button
                            onClick={() => { setEditTarget(null); setShowNew(false) }}
                            className="text-slate-400 hover:text-slate-600"
                        >
                            ✕
                        </button>
                    </div>

                    <form onSubmit={handleSave} className="space-y-6">
                        {/* 基本情報 */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">基本情報</h3>
                            <div className="grid sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">部門コード <span className="text-red-500">*</span></label>
                                    <input type="text" name="code" value={form.code} onChange={handleChange} required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="DEPT01" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">部門名 <span className="text-red-500">*</span></label>
                                    <input type="text" name="name" value={form.name} onChange={handleChange} required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="営業部" />
                                </div>
                            </div>
                        </div>

                        {/* 勤務時間 */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">勤務時間</h3>
                            <div className="grid sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">始業時刻 <span className="text-red-500">*</span></label>
                                    <input type="time" name="startTime" value={form.startTime} onChange={handleChange} required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">終業時刻 <span className="text-red-500">*</span></label>
                                    <input type="time" name="endTime" value={form.endTime} onChange={handleChange} required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">休憩開始</label>
                                    <input type="time" name="breakStartTime" value={form.breakStartTime} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">休憩終了</label>
                                    <input type="time" name="breakEndTime" value={form.breakEndTime} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">休憩時間 (分)</label>
                                    <input type="number" name="breakMinutes" value={form.breakMinutes} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">所定労働時間/日 (分)</label>
                                    <input type="number" name="scheduledWorkMinutesPerDay" value={form.scheduledWorkMinutesPerDay} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                            </div>
                        </div>

                        {/* 年間設定 */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">年間設定</h3>
                            <div className="grid sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">年間労働日数</label>
                                    <input type="number" name="annualWorkDays" value={form.annualWorkDays} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">年間休日日数</label>
                                    <input type="number" name="annualHolidays" value={form.annualHolidays} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">年間労働時間 (分)</label>
                                    <input type="number" name="annualWorkMinutes" value={form.annualWorkMinutes} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">月平均労働時間 (分)</label>
                                    <input type="number" name="monthlyAverageWorkMinutes" value={form.monthlyAverageWorkMinutes} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                            </div>
                        </div>

                        {/* 残業設定 */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">残業設定</h3>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">残業発生境界</label>
                                <select name="overtimeBoundaryType" value={form.overtimeBoundaryType} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    <option value="daily_8h">1日8時間超</option>
                                    <option value="daily_set">所定時間超（日次）</option>
                                    <option value="weekly_40h">週40時間超</option>
                                </select>
                            </div>
                            <div className="flex gap-6">
                                <label className="flex items-center gap-2 text-sm text-slate-700">
                                    <input type="checkbox" name="allowWithinScheduledOvertime" checked={form.allowWithinScheduledOvertime} onChange={handleChange} className="rounded border-slate-300" />
                                    所定内残業を残業に含める
                                </label>
                                <label className="flex items-center gap-2 text-sm text-slate-700">
                                    <input type="checkbox" name="lateNightEnabled" checked={form.lateNightEnabled} onChange={handleChange} className="rounded border-slate-300" />
                                    深夜割増あり
                                </label>
                            </div>
                            <div className="space-y-3">
                                <label className="flex items-center gap-2 text-sm text-slate-700">
                                    <input type="checkbox" name="fixedOvertimeEnabled" checked={form.fixedOvertimeEnabled} onChange={handleChange} className="rounded border-slate-300" />
                                    固定残業制（みなし残業）
                                </label>
                                {form.fixedOvertimeEnabled && (
                                    <div className="grid sm:grid-cols-2 gap-4 pl-6">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">固定残業時間 (分)</label>
                                            <input type="number" name="fixedOvertimeMinutes" value={form.fixedOvertimeMinutes} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">手当名称</label>
                                            <input type="text" name="fixedOvertimeAllowanceName" value={form.fixedOvertimeAllowanceName} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="固定残業手当" />
                                        </div>
                                    </div>
                                )}
                            </div>
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
        </div>
    )
}
