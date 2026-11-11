'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { DAY_STORAGE_KEY, strokePractice } from '@/content/stroke-practice'
import {
  dateKey,
  parseDayLog,
  recentDays,
  streakEnding,
  type DayLog,
  type SavedDrill
} from './day-log'

function readLog() {
  try {
    const raw = localStorage.getItem(DAY_STORAGE_KEY)
    return parseDayLog(raw ? JSON.parse(raw) : null)
  } catch {
    return {}
  }
}

function knownMoves(ids: string[]) {
  const known = new Set(strokePractice.daily.moves.map((move) => move.id))
  return ids.filter((id) => known.has(id))
}

function signsOf(drill: SavedDrill) {
  const { signs } = strokePractice.daily
  return [signs.face[drill.face], signs.arms[drill.arms], signs.speech[drill.speech]].join(', ')
}

export default function DailyPractice({ drill }: { drill: SavedDrill | null }) {
  const { daily } = strokePractice
  const [log, setLog] = useState<DayLog>({})
  const [ready, setReady] = useState(false)
  const today = dateKey(new Date())
  const moves = knownMoves(log[today]?.moves ?? [])
  const drillKey = drill ? `${today}:${drill.face}:${drill.arms}:${drill.speech}` : ''
  const [savedDrillKey, setSavedDrillKey] = useState('')
  if (ready && drill && drillKey !== savedDrillKey) {
    setSavedDrillKey(drillKey)
    setLog((current) => {
      const entry = current[today]
      if (entry?.drill && entry.drill.face === drill.face && entry.drill.arms === drill.arms && entry.drill.speech === drill.speech) {
        return current
      }
      return { ...current, [today]: { moves: entry?.moves ?? [], drill } }
    })
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const loaded = readLog()
      const next: DayLog = {}
      for (const [key, entry] of Object.entries(loaded)) {
        const kept = knownMoves(entry.moves)
        if (kept.length === 0 && !entry.drill) continue
        next[key] = entry.drill ? { moves: kept, drill: entry.drill } : { moves: kept }
      }
      setLog(next)
      setReady(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!ready) return
    localStorage.setItem(DAY_STORAGE_KEY, JSON.stringify(log))
  }, [log, ready])

  const toggle = (id: string) => {
    setLog((current) => {
      const entry = current[today] ?? { moves: [] }
      const next = entry.moves.includes(id) ? entry.moves.filter((item) => item !== id) : [...entry.moves, id]
      if (next.length === 0 && !entry.drill) {
        const rest = { ...current }
        delete rest[today]
        return rest
      }
      return { ...current, [today]: { ...entry, moves: next } }
    })
  }

  const days = recentDays(new Date())
  const chain = streakEnding(log, new Date())
  const todayDrill = log[today]?.drill

  return (
    <section className="mt-10 rounded-2xl border border-line bg-paper p-4.5 sm:p-5" aria-labelledby="practice-daily">
      <h2 id="practice-daily" className="text-[clamp(22px,3vw,28px)] leading-tight font-extrabold text-ink">{daily.title}</h2>
      <p className="mt-2 text-base leading-[1.6] text-muted-foreground">{daily.intro}</p>
      <p className="mt-3.5 rounded-xl bg-[#fff8e8] px-3.5 py-3 text-sm leading-normal font-semibold text-[#6d4a00]">{daily.caution}</p>
      <p className="mt-4 text-sm font-bold text-ink">{daily.progress(moves.length, daily.moves.length)}</p>
      <ul className="mt-3 grid list-none gap-2.5 p-0">
        {daily.moves.map((move) => (
          <li key={move.id}>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line p-3.5 hover:border-brand">
              <input className="mt-0.5 size-4.5 accent-brand" type="checkbox" checked={moves.includes(move.id)} onChange={() => toggle(move.id)} />
              <span>
                <strong className="block text-[15px] leading-snug font-extrabold text-ink">{move.title}</strong>
                <span className="text-sm leading-normal text-muted-foreground">{move.text}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex items-end justify-between gap-3">
        <h3 className="text-base font-extrabold text-ink">{daily.week}</h3>
        <p className="text-sm font-extrabold text-brand">{daily.streak(chain)}</p>
      </div>
      <ol className="mt-4 flex list-none p-0">
        {days.map((day, index) => {
          const entry = log[day.key]
          const count = knownMoves(entry?.moves ?? []).length
          const done = Boolean(entry && (count > 0 || entry.drill))
          const next = days[index + 1]
          const nextEntry = next ? log[next.key] : undefined
          const nextDone = Boolean(nextEntry && (knownMoves(nextEntry.moves ?? []).length > 0 || nextEntry.drill))
          return (
            <li key={day.key} className="relative flex flex-1 flex-col items-center" aria-current={day.key === today ? 'date' : undefined} title={entry?.drill ? signsOf(entry.drill) : undefined}>
              {index < days.length - 1 ? (
                <span aria-hidden="true" className={cn('absolute top-4 left-1/2 h-0.5 w-full', done && nextDone ? 'bg-brand' : 'bg-line')} />
              ) : null}
              <span
                className={cn(
                  'relative z-1 size-8 rounded-full border-2 border-line bg-paper',
                  done && 'border-brand bg-brand',
                  day.key === today && 'ring-4 ring-brand-soft',
                  day.key === today && !done && 'border-brand',
                )}
              />
              <span className={cn('mt-2 text-[11px] leading-none font-bold', done || day.key === today ? 'text-ink' : 'text-muted-foreground')}>{day.label}</span>
              <span className="mt-1 text-[11px] leading-none font-bold text-muted-foreground">{day.number}</span>
            </li>
          )
        })}
      </ol>
      {todayDrill && (todayDrill.face === 'uneven' || todayDrill.arms === 'uneven') ? <p className="mt-3.5 rounded-xl bg-[#fff8e8] px-3.5 py-3 text-sm leading-normal font-semibold text-[#6d4a00]">{daily.attentionNote}</p> : null}
    </section>
  )
}
