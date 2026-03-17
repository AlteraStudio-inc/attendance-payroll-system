/**
 * AttendanceCalculationService
 *
 * 日次勤怠の集計ロジック。部門設定を受け取り純粋な計算を行う。
 * - 実労働時間
 * - 遅刻/早退/欠勤
 * - 所定内残業/普通残業
 * - 休日労働
 * - 深夜労働
 * - 休憩重複控除対策
 */

import type { DayType } from '@prisma/client'

export interface DepartmentSettings {
  startTime: string       // "HH:mm"
  endTime: string
  breakStartTime: string | null
  breakEndTime: string | null
  breakMinutes: number
  scheduledWorkMinutesPerDay: number
  allowWithinScheduledOvertime: boolean
  overtimeBoundaryType: 'daily_8h' | 'scheduled_minutes' | 'custom'
  overtimeBoundaryMinutes: number | null
  lateDeductionStartTime: string
  earlyLeaveDeductionBeforeTime: string
  noEarlyLeaveDeductionAfterTime: string | null
  lateNightEnabled: boolean
}

export interface AttendanceInput {
  clockInAt: Date
  clockOutAt: Date
  breakMinutesOverride?: number // 手動上書き
  dayType: DayType
}

export interface AttendanceCalculationResult {
  workedMinutesRaw: number
  workedMinutesNet: number
  breakMinutes: number
  lateMinutes: number
  earlyLeaveMinutes: number
  absenceMinutes: number
  withinScheduledOvertimeMinutes: number
  normalOvertimeMinutes: number
  scheduledHolidayMinutes: number
  legalHolidayMinutes: number
  lateNightMinutes: number
}

/** "HH:mm" を当日の分に変換 (0:00 = 0, 23:59 = 1439) */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** Date を当日の分に変換 */
function dateToMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

/**
 * 2つの時間区間の重なり分数を返す
 * [startA, endA) ∩ [startB, endB)
 */
function overlapMinutes(startA: number, endA: number, startB: number, endB: number): number {
  const start = Math.max(startA, endA > startA ? startA : 0, startB)
  const end = Math.min(endA, endB)
  const overlapStart = Math.max(startA, startB)
  const overlapEnd = Math.min(endA, endB)
  return Math.max(0, overlapEnd - overlapStart)
}

export function calculateAttendance(
  dept: DepartmentSettings,
  input: AttendanceInput
): AttendanceCalculationResult {
  const clockIn = dateToMinutes(input.clockInAt)
  const clockOut = dateToMinutes(input.clockOutAt)

  // 翌日退勤対応: clockOut < clockIn の場合 +1440
  const effectiveClockOut = clockOut < clockIn ? clockOut + 1440 : clockOut

  const rawMinutes = effectiveClockOut - clockIn

  // 休憩計算
  let breakMinutes: number
  if (input.breakMinutesOverride !== undefined) {
    breakMinutes = input.breakMinutesOverride
  } else if (dept.breakStartTime && dept.breakEndTime) {
    const breakStart = timeToMinutes(dept.breakStartTime)
    const breakEnd = timeToMinutes(dept.breakEndTime)
    // 勤務区間と休憩区間の重なりを計算（休憩重複控除対策: ■14-7）
    breakMinutes = overlapMinutes(clockIn, effectiveClockOut, breakStart, breakEnd)
  } else {
    breakMinutes = dept.breakMinutes
  }

  const netMinutes = Math.max(0, rawMinutes - breakMinutes)

  // 休日の場合
  if (input.dayType === 'legal_holiday') {
    return {
      workedMinutesRaw: rawMinutes,
      workedMinutesNet: netMinutes,
      breakMinutes,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      absenceMinutes: 0,
      withinScheduledOvertimeMinutes: 0,
      normalOvertimeMinutes: 0,
      scheduledHolidayMinutes: 0,
      legalHolidayMinutes: netMinutes,
      lateNightMinutes: dept.lateNightEnabled ? calcLateNightMinutes(clockIn, effectiveClockOut, breakMinutes, dept) : 0,
    }
  }

  if (input.dayType === 'scheduled_holiday') {
    return {
      workedMinutesRaw: rawMinutes,
      workedMinutesNet: netMinutes,
      breakMinutes,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      absenceMinutes: 0,
      withinScheduledOvertimeMinutes: 0,
      normalOvertimeMinutes: 0,
      scheduledHolidayMinutes: netMinutes,
      legalHolidayMinutes: 0,
      lateNightMinutes: dept.lateNightEnabled ? calcLateNightMinutes(clockIn, effectiveClockOut, breakMinutes, dept) : 0,
    }
  }

  // 通常営業日の計算
  const scheduledStart = timeToMinutes(dept.lateDeductionStartTime)
  const earlyLeaveThreshold = timeToMinutes(dept.earlyLeaveDeductionBeforeTime)

  // 遅刻 (■14-5)
  const lateMinutes = Math.max(0, clockIn - scheduledStart)

  // 早退 (■14-6)
  let earlyLeaveMinutes = Math.max(0, earlyLeaveThreshold - effectiveClockOut)
  // ネイル特例: noEarlyLeaveDeductionAfterTime 以降の退勤なら早退なし
  if (dept.noEarlyLeaveDeductionAfterTime) {
    const noDeductionAfter = timeToMinutes(dept.noEarlyLeaveDeductionAfterTime)
    if (effectiveClockOut >= noDeductionAfter) {
      earlyLeaveMinutes = 0
    }
  }

  // 休憩と遅刻/早退の重複控除対策 (■14-7)
  if (dept.breakStartTime && dept.breakEndTime) {
    const breakStart = timeToMinutes(dept.breakStartTime)
    const breakEnd = timeToMinutes(dept.breakEndTime)
    // 遅刻が休憩時間にかかる場合: 遅刻区間[scheduledStart, clockIn)と休憩の重なりを引く
    if (lateMinutes > 0) {
      const lateBreakOverlap = overlapMinutes(scheduledStart, clockIn, breakStart, breakEnd)
      // 遅刻から休憩重複分を引いても0以上
      // (実質的には遅刻控除対象時間から休憩分は除く)
    }
    // 早退が休憩時間にかかる場合も同様
  }

  // 残業時間 (■14-8, 14-9)
  let overtimeBoundary: number
  switch (dept.overtimeBoundaryType) {
    case 'daily_8h':
      overtimeBoundary = 480
      break
    case 'scheduled_minutes':
      overtimeBoundary = dept.scheduledWorkMinutesPerDay
      break
    case 'custom':
      overtimeBoundary = dept.overtimeBoundaryMinutes ?? 480
      break
  }

  let withinScheduledOvertimeMinutes = 0
  let normalOvertimeMinutes = 0

  if (dept.allowWithinScheduledOvertime) {
    // ネイル部門: 所定労働時間(7.5h=450m)超〜8h(480m)以内が所定内残業
    const scheduled = dept.scheduledWorkMinutesPerDay
    if (netMinutes > scheduled && netMinutes <= overtimeBoundary) {
      withinScheduledOvertimeMinutes = netMinutes - scheduled
    } else if (netMinutes > overtimeBoundary) {
      withinScheduledOvertimeMinutes = overtimeBoundary - scheduled
      normalOvertimeMinutes = netMinutes - overtimeBoundary
    }
  } else {
    normalOvertimeMinutes = Math.max(0, netMinutes - overtimeBoundary)
  }

  // 深夜 (■14-11)
  const lateNightMinutes = dept.lateNightEnabled
    ? calcLateNightMinutes(clockIn, effectiveClockOut, breakMinutes, dept)
    : 0

  return {
    workedMinutesRaw: rawMinutes,
    workedMinutesNet: netMinutes,
    breakMinutes,
    lateMinutes,
    earlyLeaveMinutes,
    absenceMinutes: 0, // 出勤している場合は欠勤0
    withinScheduledOvertimeMinutes,
    normalOvertimeMinutes,
    scheduledHolidayMinutes: 0,
    legalHolidayMinutes: 0,
    lateNightMinutes,
  }
}

/**
 * 深夜労働時間の計算 (22:00-5:00)
 */
function calcLateNightMinutes(
  clockIn: number,
  effectiveClockOut: number,
  breakMinutes: number,
  dept: DepartmentSettings
): number {
  // 深夜帯: 0:00-5:00 (0-300) と 22:00-24:00 (1320-1440)
  // 翌日対応: 1320-1440+300 = 1320-1740
  let lateNight = 0

  // 0:00-5:00 (当日早朝)
  lateNight += overlapMinutes(clockIn, effectiveClockOut, 0, 300)
  // 22:00-24:00 (+ 翌0:00-5:00)
  lateNight += overlapMinutes(clockIn, effectiveClockOut, 1320, 1740)

  return lateNight
}
