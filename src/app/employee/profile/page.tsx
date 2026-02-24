'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ProfilePage() {
    const router = useRouter()
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [newPin, setNewPin] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setMessage(null)

        if (newPassword && newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: '新しいパスワードが一致しません' })
            setLoading(false)
            return
        }

        try {
            const res = await fetch('/api/employee/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentPassword,
                    password: newPassword || undefined,
                    pin: newPin || undefined,
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || '更新に失敗しました')
            }

            setMessage({ type: 'success', text: 'プロフィールを更新しました' })
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
            setNewPin('')
        } catch (err) {
            setMessage({ type: 'error', text: err instanceof Error ? err.message : 'エラーが発生しました' })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            <h1 className="text-xl font-bold text-slate-800">プロフィール設定</h1>

            <div className="card">
                <form onSubmit={handleSubmit} className="space-y-4">
                    {message && (
                        <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
                            {message.text}
                        </div>
                    )}

                    <div>
                        <label className="label">現在のパスワード</label>
                        <input
                            type="password"
                            required
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="input"
                            placeholder="本人確認のため入力してください"
                        />
                    </div>

                    <hr className="border-slate-200" />

                    <div>
                        <label className="label">新しいパスワード（任意）</label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="input"
                            placeholder="6文字以上で入力"
                            minLength={6}
                        />
                    </div>

                    <div>
                        <label className="label">新しいパスワード（確認）</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="input"
                            placeholder="再度入力してください"
                        />
                    </div>

                    <hr className="border-slate-200" />

                    <div>
                        <label className="label">新しい打刻PIN（任意 / 4〜6桁）</label>
                        <input
                            type="text"
                            inputMode="numeric"
                            pattern="\d{4,6}"
                            value={newPin}
                            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                            className="input"
                            placeholder="例: 1234"
                        />
                        <p className="text-xs text-slate-500 mt-1">※キオスク端末での打刻に使用します</p>
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn btn-primary w-full"
                        >
                            {loading ? '更新中...' : '設定を保存する'}
                        </button>
                    </div>
                </form>
            </div>

            <div className="text-center">
                <button
                    onClick={() => router.back()}
                    className="text-sm text-slate-500 hover:text-slate-700"
                >
                    ← 戻る
                </button>
            </div>
        </div>
    )
}
