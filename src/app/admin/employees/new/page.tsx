'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Department {
    id: string
    code: string
    name: string
}

interface Company {
    id: string
    name: string
}

export default function NewEmployeePage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [showConfirm, setShowConfirm] = useState(false)
    const [departments, setDepartments] = useState<Department[]>([])
    const [companies, setCompanies] = useState<Company[]>([])
    const [companyId, setCompanyId] = useState('')

    const [form, setForm] = useState({
        employeeCode: '',
        name: '',
        email: '',
        password: '',
        departmentId: '',
        employmentType: 'full_time',
        payType: 'monthly',
        joinDate: '',
        userRole: 'employee',
        // Salary setting
        monthlySalary: '',
        hourlyRate: '',
        baseSalary: '',
        positionAllowance: '',
        commutingAllowance: '',
        socialInsuranceEnrolled: true,
        employmentInsuranceEnrolled: true,
        dependentsCount: '0',
    })

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                // Get departments
                const deptRes = await fetch('/api/admin/departments', { credentials: 'include' })
                const deptData = await deptRes.json()
                if (deptData.success) {
                    setDepartments(deptData.data)
                }

                // Get auth info to obtain companyId
                const meRes = await fetch('/api/auth/me', { credentials: 'include' })
                const meData = await meRes.json()
                const authUser = meData.data || meData.user
                if (authUser?.companyId) {
                    setCompanyId(authUser.companyId)
                }
            } catch (err) {
                console.error('Failed to load initial data:', err)
            }
        }
        fetchInitialData()
    }, [])

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
            const salarySetting: Record<string, unknown> = {
                effectiveFrom: form.joinDate || new Date().toISOString().split('T')[0],
                socialInsuranceEnrolled: form.socialInsuranceEnrolled,
                employmentInsuranceEnrolled: form.employmentInsuranceEnrolled,
                dependentsCount: parseInt(form.dependentsCount) || 0,
            }

            if (form.payType === 'monthly' && form.monthlySalary) {
                salarySetting.monthlySalary = parseFloat(form.monthlySalary)
                salarySetting.baseSalary = form.baseSalary ? parseFloat(form.baseSalary) : parseFloat(form.monthlySalary)
            }
            if (form.payType === 'hourly' && form.hourlyRate) {
                salarySetting.hourlyRate = parseFloat(form.hourlyRate)
            }
            if (form.positionAllowance) salarySetting.positionAllowance = parseFloat(form.positionAllowance)
            if (form.commutingAllowance) salarySetting.commutingAllowance = parseFloat(form.commutingAllowance)

            const payload = {
                companyId,
                departmentId: form.departmentId,
                employeeCode: form.employeeCode,
                name: form.name,
                email: form.email || undefined,
                password: form.password,
                employmentType: form.employmentType,
                payType: form.payType,
                joinDate: form.joinDate || undefined,
                userRole: form.userRole,
                salarySetting,
            }

            const res = await fetch('/api/admin/employees', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload),
            })

            const data = await res.json()

            if (!res.ok || !data.success) {
                throw new Error(data.error?.message || '作成に失敗しました')
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
                <Link href="/admin/employees" className="text-slate-500 hover:text-slate-700 text-sm">
                    ← 従業員一覧
                </Link>
                <h1 className="text-2xl font-bold text-slate-800">従業員の追加</h1>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                    {error}
                </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
                {/* 基本情報 */}
                <div className="space-y-4">
                    <h2 className="text-base font-semibold text-slate-700 border-b border-slate-200 pb-2">基本情報</h2>

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
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                メールアドレス
                            </label>
                            <input
                                type="email"
                                name="email"
                                value={form.email}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                パスワード <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="password"
                                name="password"
                                value={form.password}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="6文字以上"
                                required
                            />
                        </div>
                    </div>
                </div>

                {/* 雇用情報 */}
                <div className="space-y-4">
                    <h2 className="text-base font-semibold text-slate-700 border-b border-slate-200 pb-2">雇用情報</h2>

                    <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                部門 <span className="text-red-500">*</span>
                            </label>
                            <select
                                name="departmentId"
                                value={form.departmentId}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                            >
                                <option value="">部門を選択</option>
                                {departments.map((d) => (
                                    <option key={d.id} value={d.id}>
                                        [{d.code}] {d.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">入社日</label>
                            <input
                                type="date"
                                name="joinDate"
                                value={form.joinDate}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    <div className="grid sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">雇用形態</label>
                            <select
                                name="employmentType"
                                value={form.employmentType}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="full_time">正社員</option>
                                <option value="contract">契約社員</option>
                                <option value="part_time">パート</option>
                                <option value="hourly">アルバイト</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">給与形態</label>
                            <select
                                name="payType"
                                value={form.payType}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="monthly">月給制</option>
                                <option value="hourly">時給制</option>
                                <option value="daily">日給制</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">権限</label>
                            <select
                                name="userRole"
                                value={form.userRole}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="employee">従業員</option>
                                <option value="admin">管理者</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* 給与情報 */}
                <div className="space-y-4">
                    <h2 className="text-base font-semibold text-slate-700 border-b border-slate-200 pb-2">初期給与設定</h2>

                    {form.payType === 'monthly' && (
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">月給 (円)</label>
                                <input
                                    type="number"
                                    name="monthlySalary"
                                    value={form.monthlySalary}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="300000"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">基本給 (円)</label>
                                <input
                                    type="number"
                                    name="baseSalary"
                                    value={form.baseSalary}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="未入力の場合は月給と同額"
                                />
                            </div>
                        </div>
                    )}

                    {form.payType === 'hourly' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">時給 (円)</label>
                            <input
                                type="number"
                                name="hourlyRate"
                                value={form.hourlyRate}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="1100"
                            />
                        </div>
                    )}

                    <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">役職手当 (円)</label>
                            <input
                                type="number"
                                name="positionAllowance"
                                value={form.positionAllowance}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="0"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">通勤手当 (円)</label>
                            <input
                                type="number"
                                name="commutingAllowance"
                                value={form.commutingAllowance}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="0"
                            />
                        </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">扶養人数</label>
                            <input
                                type="number"
                                name="dependentsCount"
                                value={form.dependentsCount}
                                onChange={handleChange}
                                min="0"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    <div className="flex gap-6">
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                            <input
                                type="checkbox"
                                name="socialInsuranceEnrolled"
                                checked={form.socialInsuranceEnrolled}
                                onChange={handleChange}
                                className="rounded border-slate-300"
                            />
                            社会保険加入
                        </label>
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                            <input
                                type="checkbox"
                                name="employmentInsuranceEnrolled"
                                checked={form.employmentInsuranceEnrolled}
                                onChange={handleChange}
                                className="rounded border-slate-300"
                            />
                            雇用保険加入
                        </label>
                    </div>
                </div>

                {/* ボタン */}
                <div className="flex gap-3 pt-2">
                    <Link
                        href="/admin/employees"
                        className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-center"
                    >
                        キャンセル
                    </Link>
                    <button
                        type="button"
                        onClick={() => setShowConfirm(true)}
                        disabled={!form.employeeCode || !form.name || !form.password || !form.departmentId}
                        className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        追加する
                    </button>
                </div>
            </div>

            {/* 確認ダイアログ */}
            {showConfirm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowConfirm(false)}>
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-slate-800 mb-2">従業員の追加確認</h3>
                        <p className="text-slate-600 mb-6">
                            <strong>{form.name}</strong>（{form.employeeCode}）を追加しますか？
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowConfirm(false)}
                                disabled={loading}
                                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={loading}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
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
