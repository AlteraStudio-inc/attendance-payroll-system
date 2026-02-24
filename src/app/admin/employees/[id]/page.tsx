'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Employee {
    id: string
    employeeCode: string
    name: string
    email: string
    role: 'EMPLOYEE' | 'ADMIN'
    jobType: string
    employmentType: string
    wageType: string
    hourlyRate: number | null
    monthlySalary: number | null
    minimumWage: number
    deemedOvertimeEnabled: boolean
    deemedOvertimeHours: number
    isActive: boolean
}

export default function EditEmployeePage({ params }: { params: { id: string } }) {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    // params.id は Promiseではなくそのまま展開できる形に修正
    const employeeId = params.id

    const [form, setForm] = useState({
        name: '',
        email: '',
        password: '',
        pin: '',
        role: 'EMPLOYEE' as 'EMPLOYEE' | 'ADMIN',
        jobType: 'OTHER' as 'CONSTRUCTION' | 'NAIL' | 'EYELASH' | 'SUPPORT' | 'OTHER',
        employmentType: 'FULL_TIME' as 'FULL_TIME' | 'CONTRACT' | 'PART_TIME' | 'HOURLY',
        wageType: 'FIXED' as 'FIXED' | 'HOURLY',
        hourlyRate: '',
        monthlySalary: '',
        minimumWage: '1000',
        deemedOvertimeEnabled: false,
        deemedOvertimeHours: '0',
        isActive: true,
    })

    useEffect(() => {
        const fetchEmployee = async () => {
            try {
                const res = await fetch(`/api/employees/${employeeId}`)
                const data = await res.json()

                if (!res.ok) throw new Error(data.error)

                const emp: Employee = data.employee
                setForm({
                    name: emp.name,
                    email: emp.email,
                    password: '',
                    pin: '',
                    role: emp.role,
                    jobType: emp.jobType as 'CONSTRUCTION' | 'NAIL' | 'EYELASH' | 'SUPPORT' | 'OTHER',
                    employmentType: emp.employmentType as 'FULL_TIME' | 'CONTRACT' | 'PART_TIME' | 'HOURLY',
                    wageType: emp.wageType as 'FIXED' | 'HOURLY',
                    hourlyRate: emp.hourlyRate?.toString() || '',
                    monthlySalary: emp.monthlySalary?.toString() || '',
                    minimumWage: emp.minimumWage.toString(),
                    deemedOvertimeEnabled: emp.deemedOvertimeEnabled,
                    deemedOvertimeHours: emp.deemedOvertimeHours.toString(),
                    isActive: emp.isActive,
                })
            } catch (err) {
                setError(err instanceof Error ? err.message : '取得に失敗しました')
            } finally {
                setLoading(false)
            }
        }

        fetchEmployee()
    }, [employeeId])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target
        setForm((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
        }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        setError('')
        setSuccess('')

        try {
            const payload: Record<string, unknown> = {
                name: form.name,
                email: form.email,
                role: form.role,
                jobType: form.jobType,
                employmentType: form.employmentType,
                wageType: form.wageType,
                minimumWage: parseFloat(form.minimumWage),
                deemedOvertimeEnabled: form.deemedOvertimeEnabled,
                deemedOvertimeHours: parseFloat(form.deemedOvertimeHours),
                isActive: form.isActive,
            }

            if (form.hourlyRate) payload.hourlyRate = parseFloat(form.hourlyRate)
            if (form.monthlySalary) payload.monthlySalary = parseFloat(form.monthlySalary)
            if (form.password) payload.password = form.password
            if (form.pin) payload.pin = form.pin

            const res = await fetch(`/api/employees/${employeeId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            const data = await res.json()

            if (!res.ok) throw new Error(data.error)

            setSuccess('保存しました')
            setTimeout(() => setSuccess(''), 3000)
        } catch (err) {
            setError(err instanceof Error ? err.message : '保存に失敗しました')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="spinner w-12 h-12"></div>
            </div>
        )
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/admin/employees" className="text-slate-600 hover:text-slate-800">
                    ← 戻る
                </Link>
                <h1 className="text-2xl font-bold text-slate-800">従業員の編集</h1>
            </div>

            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <form onSubmit={handleSubmit} className="card space-y-6">
                {/* 状態 */}
                <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            name="isActive"
                            checked={form.isActive}
                            onChange={handleChange}
                            className="rounded border-slate-300"
                        />
                        <span className="text-sm text-slate-700">在籍中</span>
                    </label>
                    <span className={`badge ${form.isActive ? 'badge-approved' : 'badge-rejected'}`}>
                        {form.isActive ? '在籍' : '退職'}
                    </span>
                </div>

                {/* 基本情報 */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-slate-700 border-b pb-2">基本情報</h2>

                    <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">氏名</label>
                            <input
                                type="text"
                                name="name"
                                value={form.name}
                                onChange={handleChange}
                                className="input"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">メール</label>
                            <input
                                type="email"
                                name="email"
                                value={form.email}
                                onChange={handleChange}
                                className="input"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                新しいパスワード (変更する場合)
                            </label>
                            <input
                                type="password"
                                name="password"
                                value={form.password}
                                onChange={handleChange}
                                className="input"
                                placeholder="変更しない場合は空欄"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                新しいPIN (変更する場合)
                            </label>
                            <input
                                type="text"
                                name="pin"
                                value={form.pin}
                                onChange={handleChange}
                                className="input"
                                placeholder="4〜6桁の数字"
                                pattern="[0-9]{4,6}"
                            />
                        </div>
                    </div>
                </div>

                {/* 雇用情報 */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-slate-700 border-b pb-2">雇用情報</h2>

                    <div className="grid sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">権限</label>
                            <select name="role" value={form.role} onChange={handleChange} className="input">
                                <option value="EMPLOYEE">従業員</option>
                                <option value="ADMIN">管理者</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">職種</label>
                            <select name="jobType" value={form.jobType} onChange={handleChange} className="input">
                                <option value="CONSTRUCTION">建設</option>
                                <option value="NAIL">ネイル</option>
                                <option value="EYELASH">アイラッシュ</option>
                                <option value="SUPPORT">就労支援</option>
                                <option value="OTHER">その他</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">雇用形態</label>
                            <select name="employmentType" value={form.employmentType} onChange={handleChange} className="input">
                                <option value="FULL_TIME">正社員</option>
                                <option value="CONTRACT">契約社員</option>
                                <option value="PART_TIME">パート</option>
                                <option value="HOURLY">アルバイト</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* 給与情報 */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-slate-700 border-b pb-2">給与情報</h2>

                    <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">勤務形態</label>
                            <select name="wageType" value={form.wageType} onChange={handleChange} className="input">
                                <option value="FIXED">固定給制</option>
                                <option value="HOURLY">時給制</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">最低賃金 (円)</label>
                            <input
                                type="number"
                                name="minimumWage"
                                value={form.minimumWage}
                                onChange={handleChange}
                                className="input"
                            />
                        </div>
                    </div>

                    {form.wageType === 'HOURLY' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">時給 (円)</label>
                            <input
                                type="number"
                                name="hourlyRate"
                                value={form.hourlyRate}
                                onChange={handleChange}
                                className="input"
                            />
                        </div>
                    )}

                    {form.wageType === 'FIXED' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">月給 (円)</label>
                            <input
                                type="number"
                                name="monthlySalary"
                                value={form.monthlySalary}
                                onChange={handleChange}
                                className="input"
                            />
                        </div>
                    )}

                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                name="deemedOvertimeEnabled"
                                checked={form.deemedOvertimeEnabled}
                                onChange={handleChange}
                                className="rounded border-slate-300"
                            />
                            <span className="text-sm text-slate-700">みなし残業制</span>
                        </label>
                        {form.deemedOvertimeEnabled && (
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    name="deemedOvertimeHours"
                                    value={form.deemedOvertimeHours}
                                    onChange={handleChange}
                                    className="input w-24"
                                />
                                <span className="text-sm text-slate-600">時間</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* ボタン */}
                <div className="flex gap-3 pt-4">
                    <Link href="/admin/employees" className="btn btn-secondary flex-1">
                        キャンセル
                    </Link>
                    <button type="submit" className="btn btn-primary flex-1" disabled={saving}>
                        {saving ? '保存中...' : '保存する'}
                    </button>
                </div>
            </form>
        </div>
    )
}
