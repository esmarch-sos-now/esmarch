'use client'

import { MapPin, Navigation, Phone, Siren, type LucideIcon } from 'lucide-react'
import useInView from '@/hooks/useInView'
import { howItWorks } from '@/content/landing'
import { inter } from './inter'

const icons: Record<string, LucideIcon> = { sos: Siren, location: MapPin, call: Phone, navigate: Navigation }

// Toạ độ (khung 1440 đơn vị) của từng bước: x = tâm ngang, y = chấm tròn. Bước sau cao hơn bước trước như bậc thang.
const positions = [
  { x: 255, y: 510 },
  { x: 575, y: 440 },
  { x: 895, y: 370 },
  { x: 1215, y: 300 }
]

// Hướng dẫn sử dụng dạng timeline bậc thang trên nền xám nhạt: tiêu đề + mô tả phía trên chấm tròn, đường dọc nối xuống
// thanh vạch ngang, trên thanh là nút "Bước n" kèm biểu tượng tròn đen.
export default function HowItWorks({ id }: { id: string }) {
  const { label, title, steps } = howItWorks
  const [ref, inView] = useInView<HTMLOListElement>()
  return (
    <section id={id} className={`lp-how ${inter.className}`} aria-labelledby={`${id}-title`}>
      <div className="lp-how-stage">
        <span className="lp-how-pill">{label}</span>
        <h2 id={`${id}-title`} className="lp-how-title">{title}</h2>

        <span className="lp-how-track" aria-hidden="true" />
        <ol ref={ref} className={`lp-how-steps ${inView ? 'in-view' : ''}`}>
          {steps.map((step, index) => {
            const Icon = icons[step.icon]
            const { x, y } = positions[index]
            return (
              <li key={step.title} className="lp-how-step" style={{ '--i': index, '--x': x, '--y': y } as React.CSSProperties}>
                <div className="lp-how-text">
                  <h3 className="lp-how-step-title">{step.title}</h3>
                  <p className="lp-how-desc">{step.description}</p>
                </div>
                <span className="lp-how-dot" aria-hidden="true" />
                <span className="lp-how-line" aria-hidden="true" />
                <span className="lp-how-chip">
                  Bước {index + 1}
                  <span className="lp-how-icon" aria-hidden="true"><Icon /></span>
                </span>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
