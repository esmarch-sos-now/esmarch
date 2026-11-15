'use client'

import type { CSSProperties } from 'react'
import { MapPin, Navigation, Phone, Siren, type LucideIcon } from 'lucide-react'
import { FramePill } from '@/components/site/primitives'
import useInView from '@/hooks/useInView'
import { howItWorks } from '@/content/landing'
import { cn } from '@/lib/utils'
import { inter } from './inter'

const icons: Record<string, LucideIcon> = { sos: Siren, location: MapPin, call: Phone, navigate: Navigation }

// Toạ độ (khung 1440 đơn vị) của từng bước: x = tâm ngang, y = chấm tròn. Bước sau cao hơn bước trước như bậc thang.
const positions = [
  { x: 255, y: 510 },
  { x: 575, y: 440 },
  { x: 895, y: 370 },
  { x: 1215, y: 300 }
]

// Hiện lần lượt khi cuộn tới (chữ, chấm tròn, nút "Bước n")
const fadeIn = 'transition-[opacity,translate] duration-600 ease-in-out delay-[calc(var(--i)*150ms)] motion-reduce:transition-none'

// Hướng dẫn sử dụng dạng timeline bậc thang trên nền xám nhạt (khung 1440 x 730, thanh vạch ngang ở y = 660):
// tiêu đề + mô tả phía trên chấm tròn, đường dọc nối xuống thanh vạch ngang, trên thanh là nút "Bước n" kèm biểu tượng tròn đen.
// Dưới breakpoint `lp`: timeline dọc, thanh vạch chạy dọc bên trái.
export default function HowItWorks({ id }: { id: string }) {
  const { label, title, steps } = howItWorks
  const [ref, inView] = useInView<HTMLOListElement>()
  const shown = inView ? 'opacity-100' : 'opacity-0 motion-reduce:opacity-100'
  return (
    <section id={id} className={cn(inter.className, 'relative overflow-clip bg-[#f8f8f8] text-[#111]')} aria-labelledby={`${id}-title`}>
      <div className="relative mx-auto h-[calc(730*var(--u))] w-[calc(1440*var(--u))] max-lp:flex max-lp:h-auto max-lp:w-auto max-lp:flex-col max-lp:items-start max-lp:px-5 max-lp:pt-12 max-lp:pb-16">
        <FramePill className="absolute top-[calc(60*var(--u))] left-[calc(82*var(--u))] w-[calc(120*var(--u))] px-0 max-lp:static max-lp:w-26 max-lp:px-0">{label}</FramePill>
        <h2
          id={`${id}-title`}
          className="absolute top-[calc(125*var(--u))] left-[calc(81*var(--u))] text-[calc(54.2*var(--u))] leading-none font-bold tracking-[-.025em] whitespace-nowrap max-lp:static max-lp:mt-5 max-lp:text-[clamp(28px,8vw,44px)] max-lp:leading-[1.12] max-lp:whitespace-normal"
        >
          {title}
        </h2>

        {/* Thanh vạch ngang (các vạch dọc nhỏ sát nhau), mờ dần ở hai đầu */}
        <span
          className="absolute top-[calc(651*var(--u))] left-[calc(110*var(--u))] h-[calc(18*var(--u))] w-[calc(1220*var(--u))] bg-[repeating-linear-gradient(90deg,#c4c4c4_0_calc(2.5*var(--u)),transparent_calc(2.5*var(--u))_calc(6*var(--u)))] mask-[linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)] max-lp:hidden"
          aria-hidden="true"
        />
        <ol
          ref={ref}
          className="absolute inset-0 max-lp:relative max-lp:mt-9 max-lp:flex max-lp:w-full max-lp:flex-col max-lp:gap-8 max-lp:before:absolute max-lp:before:inset-y-5.5 max-lp:before:left-5.5 max-lp:before:w-3.5 max-lp:before:-translate-x-1/2 max-lp:before:bg-[repeating-linear-gradient(180deg,#c4c4c4_0_2px,transparent_2px_5px)] max-lp:before:content-['']"
        >
          {steps.map((step, index) => {
            const Icon = icons[step.icon]
            const { x, y } = positions[index]
            return (
              // Mỗi bước là một cột rộng 0 đặt tại tâm x; các phần tử con căn giữa theo cột đó
              <li
                key={step.title}
                style={{ '--i': index, '--x': x, '--y': y } as CSSProperties}
                className="absolute inset-y-0 left-[calc(var(--x)*var(--u))] w-0 max-lp:relative max-lp:inset-auto max-lp:flex max-lp:w-auto max-lp:flex-col max-lp:items-start max-lp:gap-3"
              >
                <div
                  className={cn(
                    'absolute bottom-[calc((752-var(--y))*var(--u))] left-0 w-[calc(270*var(--u))] -translate-x-1/2 text-center',
                    'max-lp:static max-lp:w-auto max-lp:translate-x-0 max-lp:pl-14 max-lp:text-left',
                    fadeIn,
                    shown,
                    inView ? 'translate-y-0' : 'translate-y-[calc(16*var(--u))] max-lp:motion-safe:translate-y-4 motion-reduce:translate-y-0',
                  )}
                >
                  <h3 className="text-[calc(30*var(--u))] leading-[1.15] font-medium tracking-[-.015em] max-lp:text-[22px]">{step.title}</h3>
                  <p className="mt-[calc(10*var(--u))] text-[calc(16*var(--u))] leading-[1.4] text-[#6b6b6b] max-lp:mt-1.5 max-lp:text-[15px]">{step.description}</p>
                </div>
                <span
                  className={cn('absolute top-[calc(var(--y)*var(--u))] left-0 size-[calc(11*var(--u))] -translate-x-1/2 rounded-full border-[max(1.5px,calc(1.8*var(--u)))] border-[#8a8a8a] max-lp:hidden', fadeIn, shown)}
                  aria-hidden="true"
                />
                {/* Đường dọc mảnh từ chấm tròn xuống nút trên thanh, nhạt dần về phía dưới và mọc xuống khi cuộn tới */}
                <span
                  className={cn(
                    'absolute top-[calc((var(--y)+11)*var(--u))] left-0 h-[calc((627-var(--y))*var(--u))] w-px origin-top -translate-x-1/2 bg-[linear-gradient(to_bottom,#9a9a9a,rgba(154,154,154,.2))] max-lp:hidden',
                    'transition-[scale] duration-700 ease-in-out delay-[calc(var(--i)*150ms+200ms)] motion-reduce:scale-y-100 motion-reduce:transition-none',
                    inView ? 'scale-y-100' : 'scale-y-0',
                  )}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    'absolute top-[calc(638*var(--u))] left-0 inline-flex h-[calc(44*var(--u))] -translate-x-1/2 items-center gap-[calc(14*var(--u))] rounded-full border border-[#dcdcdc] bg-white pr-[calc(4*var(--u))] pl-[calc(18*var(--u))] text-[calc(15*var(--u))] whitespace-nowrap text-[#333] shadow-[0_calc(4*var(--u))_calc(14*var(--u))_rgba(0,0,0,.06)]',
                    'max-lp:relative max-lp:top-auto max-lp:-order-1 max-lp:h-11 max-lp:translate-x-0 max-lp:gap-3 max-lp:pr-1 max-lp:pl-4 max-lp:text-sm',
                    fadeIn,
                    shown,
                  )}
                >
                  Bước {index + 1}
                  <span className="grid size-[calc(36*var(--u))] place-items-center rounded-full bg-[#111] text-white max-lp:size-9 [&_svg]:size-[calc(17*var(--u))] [&_svg]:stroke-[1.8] max-lp:[&_svg]:size-4.25" aria-hidden="true">
                    <Icon />
                  </span>
                </span>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
