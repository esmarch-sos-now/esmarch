import type { GestureVerdict, SpeechStep } from './score'

export type SavedDrill = {
  face: GestureVerdict
  arms: GestureVerdict
  speech: SpeechStep
}

export type DayEntry = {
  moves: string[]
  drill?: SavedDrill
}

export type DayLog = Record<string, DayEntry>

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

export function dateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function parseDayLog(value: unknown): DayLog {
  if (!value || typeof value !== 'object') return {}
  const log: DayLog = {}
  for (const [key, entry] of Object.entries(value)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !entry || typeof entry !== 'object') continue
    const raw = entry as { moves?: unknown; drill?: unknown }
    const moves = Array.isArray(raw.moves) ? raw.moves.filter((id): id is string => typeof id === 'string') : []
    const drill = isDrill(raw.drill) ? raw.drill : undefined
    if (moves.length === 0 && !drill) continue
    log[key] = drill ? { moves, drill } : { moves }
  }
  return log
}

function isDrill(value: unknown): value is SavedDrill {
  if (!value || typeof value !== 'object') return false
  const drill = value as SavedDrill
  return ['even', 'uneven', 'missing'].includes(drill.face)
    && ['even', 'uneven', 'missing'].includes(drill.arms)
    && ['heard', 'unclear', 'skipped'].includes(drill.speech)
}

export function drillSteps(drill: SavedDrill | undefined) {
  if (!drill) return 0
  return Number(drill.face === 'even') + Number(drill.arms === 'even') + Number(drill.speech === 'heard')
}

export function recentDays(today: Date, count = 7) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (count - 1 - index))
    return {
      key: dateKey(date),
      label: WEEKDAYS[date.getDay()],
      number: date.getDate()
    }
  })
}

export function streakEnding(log: DayLog, today: Date) {
  const cursor = new Date(today)
  if (!log[dateKey(cursor)]) cursor.setDate(cursor.getDate() - 1)
  let days = 0
  while (log[dateKey(cursor)]) {
    days += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return days
}

export function previousEntry(log: DayLog, todayKey: string) {
  return Object.keys(log)
    .filter((key) => key < todayKey)
    .sort()
    .at(-1)
}
