'use client'

import Link from 'next/link'
import { Check } from 'lucide-react'
import useInView from '@/hooks/useInView'
import { pricing } from '@/content/landing'
import { inter } from './inter'

type Plan = (typeof pricing)['plans'][number]

function PlanCard({ plan, index }: { plan: Plan; index: number }) {
  return (
    <article className={`lp-plan ${plan.featured ? 'lp-plan-featured' : ''}`} style={{ '--i': index } as React.CSSProperties} aria-labelledby={`plan-${plan.id}`}>
      <div className="lp-plan-head">
        <div className="lp-plan-label">
          <h3 id={`plan-${plan.id}`} className="lp-plan-name">Gói {plan.name}</h3>
          {plan.ribbon && <span className="lp-plan-ribbon">{plan.ribbon}</span>}
        </div>
        <p className="lp-plan-price">{plan.price}<span>{plan.period}</span></p>
      </div>
      <div className="lp-plan-body">
        <ul className="lp-plan-features">
          {plan.features.map((feature: string) => (
            <li key={feature}><span className="lp-plan-check"><Check aria-hidden="true" /></span><span>{feature}</span></li>
          ))}
        </ul>
        <Link className="lp-plan-cta" href="/dang-ky">{pricing.cta}</Link>
      </div>
    </article>
  )
}

// Bảng giá kiểu liquid glass trên nền trắng: nhãn nhỏ "Bảng giá" rồi 3 thẻ kính sáng.
export default function Pricing({ id }: { id: string }) {
  const { title, plans } = pricing
  const [ref, inView] = useInView<HTMLDivElement>()
  return (
    <section id={id} className={`lp-price ${inter.className}`} aria-labelledby={`${id}-title`}>
      <div className="lp-price-stage">
        <h2 id={`${id}-title`} className="lp-price-title">{title}</h2>
        <div ref={ref} className={`lp-plans ${inView ? 'in-view' : ''}`}>
          {plans.map((plan, index) => <PlanCard key={plan.id} plan={plan} index={index} />)}
        </div>
      </div>
    </section>
  )
}
