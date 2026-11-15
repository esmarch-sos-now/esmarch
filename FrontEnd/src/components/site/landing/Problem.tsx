'use client'

import type { CSSProperties } from 'react'
import { BookX, CircleHelp, PhoneOff, Timer, type LucideIcon } from 'lucide-react'
import { FramePill } from '@/components/site/primitives'
import useInView from '@/hooks/useInView'
import { problem } from '@/content/landing'
import { cn } from '@/lib/utils'
import { inter } from './inter'

const icons: Record<string, LucideIcon> = { help: CircleHelp, timer: Timer, phone: PhoneOff, book: BookX }

// Phần "Vấn đề" theo mẫu nền tối: nhãn, tiêu đề, 4 thẻ viền sáng với nền sọc dọc tối.
export default function Problem({ id }: { id: string }) {
  const { label, title, items } = problem
  const [ref, inView] = useInView<HTMLUListElement>()
  return (
    <section id={id} className={cn(inter.className, 'bg-[#111] text-white')} aria-labelledby={`${id}-title`}>
      <div className="mx-auto w-[calc(1440*var(--u))] px-[calc(28*var(--u))] pt-[calc(110*var(--u))] pb-[calc(120*var(--u))] max-lp:w-auto max-lp:px-5 max-lp:pt-14 max-lp:pb-16">
        <FramePill className="ml-[calc(8*var(--u))] max-lp:ml-0">{label}</FramePill>
        <h2
          id={`${id}-title`}
          className="mt-[calc(26*var(--u))] ml-[calc(10*var(--u))] text-[calc(48*var(--u))] leading-[1.1] font-bold tracking-[-.02em] max-lp:mt-5 max-lp:ml-0 max-lp:text-[clamp(28px,8vw,44px)] max-lp:text-balance"
        >
          {title}
        </h2>

        <ul ref={ref} className="mt-[calc(36*var(--u))] grid grid-cols-4 gap-[calc(28*var(--u))] max-lp:mt-8 max-lp:grid-cols-1 max-lp:gap-3.5 min-[600px]:max-lp:grid-cols-2">
          {items.map((item, index) => {
            const Icon = icons[item.icon]
            return (
              <li
                key={item.title}
                style={{ '--i': index } as CSSProperties}
                className={cn(
                  'relative flex h-[calc(364*var(--u))] flex-col border-[max(2px,calc(2.5*var(--u)))] border-[#e9e9e9] p-[calc(26*var(--u))] max-lp:h-auto max-lp:min-h-62.5 max-lp:p-5.5',
                  // Nền sọc dọc tối như mẫu: sáng hơn ở hai mép, tối nhất ở giữa
                  'bg-[linear-gradient(90deg,#333_0%,#202020_16%,#2c2c2c_34%,#151515_52%,#262626_72%,#363636_100%)]',
                  'transition-[opacity,translate,box-shadow] duration-[.6s,.6s,.3s] delay-[calc(var(--i)*110ms),calc(var(--i)*110ms),0s] hover:shadow-[0_0_0_1px_#fff,0_18px_40px_rgba(0,0,0,.5)] motion-reduce:transition-none',
                  inView ? 'translate-0 opacity-100' : 'translate-y-[calc(28*var(--u))] opacity-0 max-lp:motion-safe:translate-y-6 motion-reduce:translate-0 motion-reduce:opacity-100',
                )}
              >
                <span className="grid size-[calc(54*var(--u))] place-items-center rounded-full border border-white/25 text-[#ff5a3c] max-lp:size-12 [&_svg]:size-[calc(26*var(--u))] max-lp:[&_svg]:size-5.5">
                  <Icon aria-hidden="true" />
                </span>
                <span className="absolute top-[calc(22*var(--u))] right-[calc(26*var(--u))] text-[calc(44*var(--u))] leading-none font-extrabold tracking-[-.02em] text-white/12 max-lp:top-4 max-lp:right-5 max-lp:text-[38px]" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="mt-auto max-lp:pt-7">
                  <h3 className="mb-[calc(12*var(--u))] text-[calc(25*var(--u))] leading-[1.2] font-bold tracking-[-.015em] max-lp:mb-2 max-lp:text-[21px]">{item.title}</h3>
                  <p className="text-[calc(16.5*var(--u))] leading-[1.55] text-white/70 max-lp:text-[15px]">{item.text}</p>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
