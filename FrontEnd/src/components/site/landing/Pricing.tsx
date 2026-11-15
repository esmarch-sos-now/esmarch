'use client'

import type { CSSProperties } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { FramePill } from '@/components/site/primitives'
import useInView from '@/hooks/useInView'
import { pricing } from '@/content/landing'
import { cn } from '@/lib/utils'
import { inter } from './inter'

type Plan = (typeof pricing)['plans'][number]

// Thẻ kính tối: xám trong mờ, viền mảnh, sáng ở mép trên, bóng mềm. Mỗi thẻ: tên gói + giá lớn, đường kẻ ngang,
// danh sách có dấu tích, nút ở đáy; gói nổi bật có nút đen.
function PlanCard({ plan, index, inView }: { plan: Plan; index: number; inView: boolean }) {
  return (
    <article
      aria-labelledby={`plan-${plan.id}`}
      style={{ '--i': index } as CSSProperties}
      className={cn(
        'flex flex-col overflow-hidden rounded-[calc(32*var(--u))] border border-white/10 bg-[linear-gradient(160deg,#2a2a2a_0%,#1e1e1e_55%,#191919_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,.12),0_calc(24*var(--u))_calc(60*var(--u))_rgba(0,0,0,.45)] backdrop-blur-[26px] backdrop-saturate-160 max-lp:rounded-3xl',
        // Các thẻ hiện lần lượt khi cuộn tới
        'transition-[opacity,transform] duration-600 ease-in-out delay-[calc(var(--i)*120ms)] motion-reduce:transition-none',
        inView ? 'transform-none opacity-100' : 'transform-[translateY(calc(30*var(--u)))] opacity-0 max-lp:motion-safe:transform-[translateY(24px)] motion-reduce:transform-none motion-reduce:opacity-100',
      )}
    >
      <div className="border-b border-white/10 px-[calc(42*var(--u))] pt-[calc(42*var(--u))] pb-[calc(52*var(--u))] max-lp:px-5.5 max-lp:pt-6.5 max-lp:pb-7.5">
        <div className="flex min-h-[calc(30*var(--u))] items-start justify-between gap-[calc(10*var(--u))] max-lp:min-h-7">
          <h3 id={`plan-${plan.id}`} className="text-[calc(19*var(--u))] leading-[1.25] font-normal text-balance text-white/75 max-lp:text-base">Gói {plan.name}</h3>
          {plan.ribbon && (
            <span className="inline-flex h-[calc(28*var(--u))] shrink-0 items-center rounded-full border border-[rgba(224,68,44,.4)] bg-[rgba(224,68,44,.08)] px-[calc(12*var(--u))] text-[calc(14*var(--u))] whitespace-nowrap text-[#e0442c] max-lp:h-6.5 max-lp:text-xs">
              {plan.ribbon}
            </span>
          )}
        </div>
        {/* Contract price: bold black on the left fading to grey on the right, as in the mockup */}
        <p className="mt-[calc(26*var(--u))] bg-[linear-gradient(90deg,#fff_0%,#fff_55%,#8a8a8a_100%)] bg-clip-text text-[calc(52*var(--u))] leading-none font-bold tracking-[-.02em] whitespace-nowrap text-transparent max-lp:mt-4 max-lp:text-[42px]">
          {plan.price}
          {plan.period ? <span className="text-[calc(26*var(--u))] font-medium tracking-normal max-lp:text-[22px]">{plan.period}</span> : null}
        </p>
        {plan.note ? <p className="mt-[calc(12*var(--u))] text-[calc(16*var(--u))] leading-none text-white/55 max-lp:mt-2.5 max-lp:text-sm">{plan.note}</p> : null}
      </div>
      <div className="flex flex-1 flex-col px-[calc(42*var(--u))] pt-[calc(40*var(--u))] pb-[calc(42*var(--u))] max-lp:px-5.5 max-lp:pt-6 max-lp:pb-6">
        <ul className="mb-[calc(56*var(--u))] flex flex-col gap-[calc(22*var(--u))] max-lp:mb-7 max-lp:gap-3.5">
          {plan.features.map((feature: string) => (
            <li key={feature} className="flex items-center gap-[calc(16*var(--u))] text-[calc(18*var(--u))] leading-[1.35] text-white/72 max-lp:gap-3 max-lp:text-[15px]">
              <span className="grid size-[calc(32*var(--u))] flex-none place-items-center rounded-full border border-white/12 bg-white/8 text-white max-lp:size-7 [&_svg]:size-[calc(15*var(--u))] [&_svg]:stroke-[2.8] max-lp:[&_svg]:size-3.5">
                <Check aria-hidden="true" />
              </span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        <Link
          href="/dang-ky"
          className={cn(
            'mt-auto inline-flex h-[calc(46*var(--u))] items-center justify-center rounded-full border text-[calc(17*var(--u))] font-medium no-underline transition-[background,color,border-color] duration-200 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white max-lp:h-11.5 max-lp:text-[15px]',
            plan.featured ? 'border-white bg-white text-[#111] hover:bg-[#ddd]' : 'border-white/25 bg-transparent text-white hover:border-white/60',
          )}
        >
          {pricing.cta}
        </Link>
      </div>
    </article>
  )
}

// Liquid-glass pricing on the dark landing background: a small "Bảng giá" label, then 4 light glass cards (2 columns, stacked
// on mobile).
export default function Pricing({ id }: { id: string }) {
  const { title, plans } = pricing
  const [ref, inView] = useInView<HTMLDivElement>()
  return (
    <section id={id} className={cn(inter.className, 'relative overflow-clip bg-[#111] text-white')} aria-labelledby={`${id}-title`}>
      <div className="relative mx-auto w-[calc(1440*var(--u))] px-[calc(81*var(--u))] pt-[calc(40*var(--u))] pb-[calc(130*var(--u))] max-lp:w-auto max-lp:px-5 max-lp:pt-10 max-lp:pb-18">
        <h2 id={`${id}-title`} className="flex font-normal">
          <FramePill className="ml-[calc(1*var(--u))] w-[calc(130*var(--u))] px-0 max-lp:w-28 max-lp:px-0">{title}</FramePill>
        </h2>
        <div ref={ref} className="relative z-1 mt-[calc(48*var(--u))] grid grid-cols-2 gap-[calc(12*var(--u))] max-lp:mx-auto max-lp:mt-7 max-lp:max-w-115 max-lp:grid-cols-1 max-lp:gap-3.5">
          {plans.map((plan, index) => <PlanCard key={plan.id} plan={plan} index={index} inView={inView} />)}
        </div>
      </div>
    </section>
  )
}
