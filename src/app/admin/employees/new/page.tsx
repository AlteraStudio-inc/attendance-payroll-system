'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewEmployeePage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [showConfirm, setShowConfirm] = useState(false)

    const [form, setForm] = useState({
        employeeCode: '',
        name: '',
        email: '',
        password: '',
        pin: '',
        role: 'EMPLOYEE' as const,
        employmentType: 'FULL_TIME' as const,
        wageType: 'FIXED' as const,
        hourlyRate: '',
        monthlySalary: '',
        minimumWage: '1000',
        deemedOvertimeEnabled: false,
        deemedOvertimeHours: '0',
    })

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target
        setForm((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
        }))
    }

    const handleSubmit = async () => {
        setLoading(true)
        setError('')

        try {
            const payload = {
                ...form,
                hourlyRate: form.hourlyRate ? parseFloat(form.hourlyRate) : undefined,
                monthlySalary: form.monthlySalary ? parseFloat(form.monthlySalary) : undefined,
                minimumWage: parseFloat(form.minimumWage),
                deemedOvertimeHours: parseFloat(form.deemedOvertimeHours),
                pin: form.pin || undefined,
            }

            const res = await fetch('/api/employees', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error)
            }

            router.push('/admin/employees')
        } catch (err) {
            setError(err instanceof Error ? err.message : '作成に失敗しました')
            setShowConfirm(false)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/admin/employees" className="text-slate-600 hover:text-slate-800">
                    ← 戻る
                </Link>
                <h1 className="text-2xl font-bold text-slate-800">従業員の追加</h1>
            </div>

            {error && (
                <div className="alert alert-error">{error}</div>
            )}

            <div className="card space-y-6">
                {/* 基本情報 */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-slate-700 border-b pb-2">基本情報</h2>

                    <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                従業員コード <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="employeeCode"
                                value={form.employeeCode}
                                onChange={handleChange}
                                className="input"
                                placeholder="例: EMP001"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                氏名 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="name"
                                value={form.name}
                                onChange={handleChange}
                                className="input"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            メールアドレス <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="email"
                            name="email"
                            value={form.email}
                            onChange={handleChange}
                            className="input"
                            required
                        />
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                パスワード <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="password"
                                name="password"
                                value={form.password}
                                onChange={handleChange}
                                className="input"
                                placeholder="6文字以上"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                PIN (打刻用)
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

                    <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                権限
                            </label>
                            <select
                                name="role"
                                value={form.role}
                                onChange={handleChange}
                                className="input"
                            >
                                <option value="EMPLOYEE">従業員</option>
                                <option value="ADMIN">管理者</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                雇用形態
                            </label>
                            <select
                                name="employmentType"
                                value={form.employmentType}
                                onChange={handleChange}
                                className="input"
                            >
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
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                勤務形態
                            </label>
                            <select
                                name="wageType"
                                value={form.wageType}
                                onChange={handleChange}
                                className="input"
                            >
                                <option value="FIXED">固定給制</option>
                                <option value="HOURLY">時給制</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                最低賃金設定 (円)
                            </label>
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
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                時給 (円) <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                name="hourlyRate"
                                value={form.hourlyRate}
                                onChange={handleChange}
                                className="input"
                                required
                            />
                        </div>
                    )}

                    {form.wageType === 'FIXED' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                月給 (円) <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                name="monthlySalary"
                                value={form.monthlySalary}
                                onChange={handleChange}
                                className="input"
                                required
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
                            <span className="text-sm text-slate-700">みなし残業制を適用</span>
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

                {/* 送信ボタン */}
                <div className="flex gap-3 pt-4">
                    <Link href="/admin/employees" className="btn btn-secondary flex-1">
                        キャンセル
                    </Link>
                    <button
                        type="button"
                        onClick={() => setShowConfirm(true)}
                        className="btn btn-primary flex-1"
                    >
                        追加する
                    </button>
                </div>
            </div>

            {/* 確認ダイアログ */}
            {showConfirm && (
                <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-slate-800 mb-4">
                            従業員の追加確認
                        </h3>
                        <p className="text-slate-600 mb-6">
                            <strong>{form.name}</strong>（{form.employeeCode}）を追加しますか？
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="btn btn-secondary"
                                disabled={loading}
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handleSubmit}
                                className="btn btn-primary"
                                disabled={loading}
                            >
                                {loading ? '追加中...' : '追加する'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
