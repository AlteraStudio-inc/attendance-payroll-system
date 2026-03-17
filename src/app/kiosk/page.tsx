'use client'

import { useState, useEffect } from 'react'

type Tab = 'clock' | 'request'
type RequestType = 'paid_leave' | 'work_time'

interface TimeEntry {
    id: string
    date: string
    clockIn: string | null
    clockOut: string | null
}

export default function KioskPage() {
    const [employeeCode, setEmployeeCode] = useState('')
    const [pin, setPin] = useState('')
    const [currentTime, setCurrentTime] = useState(new Date())
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [loading, setLoading] = useState(false)
    const [employeeName, setEmployeeName] = useState('')
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [clockStatus, setClockStatus] = useState<'not_clocked_in' | 'clocked_in' | 'clocked_out'>('not_clocked_in')
    const [activeTab, setActiveTab] = useState<Tab>('clock')
    const [clockNote, setClockNote] = useState('')

    // 申請用
    const [requestType, setRequestType] = useState<RequestType>('paid_leave')
    const [leaveDate, setLeaveDate] = useState('')
    const [requestReason, setRequestReason] = useState('')
    const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
    const [selectedEntryId, setSelectedEntryId] = useState('')
    const [correctedClockIn, setCorrectedClockIn] = useState('')
    const [correctedClockOut, setCorrectedClockOut] = useState('')
    const [entriesLoading, setEntriesLoading] = useState(false)

    // 現在時刻
    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(interval)
    }, [])

    // メッセージ自動消去
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(null), 5000)
            return () => clearTimeout(timer)
        }
    }, [message])

    // 認証
    const handleAuthenticate = async () => {
        if (!employeeCode || !pin) {
            setMessage({ type: 'error', text: '従業員コードとPINを入力してください' })
            return
        }
        setLoading(true)
        setMessage(null)
        try {
            const res = await fetch('/api/kiosk/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ employeeCode, pin }),
            })
            const data = await res.json()
            if (!res.ok || !data.success) throw new Error(data.error || '認証に失敗しました')

            setEmployeeName(data.data?.name || data.name)
            setClockStatus(data.data?.status || (data.hasClockedIn ? 'clocked_in' : 'not_clocked_in'))
            setIsAuthenticated(true)
        } catch (err) {
            setMessage({ type: 'error', text: err instanceof Error ? err.message : '認証に失敗しました' })
        } finally {
            setLoading(false)
        }
    }

    // 出勤
    const handleClockIn = async () => {
        setLoading(true)
        setMessage(null)
        try {
            const res = await fetch('/api/kiosk/clock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ employeeCode, pin, type: 'clock_in', note: clockNote || undefined }),
            })
            const data = await res.json()
            if (!res.ok || !data.success) throw new Error(data.error || '出勤打刻に失敗しました')

            const timeStr = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
            setMessage({ type: 'success', text: `出勤しました (${timeStr})` })
            setClockStatus('clocked_in')
            setTimeout(() => resetKiosk(), 3000)
        } catch (err) {
            setMessage({ type: 'error', text: err instanceof Error ? err.message : '出勤打刻に失敗しました' })
        } finally {
            setLoading(false)
        }
    }

    // 退勤
    const handleClockOut = async () => {
        setLoading(true)
        setMessage(null)
        try {
            const res = await fetch('/api/kiosk/clock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ employeeCode, pin, type: 'clock_out', note: clockNote || undefined }),
            })
            const data = await res.json()
            if (!res.ok || !data.success) throw new Error(data.error || '退勤打刻に失敗しました')

            const timeStr = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
            setMessage({ type: 'success', text: `退勤しました (${timeStr})` })
            setClockStatus('clocked_out')
            setTimeout(() => resetKiosk(), 3000)
        } catch (err) {
            setMessage({ type: 'error', text: err instanceof Error ? err.message : '退勤打刻に失敗しました' })
        } finally {
            setLoading(false)
        }
    }

    // 勤怠一覧取得
    const fetchTimeEntries = async () => {
        setEntriesLoading(true)
        try {
            const res = await fetch(`/api/kiosk/request?employeeCode=${employeeCode}`)
            const data = await res.json()
            if (res.ok && data.success) {
                setTimeEntries(data.data?.entries || data.entries || [])
            }
        } catch {
            // ignore
        } finally {
            setEntriesLoading(false)
        }
    }

    useEffect(() => {
        if (activeTab === 'request' && isAuthenticated && requestType === 'work_time') {
            fetchTimeEntries()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, requestType, isAuthenticated])

    // 申請送信
    const handleSubmitRequest = async () => {
        setLoading(true)
        setMessage(null)
        try {
            const payload: Record<string, unknown> = { employeeCode, pin, type: requestType }

            if (requestType === 'paid_leave') {
                if (!leaveDate) {
                    setMessage({ type: 'error', text: '有給日を選択してください' })
                    setLoading(false)
                    return
                }
                payload.leaveDate = leaveDate
                if (requestReason) payload.reason = requestReason
            } else {
                if (!selectedEntryId || !correctedClockIn || !correctedClockOut || !requestReason) {
                    setMessage({ type: 'error', text: '対象日・修正時刻・理由をすべて入力してください' })
                    setLoading(false)
                    return
                }
                const entry = timeEntries.find((e) => e.id === selectedEntryId)
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

            const res = await fetch('/api/kiosk/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const data = await res.json()
            if (!res.ok || !data.success) throw new Error(data.error || '申請に失敗しました')

            setMessage({ type: 'success', text: '申請が送信されました。管理者の承認をお待ちください。' })
            setLeaveDate('')
            setRequestReason('')
            setSelectedEntryId('')
            setCorrectedClockIn('')
            setCorrectedClockOut('')
            setTimeout(() => resetKiosk(), 4000)
        } catch (err) {
            setMessage({ type: 'error', text: err instanceof Error ? err.message : '申請に失敗しました' })
        } finally {
            setLoading(false)
        }
    }

    const resetKiosk = () => {
        setEmployeeCode('')
        setPin('')
        setEmployeeName('')
        setIsAuthenticated(false)
        setClockStatus('not_clocked_in')
        setMessage(null)
        setActiveTab('clock')
        setClockNote('')
        setRequestType('paid_leave')
        setLeaveDate('')
        setRequestReason('')
        setTimeEntries([])
        setSelectedEntryId('')
        setCorrectedClockIn('')
        setCorrectedClockOut('')
    }

    const formatDate = (dateStr: string) =>
        new Date(dateStr).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' })

    const formatTime = (dateStr: string) =>
        new Date(dateStr).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex flex-col items-center justify-center p-4">
            {/* 現在時刻 */}
            <div className="text-white text-center mb-6">
                <div className="text-5xl md:text-6xl font-bold mb-1 tabular-nums">
                    {currentTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
                <div className="text-blue-200 text-base md:text-lg">
                    {currentTime.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
                </div>
            </div>

            {/* メインカード */}
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
                {/* 認証後タブ */}
                {isAuthenticated && (
                    <div className="flex border-b border-slate-200">
                        <button
                            onClick={() => setActiveTab('clock')}
                            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                                activeTab === 'clock'
                                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                                    : 'text-slate-500 hover:bg-slate-50'
                            }`}
                        >
                            打刻
                        </button>
                        <button
                            onClick={() => setActiveTab('request')}
                            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                                activeTab === 'request'
                                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                                    : 'text-slate-500 hover:bg-slate-50'
                            }`}
                        >
                            有給・修正申請
                        </button>
                    </div>
                )}

                <div className="p-6">
                    {message && (
                        <div className={`rounded-xl px-4 py-3 text-sm font-medium mb-5 ${
                            message.type === 'success'
                                ? 'bg-green-100 text-green-800 border border-green-200'
                                : 'bg-red-100 text-red-800 border border-red-200'
                        }`}>
                            {message.text}
                        </div>
                    )}

                    {!isAuthenticated ? (
                        // 認証フォーム
                        <div>
                            <h1 className="text-2xl font-bold text-center text-slate-800 mb-6">勤怠打刻・申請</h1>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">従業員コード</label>
                                    <input
                                        type="text"
                                        value={employeeCode}
                                        onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())}
                                        className="w-full px-4 py-3 border border-slate-300 rounded-xl text-center text-xl font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="EMP001"
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">PIN</label>
                                    <input
                                        type="password"
                                        value={pin}
                                        onChange={(e) => setPin(e.target.value)}
                                        className="w-full px-4 py-3 border border-slate-300 rounded-xl text-center text-xl tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="●●●●"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        maxLength={6}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleAuthenticate() }}
                                    />
                                </div>
                                <button
                                    onClick={handleAuthenticate}
                                    disabled={loading}
                                    className="w-full py-4 bg-blue-600 text-white text-lg font-bold rounded-xl hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 shadow-md"
                                >
                                    {loading ? '確認中...' : '確認'}
                                </button>
                            </div>
                        </div>
                    ) : activeTab === 'clock' ? (
                        // 打刻タブ
                        <div className="space-y-6">
                            <div className="text-center">
                                <p className="text-slate-500">ようこそ</p>
                                <p className="text-3xl font-bold text-slate-800">{employeeName} さん</p>
                            </div>

                            <div>
                                <input
                                    type="text"
                                    value={clockNote}
                                    onChange={(e) => setClockNote(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="備考（現場名など）※任意"
                                />
                            </div>

                            <div className="flex justify-center">
                                {clockStatus === 'not_clocked_in' && (
                                    <button
                                        onClick={handleClockIn}
                                        disabled={loading}
                                        className="w-48 h-48 rounded-full bg-blue-600 text-white text-3xl font-bold shadow-xl hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
                                    >
                                        {loading ? '処理中...' : '出勤'}
                                    </button>
                                )}
                                {clockStatus === 'clocked_in' && (
                                    <button
                                        onClick={handleClockOut}
                                        disabled={loading}
                                        className="w-48 h-48 rounded-full bg-red-500 text-white text-3xl font-bold shadow-xl hover:bg-red-600 active:scale-95 transition-all disabled:opacity-50"
                                    >
                                        {loading ? '処理中...' : '退勤'}
                                    </button>
                                )}
                                {clockStatus === 'clocked_out' && (
                                    <div className="text-center py-8">
                                        <div className="text-green-600 text-2xl font-bold">✓ 退勤済み</div>
                                        <p className="text-slate-500 mt-2 text-sm">本日の勤務は終了しました</p>
                                    </div>
                                )}
                            </div>

                            <button onClick={resetKiosk} className="w-full py-3 border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors">
                                キャンセル
                            </button>
                        </div>
                    ) : (
                        // 申請タブ
                        <div className="space-y-5">
                            <div className="text-center text-sm text-slate-500">{employeeName} さん</div>

                            <div className="flex bg-slate-100 rounded-xl p-1">
                                <button
                                    onClick={() => setRequestType('paid_leave')}
                                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                                        requestType === 'paid_leave' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'
                                    }`}
                                >
                                    有給申請
                                </button>
                                <button
                                    onClick={() => setRequestType('work_time')}
                                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                                        requestType === 'work_time' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'
                                    }`}
                                >
                                    打刻修正
                                </button>
                            </div>

                            {requestType === 'paid_leave' ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">有給日 <span className="text-red-500">*</span></label>
                                        <input
                                            type="date"
                                            value={leaveDate}
                                            onChange={(e) => setLeaveDate(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">理由（任意）</label>
                                        <textarea
                                            value={requestReason}
                                            onChange={(e) => setRequestReason(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] resize-none text-sm"
                                            placeholder="例: 私用のため"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">修正対象日 <span className="text-red-500">*</span></label>
                                        {entriesLoading ? (
                                            <p className="text-sm text-slate-500 py-2">読み込み中...</p>
                                        ) : timeEntries.length === 0 ? (
                                            <p className="text-sm text-slate-500 py-2">直近の勤怠記録がありません</p>
                                        ) : (
                                            <select
                                                value={selectedEntryId}
                                                onChange={(e) => {
                                                    setSelectedEntryId(e.target.value)
                                                    const entry = timeEntries.find((en) => en.id === e.target.value)
                                                    if (entry) {
                                                        setCorrectedClockIn(entry.clockIn ? formatTime(entry.clockIn) : '')
                                                        setCorrectedClockOut(entry.clockOut ? formatTime(entry.clockOut) : '')
                                                    }
                                                }}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                                            >
                                                <option value="">選択してください</option>
                                                {timeEntries.map((entry) => (
                                                    <option key={entry.id} value={entry.id}>
                                                        {formatDate(entry.date)} — {entry.clockIn ? formatTime(entry.clockIn) : '--:--'}〜{entry.clockOut ? formatTime(entry.clockOut) : '未退勤'}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">修正後の出勤 <span className="text-red-500">*</span></label>
                                            <input type="time" value={correctedClockIn} onChange={(e) => setCorrectedClockIn(e.target.value)}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">修正後の退勤 <span className="text-red-500">*</span></label>
                                            <input type="time" value={correctedClockOut} onChange={(e) => setCorrectedClockOut(e.target.value)}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">修正理由 <span className="text-red-500">*</span></label>
                                        <textarea
                                            value={requestReason}
                                            onChange={(e) => setRequestReason(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] resize-none text-sm"
                                            placeholder="例: 打刻忘れのため"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3 pt-1">
                                <button onClick={resetKiosk} className="flex-1 py-3 border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors text-sm font-medium">
                                    キャンセル
                                </button>
                                <button
                                    onClick={handleSubmitRequest}
                                    disabled={loading}
                                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
                                >
                                    {loading ? '送信中...' : '申請する'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
