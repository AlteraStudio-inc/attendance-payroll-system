'use client'

import { useState, useEffect } from 'react'

type Tab = 'clock' | 'request'
type RequestType = 'paid_leave' | 'work_time'

interface TimeEntry {
    id: string
    date: string
    clockIn: string
    clockOut: string | null
}

export default function KioskPage() {
    const [employeeCode, setEmployeeCode] = useState('')
    const [pin, setPin] = useState('')
    const [currentTime, setCurrentTime] = useState('')
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [loading, setLoading] = useState(false)
    const [employeeName, setEmployeeName] = useState('')
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [hasClockedIn, setHasClockedIn] = useState(false)
    const [activeTab, setActiveTab] = useState<Tab>('clock')
    const [clockNote, setClockNote] = useState('') // 追加: 打刻時の備考

    // 申請用の状態
    const [requestType, setRequestType] = useState<RequestType>('paid_leave')
    const [leaveDate, setLeaveDate] = useState('')
    const [requestReason, setRequestReason] = useState('')
    const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
    const [selectedEntryId, setSelectedEntryId] = useState('')
    const [correctedClockIn, setCorrectedClockIn] = useState('')
    const [correctedClockOut, setCorrectedClockOut] = useState('')
    const [entriesLoading, setEntriesLoading] = useState(false)

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
                body: JSON.stringify({ employeeCode, note: clockNote }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || '出勤打刻に失敗しました')
            }

            setMessage({ type: 'success', text: `出勤しました (${data.clockIn})` })
            setHasClockedIn(true)

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
                body: JSON.stringify({ employeeCode, note: clockNote }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || '退勤打刻に失敗しました')
            }

            setMessage({ type: 'success', text: `退勤しました (${data.clockOut})` })

            setTimeout(() => resetKiosk(), 3000)
        } catch (err) {
            setMessage({ type: 'error', text: err instanceof Error ? err.message : '退勤打刻に失敗しました' })
        } finally {
            setLoading(false)
        }
    }

    // 勤怠一覧を取得（打刻修正用）
    const fetchTimeEntries = async () => {
        setEntriesLoading(true)
        try {
            const res = await fetch(`/api/kiosk/request?employeeCode=${employeeCode}`)
            const data = await res.json()
            if (res.ok) {
                setTimeEntries(data.entries || [])
            }
        } catch {
            // エラーは無視
        } finally {
            setEntriesLoading(false)
        }
    }

    // 申請タブに切り替えた時に勤怠を取得
    useEffect(() => {
        if (activeTab === 'request' && isAuthenticated && requestType === 'work_time') {
            fetchTimeEntries()
        }
    }, [activeTab, requestType, isAuthenticated])

    // 申請送信
    const handleSubmitRequest = async () => {
        setLoading(true)
        setMessage(null)

        try {
            const payload: Record<string, unknown> = {
                employeeCode,
                pin,
                type: requestType,
            }

            if (requestType === 'paid_leave') {
                if (!leaveDate) {
                    setMessage({ type: 'error', text: '有給日を選択してください' })
                    setLoading(false)
                    return
                }
                payload.leaveDate = leaveDate
                payload.reason = requestReason || undefined
            } else if (requestType === 'work_time') {
                if (!selectedEntryId || !correctedClockIn || !correctedClockOut || !requestReason) {
                    setMessage({ type: 'error', text: '対象日・修正時刻・理由をすべて入力してください' })
                    setLoading(false)
                    return
                }

                // 選択した勤怠の日付を使って完全なDateTimeを生成
                const entry = timeEntries.find(e => e.id === selectedEntryId)
                if (!entry) {
                    setMessage({ type: 'error', text: '対象の勤怠を選択してください' })
                    setLoading(false)
                    return
                }
                const dateStr = new Date(entry.date).toISOString().split('T')[0]

                payload.timeEntryId = selectedEntryId
                payload.requestedClockIn = `${dateStr}T${correctedClockIn}:00`
                payload.requestedClockOut = `${dateStr}T${correctedClockOut}:00`
                payload.reason = requestReason
            }

            const response = await fetch('/api/kiosk/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || '申請に失敗しました')
            }

            setMessage({ type: 'success', text: '申請が送信されました。管理者の承認をお待ちください。' })

            // フォームリセット
            setLeaveDate('')
            setRequestReason('')
            setSelectedEntryId('')
            setCorrectedClockIn('')
            setCorrectedClockOut('')

            // 3秒後にリセット
            setTimeout(() => resetKiosk(), 4000)
        } catch (err) {
            setMessage({ type: 'error', text: err instanceof Error ? err.message : '申請に失敗しました' })
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
        setActiveTab('clock')
        setClockNote('')
        setRequestType('paid_leave')
        setLeaveDate('')
        setRequestReason('')
        setTimeEntries([])
        setSelectedEntryId('')
        setCorrectedClockIn('')
    }

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('ja-JP', {
            month: 'short', day: 'numeric', weekday: 'short',
        })
    }

    const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleTimeString('ja-JP', {
            hour: '2-digit', minute: '2-digit',
        })
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-800 flex flex-col items-center justify-center p-4">
            {/* 現在時刻 */}
            <div className="text-white text-center mb-6">
                <div className="text-4xl md:text-5xl font-bold mb-2">
                    {currentTime.split(' ').slice(-1)[0]}
                </div>
                <div className="text-lg md:text-xl text-primary-100">
                    {currentTime.split(' ').slice(0, -1).join(' ')}
                </div>
            </div>

            {/* メインカード */}
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden">
                {/* タブヘッダー（認証後のみ表示） */}
                {isAuthenticated && (
                    <div className="flex border-b border-slate-200">
                        <button
                            onClick={() => setActiveTab('clock')}
                            className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${activeTab === 'clock'
                                ? 'text-primary-700 border-b-2 border-primary-600 bg-primary-50'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                }`}
                        >
                            打刻
                        </button>
                        <button
                            onClick={() => setActiveTab('request')}
                            className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${activeTab === 'request'
                                ? 'text-primary-700 border-b-2 border-primary-600 bg-primary-50'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                }`}
                        >
                            有給申請・打刻修正
                        </button>
                    </div>
                )}

                <div className="p-6">
                    {/* メッセージ */}
                    {message && (
                        <div
                            className={`alert mb-6 ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}
                        >
                            {message.text}
                        </div>
                    )}

                    {!isAuthenticated ? (
                        // === 認証フォーム ===
                        <div>
                            <h1 className="text-2xl font-bold text-center text-slate-800 mb-6">
                                勤怠打刻・申請
                            </h1>
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
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleAuthenticate()
                                        }}
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
                        </div>
                    ) : activeTab === 'clock' ? (
                        // === 打刻タブ ===
                        <div className="space-y-6">
                            <div className="text-center">
                                <p className="text-lg text-slate-600">ようこそ</p>
                                <p className="text-2xl font-bold text-slate-800">{employeeName} さん</p>
                            </div>

                            <div className="px-4">
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    備考（現場名・出発地点など）※任意
                                </label>
                                <input
                                    type="text"
                                    value={clockNote}
                                    onChange={(e) => setClockNote(e.target.value)}
                                    className="input"
                                    placeholder="例: 〇〇作業所直行"
                                />
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
                    ) : activeTab === 'request' ? (
                        // === 有給申請・打刻修正タブ ===
                        <div className="space-y-5">
                            <div className="text-center mb-2">
                                <p className="text-sm text-slate-500">{employeeName} さん</p>
                            </div>

                            {/* 申請種別の切り替え */}
                            <div className="flex bg-slate-100 rounded-lg p-1">
                                <button
                                    type="button"
                                    onClick={() => setRequestType('paid_leave')}
                                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${requestType === 'paid_leave'
                                        ? 'bg-white text-primary-700 shadow-sm'
                                        : 'text-slate-600 hover:text-slate-800'
                                        }`}
                                >
                                    有給申請
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRequestType('work_time')}
                                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${requestType === 'work_time'
                                        ? 'bg-white text-primary-700 shadow-sm'
                                        : 'text-slate-600 hover:text-slate-800'
                                        }`}
                                >
                                    打刻修正
                                </button>
                            </div>

                            {requestType === 'paid_leave' ? (
                                // --- 有給申請フォーム ---
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            有給日 <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            value={leaveDate}
                                            onChange={(e) => setLeaveDate(e.target.value)}
                                            className="input"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            理由（任意）
                                        </label>
                                        <textarea
                                            value={requestReason}
                                            onChange={(e) => setRequestReason(e.target.value)}
                                            className="input min-h-[80px] resize-none"
                                            placeholder="例: 私用のため"
                                        />
                                    </div>
                                </div>
                            ) : (
                                // --- 打刻修正申請フォーム ---
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            修正対象の日付 <span className="text-red-500">*</span>
                                        </label>
                                        {entriesLoading ? (
                                            <div className="text-center py-3">
                                                <span className="text-sm text-slate-500">読み込み中...</span>
                                            </div>
                                        ) : timeEntries.length === 0 ? (
                                            <p className="text-sm text-slate-500 py-2">
                                                直近14日間の勤怠記録がありません
                                            </p>
                                        ) : (
                                            <select
                                                value={selectedEntryId}
                                                onChange={(e) => {
                                                    setSelectedEntryId(e.target.value)
                                                    const entry = timeEntries.find(en => en.id === e.target.value)
                                                    if (entry) {
                                                        setCorrectedClockIn(formatTime(entry.clockIn))
                                                        setCorrectedClockOut(entry.clockOut ? formatTime(entry.clockOut) : '')
                                                    }
                                                }}
                                                className="input"
                                            >
                                                <option value="">選択してください</option>
                                                {timeEntries.map((entry) => (
                                                    <option key={entry.id} value={entry.id}>
                                                        {formatDate(entry.date)} — {formatTime(entry.clockIn)}〜{entry.clockOut ? formatTime(entry.clockOut) : '未退勤'}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                                修正後の出勤 <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="time"
                                                value={correctedClockIn}
                                                onChange={(e) => setCorrectedClockIn(e.target.value)}
                                                className="input"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                                修正後の退勤 <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="time"
                                                value={correctedClockOut}
                                                onChange={(e) => setCorrectedClockOut(e.target.value)}
                                                className="input"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            修正理由 <span className="text-red-500">*</span>
                                        </label>
                                        <textarea
                                            value={requestReason}
                                            onChange={(e) => setRequestReason(e.target.value)}
                                            className="input min-h-[80px] resize-none"
                                            placeholder="例: 打刻忘れのため"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* 送信・キャンセルボタン */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={resetKiosk}
                                    className="btn btn-secondary flex-1"
                                >
                                    キャンセル
                                </button>
                                <button
                                    onClick={handleSubmitRequest}
                                    disabled={loading}
                                    className="btn btn-primary flex-1"
                                >
                                    {loading ? '送信中...' : '申請する'}
                                </button>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    )
}
