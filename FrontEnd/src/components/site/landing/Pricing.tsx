'use client'

import type { CSSProperties } from 'react'
import { Check } from 'lucide-react'
import { Container, Pill, Section } from '@/components/site/primitives'
import useInView from '@/hooks/useInView'
import { pricing } from '@/content/landing'
import { cn } from '@/lib/utils'

type Plan = (typeof pricing)['plans'][number]

function PlanCard({ plan, includesLabel, index, inView }: { plan: Plan; includesLabel: string; index: number; inView: boolean }) {
  const corner = plan.id === 'free' ? 'left' : plan.id === 'ultra' ? 'right' : null
  return (
    <article
      aria-labelledby={`plan-${plan.id}`}
      style={{ '--delay': `${index * 120}ms` } as CSSProperties}
      className={cn(
        'relative text-ink transition-[opacity,translate] delay-(--delay) duration-600 ease-out motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none',
        inView ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0',
      )}
    >
      {/* Dải xanh "Đề xuất cho bạn" ló ra phía trên thẻ Pro */}
      {plan.ribbon && (
        <span className="absolute -top-4.5 right-1.25 left-1.25 z-0 h-16 rounded-t-[36px] bg-[#c3d9ef] pt-px text-center text-[11px] text-[#333] max-xs:rounded-t-[30px]">
          {plan.ribbon}
        </span>
      )}
      <div
        className={cn(
          'relative z-1 flex flex-col rounded-[36px] border-2 max-[799px]:min-h-0 max-xs:rounded-[30px]',
          plan.featured
            ? 'min-h-97.5 border-[#111] bg-white px-6 pt-5.5 pb-7.5 shadow-[0_0_70px_24px_rgba(241,187,46,.14)] max-xs:px-5 max-xs:pt-5 max-xs:pb-6.5'
            : 'min-h-90 border-[#6f6f6f] bg-[#c3d9ef] px-5.5 pt-17 pb-7.5 max-xs:px-5 max-xs:pt-15 max-xs:pb-6.5',
        )}
      >
        {/* Tên gói: Free/Ultra là nhãn vàng nhô ra ngoài góc thẻ, Pro nằm trong thẻ */}
        <h3
          id={`plan-${plan.id}`}
          className={cn(
            'font-display text-[26px] leading-none uppercase max-xs:text-2xl',
            corner && 'absolute -top-0.5 rounded-full border-2 border-[#111] bg-brand-yellow px-4 pt-1.5 pb-2',
            corner === 'left' && '-left-7 max-[799px]:-left-4 max-xs:-left-2',
            corner === 'right' && '-right-7 max-[799px]:-right-4 max-xs:-right-2',
          )}
        >
          {plan.name}
        </h3>
        <p className={cn('flex items-baseline gap-0.5', plan.featured ? 'my-5' : 'mb-7')}>
          <strong className="text-[clamp(22px,2vw,26px)] font-bold tracking-[-.01em]">{plan.price}</strong>
          <span className="text-sm">{plan.period}</span>
        </p>
        <p className="mb-3 text-sm">{includesLabel}</p>
        <ul className="grid gap-2.5 pl-2.5 max-xs:pl-1">
          {plan.features.map((feature: string) => (
            <li key={feature} className="flex items-start gap-2 text-sm leading-[1.4]">
              <Check aria-hidden="true" className="mt-0.5 size-3.75 flex-none stroke-[2.5] text-brand" />
              {feature}
            </li>
          ))}
        </ul>
      </div>
    </article>
  )
}

export default function Pricing({ id }: { id: string }) {
  const { label, includesLabel, plans } = pricing
  const [ref, inView] = useInView<HTMLDivElement>()
  return (
    <Section id={id} aria-labelledby={`${id}-title`}>
      <Container>
        <Pill><h2 id={`${id}-title`}>{label}</h2></Pill>
        <div
          ref={ref}
          className="mx-auto mt-14 grid max-w-240 grid-cols-[1fr_1.2fr_1fr] items-center gap-[clamp(16px,2vw,24px)] px-[clamp(0px,3vw,32px)] max-[799px]:mt-11 max-[799px]:max-w-95 max-[799px]:grid-cols-1 max-[799px]:gap-10 max-[799px]:px-4 max-xs:px-2"
        >
          {plans.map((plan, index) => <PlanCard key={plan.id} plan={plan} includesLabel={includesLabel} index={index} inView={inView} />)}
        </div>
      </Container>
    </Section>
  )
}
