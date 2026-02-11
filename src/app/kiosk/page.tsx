'use client'

import { useState, useEffect } from 'react'

export default function KioskPage() {
    const [employeeCode, setEmployeeCode] = useState('')
    const [pin, setPin] = useState('')
    const [currentTime, setCurrentTime] = useState('')
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [loading, setLoading] = useState(false)
    const [employeeName, setEmployeeName] = useState('')
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [hasClockedIn, setHasClockedIn] = useState(false)

    // 現在時刻を更新
    useEffect(() => {
        const updateTime = () => {
            const now = new Date()
            setCurrentTime(
                now.toLocaleDateString('ja-JP', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    weekday: 'long',
                }) +
                ' ' +
                now.toLocaleTimeString('ja-JP', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                })
            )
        }
        updateTime()
        const interval = setInterval(updateTime, 1000)
        return () => clearInterval(interval)
    }, [])

    // メッセージを自動で消す
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(null), 5000)
            return () => clearTimeout(timer)
        }
    }, [message])

    // 従業員コード + PINで認証
    const handleAuthenticate = async () => {
        if (!employeeCode || !pin) {
            setMessage({ type: 'error', text: '従業員コードとPINを入力してください' })
            return
        }

        setLoading(true)
        setMessage(null)

        try {
            const response = await fetch('/api/kiosk/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ employeeCode, pin }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || '認証に失敗しました')
            }

            setEmployeeName(data.name)
            setHasClockedIn(data.hasClockedIn)
            setIsAuthenticated(true)
        } catch (err) {
            setMessage({ type: 'error', text: err instanceof Error ? err.message : '認証に失敗しました' })
        } finally {
            setLoading(false)
        }
    }

    // 出勤打刻
    const handleClockIn = async () => {
        setLoading(true)
        setMessage(null)

        try {
            const response = await fetch('/api/attendance/clock-in', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ employeeCode }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || '出勤打刻に失敗しました')
            }

            setMessage({ type: 'success', text: `出勤しました (${data.clockIn})` })
            setHasClockedIn(true)

            // 3秒後にリセット
            setTimeout(() => resetKiosk(), 3000)
        } catch (err) {
            setMessage({ type: 'error', text: err instanceof Error ? err.message : '出勤打刻に失敗しました' })
        } finally {
            setLoading(false)
        }
    }

    // 退勤打刻
    const handleClockOut = async () => {
        setLoading(true)
        setMessage(null)

        try {
            const response = await fetch('/api/attendance/clock-out', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ employeeCode }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || '退勤打刻に失敗しました')
            }

            setMessage({ type: 'success', text: `退勤しました (${data.clockOut})` })

            // 3秒後にリセット
            setTimeout(() => resetKiosk(), 3000)
        } catch (err) {
            setMessage({ type: 'error', text: err instanceof Error ? err.message : '退勤打刻に失敗しました' })
        } finally {
            setLoading(false)
        }
    }

    // 画面リセット
    const resetKiosk = () => {
        setEmployeeCode('')
        setPin('')
        setEmployeeName('')
        setIsAuthenticated(false)
        setHasClockedIn(false)
        setMessage(null)
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-800 flex flex-col items-center justify-center p-4">
            {/* 現在時刻 */}
            <div className="text-white text-center mb-8">
                <div className="text-4xl md:text-5xl font-bold mb-2">
                    {currentTime.split(' ').slice(-1)[0]}
                </div>
                <div className="text-lg md:text-xl text-primary-100">
                    {currentTime.split(' ').slice(0, -1).join(' ')}
                </div>
            </div>

            {/* メインカード */}
            <div className="card max-w-md w-full">
                <h1 className="text-2xl font-bold text-center text-slate-800 mb-6">
                    勤怠打刻
                </h1>

                {/* メッセージ */}
                {message && (
                    <div
                        className={`alert mb-6 ${message.type === 'success' ? 'alert-success' : 'alert-error'
                            }`}
                    >
                        {message.text}
                    </div>
                )}

                {!isAuthenticated ? (
                    // 認証フォーム
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                従業員コード
                            </label>
                            <input
                                type="text"
                                value={employeeCode}
                                onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())}
                                className="input text-center text-lg"
                                placeholder="例: EMP001"
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                PIN
                            </label>
                            <input
                                type="password"
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                className="input text-center text-lg"
                                placeholder="4桁のPIN"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                            />
                        </div>

                        <button
                            onClick={handleAuthenticate}
                            disabled={loading}
                            className="btn btn-primary btn-lg w-full"
                        >
                            {loading ? '確認中...' : '確認'}
                        </button>
                    </div>
                ) : (
                    // 打刻ボタン
                    <div className="space-y-6">
                        <div className="text-center">
                            <p className="text-lg text-slate-600">ようこそ</p>
                            <p className="text-2xl font-bold text-slate-800">{employeeName} さん</p>
                        </div>

                        <div className="flex justify-center">
                            {!hasClockedIn ? (
                                <button
                                    onClick={handleClockIn}
                                    disabled={loading}
                                    className="kiosk-btn kiosk-btn-clock-in"
                                >
                                    {loading ? '処理中...' : '出勤'}
                                </button>
                            ) : (
                                <button
                                    onClick={handleClockOut}
                                    disabled={loading}
                                    className="kiosk-btn kiosk-btn-clock-out"
                                >
                                    {loading ? '処理中...' : '退勤'}
                                </button>
                            )}
                        </div>

                        <button
                            onClick={resetKiosk}
                            className="btn btn-secondary w-full"
                        >
                            キャンセル
                        </button>
                    </div>
                )}
            </div>

            {/* フッター */}
            <div className="mt-8 text-primary-200 text-sm">
                勤怠・給与管理システム
            </div>
        </div>
    )
}
