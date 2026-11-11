'use client'

import { BookX, CircleHelp, PhoneOff, Timer, type LucideIcon } from 'lucide-react'
import useInView from '@/hooks/useInView'
import { problem } from '@/content/landing'
import { inter } from './inter'

const icons: Record<string, LucideIcon> = { help: CircleHelp, timer: Timer, phone: PhoneOff, book: BookX }

// Phần "Vấn đề" theo mẫu thiết kế (khung 1440x810): nhãn, tiêu đề một dòng, 4 thẻ, các thanh cam trang trí ở góc.
export default function Problem({ id }: { id: string }) {
  const { label, title, items } = problem
  const [ref, inView] = useInView<HTMLUListElement>()
  return (
    <section id={id} className={`lp-problem ${inter.className}`} aria-labelledby={`${id}-title`}>
      <div className="lp-problem-stage">
        <span className="lp-bar lp-bar-tr-1" aria-hidden="true" />
        <span className="lp-bar lp-bar-tr-2" aria-hidden="true" />
        <span className="lp-bar lp-bar-bl-1" aria-hidden="true" />
        <span className="lp-bar lp-bar-bl-2" aria-hidden="true" />

        <span className="lp-problem-pill">{label}</span>
        <h2 id={`${id}-title`} className="lp-problem-title">{title.join(' ')}</h2>

        <ul ref={ref} className={`lp-problem-grid ${inView ? 'in-view' : ''}`}>
          {items.map((item, index) => {
            const Icon = icons[item.icon]
            return (
              <li key={item.title} className="lp-problem-card" style={{ '--i': index } as React.CSSProperties}>
                <span className="lp-problem-icon"><Icon aria-hidden="true" /></span>
                <span className="lp-problem-num" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <div className="lp-problem-body">
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
