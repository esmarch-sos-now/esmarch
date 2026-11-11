'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Phone } from 'lucide-react'
import Navbar from '@/components/site/landing/Navbar'
import { appNav } from '@/content/app'
import { HABIT_STORAGE_KEY, QUIZ_STORAGE_KEY, strokePractice } from '@/content/stroke-practice'
import CameraDrill from './camera-drill'

type QuizSave = { score: number; total: number }

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export default function PracticeScreen() {
  const { prevention, fast, quiz } = strokePractice
  const [checked, setChecked] = useState<string[]>([])
  const [habitsReady, setHabitsReady] = useState(false)
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)
  const [previous, setPrevious] = useState<QuizSave | null>(null)

  useEffect(() => {
    // localStorage chỉ có sau khi mount. Đọc ở callback để không lệch HTML server và không setState đồng bộ trong effect.
    const timer = window.setTimeout(() => {
      const stored = readJson<unknown>(HABIT_STORAGE_KEY)
      if (Array.isArray(stored)) {
        const ids = new Set(prevention.habits.map((habit) => habit.id))
        setChecked(stored.filter((id): id is string => typeof id === 'string' && ids.has(id)))
      }
      const savedQuiz = readJson<QuizSave>(QUIZ_STORAGE_KEY)
      if (savedQuiz && Number.isInteger(savedQuiz.score) && Number.isInteger(savedQuiz.total)) setPrevious(savedQuiz)
      setHabitsReady(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [prevention.habits])

  useEffect(() => {
    if (!habitsReady) return
    localStorage.setItem(HABIT_STORAGE_KEY, JSON.stringify(checked))
  }, [checked, habitsReady])

  const toggle = (id: string) => {
    setChecked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  const question = quiz.questions[index]
  const choose = (option: number) => {
    if (selected !== null) return
    setSelected(option)
    if (option === question.answer) setScore((current) => current + 1)
  }

  const next = () => {
    if (selected === null) return
    if (index === quiz.questions.length - 1) {
      const total = quiz.questions.length
      const finalScore = score
      setDone(true)
      const saved = { score: finalScore, total }
      setPrevious(saved)
      localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(saved))
      return
    }
    setIndex((current) => current + 1)
    setSelected(null)
  }

  const retry = () => {
    setIndex(0)
    setSelected(null)
    setScore(0)
    setDone(false)
  }

  return (
    <div className="page">
      <Navbar appLinks={appNav} />
      <main className="practice">
        <h1 className="practice-title">{strokePractice.title}</h1>
        <p className="practice-lede">{strokePractice.lede}</p>

        <section className="practice-section" aria-labelledby="practice-prevention">
          <p className="practice-kicker">{prevention.label}</p>
          <h2 id="practice-prevention">{prevention.title}</h2>
          <p className="practice-copy">{prevention.intro}</p>
          <ul className="practice-risks">
            {prevention.risks.map((risk) => (
              <li key={risk.title}>
                <h3>{risk.title}</h3>
                <p>{risk.text}</p>
              </li>
            ))}
          </ul>
          <p className="practice-progress">{prevention.progress(checked.length, prevention.habits.length)}</p>
          <ul className="practice-habits">
            {prevention.habits.map((habit) => (
              <li key={habit.id}>
                <label>
                  <input type="checkbox" checked={checked.includes(habit.id)} onChange={() => toggle(habit.id)} />
                  <span>{habit.label}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>

        <section className="practice-section" aria-labelledby="practice-fast">
          <p className="practice-kicker">{fast.label}</p>
          <h2 id="practice-fast">{fast.title}</h2>
          <p className="practice-copy">{fast.intro}</p>
          <ol className="practice-fast">
            {fast.steps.map((step) => (
              <li key={step.letter}>
                <strong aria-hidden="true">{step.letter}</strong>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="practice-avoid">{fast.avoid}</p>
          <div className="practice-actions">
            <Link className="button button-primary" href="/app/sos">{fast.sos}</Link>
            <a className="button button-outline" href="tel:115"><Phone aria-hidden="true" /> {fast.call}</a>
          </div>
        </section>

        <CameraDrill />

        <section className="practice-section" aria-labelledby="practice-quiz">
          <p className="practice-kicker">{quiz.label}</p>
          <h2 id="practice-quiz">{quiz.title}</h2>
          <p className="practice-copy">{quiz.intro}</p>
          {previous && !done ? <p className="practice-previous">{quiz.previous(previous.score, previous.total)}</p> : null}
          {done ? (
            <div className="practice-result">
              <p className="practice-kicker">{quiz.resultLabel}</p>
              <p className="practice-score">{quiz.result(score, quiz.questions.length)}</p>
              <p className="practice-copy">{score === quiz.questions.length ? quiz.good : quiz.review}</p>
              <div className="practice-actions">
                <button type="button" className="button button-outline" onClick={retry}>{quiz.retry}</button>
                <a className="button button-primary" href="tel:115"><Phone aria-hidden="true" /> {fast.call}</a>
              </div>
            </div>
          ) : (
            <>
              <div className="practice-quiz-meta">
                <span>{quiz.progress(index + 1, quiz.questions.length)}</span>
                <span>{Math.round((index / quiz.questions.length) * 100)}%</span>
              </div>
              <h3 className="practice-question">{question.question}</h3>
              <ul className="practice-options">
                {question.options.map((option, optionIndex) => {
                  const revealed = selected !== null
                  const className = !revealed
                    ? ''
                    : optionIndex === question.answer
                      ? 'is-correct'
                      : optionIndex === selected
                        ? 'is-wrong'
                        : 'is-muted'
                  return (
                    <li key={option}>
                      <button type="button" className={className} disabled={revealed} onClick={() => choose(optionIndex)}>
                        <b>{String.fromCharCode(65 + optionIndex)}</b>
                        <span>{option}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              <div className="practice-actions">
                <button type="button" className="button button-primary" disabled={selected === null} onClick={next}>
                  {index === quiz.questions.length - 1 ? quiz.finish : quiz.next}
                </button>
              </div>
            </>
          )}
        </section>

        <p className="app-emergency">Trong nguy hiểm tính mạng, hãy gọi ngay <a href="tel:115">115</a>.</p>
      </main>
    </div>
  )
}
