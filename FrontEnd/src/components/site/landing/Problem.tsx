'use client'

import type { CSSProperties } from 'react'
import { BookX, CircleHelp, PhoneOff, Timer, type LucideIcon } from 'lucide-react'
import { FramePill } from '@/components/site/primitives'
import useInView from '@/hooks/useInView'
import { problem } from '@/content/landing'
import { cn } from '@/lib/utils'
import { inter } from './inter'

const icons: Record<string, LucideIcon> = { help: CircleHelp, timer: Timer, phone: PhoneOff, book: BookX }

// Thanh cam trang trí ở góc: đậm ở phía mép khung, mờ dần vào trong
const bar = 'pointer-events-none absolute h-[calc(15*var(--u))] max-lp:hidden'
const barFromRight = 'bg-[linear-gradient(270deg,#f67212,rgba(246,114,18,0))]'
const barFromLeft = 'bg-[linear-gradient(90deg,#f67212,rgba(246,114,18,0))]'

// Phần "Vấn đề" theo mẫu thiết kế (khung 1440x810): nhãn, tiêu đề một dòng, 4 thẻ, các thanh cam trang trí ở góc.
// Nội dung kéo lên 60 đơn vị so với mẫu vì dải đen loang xuống ở đáy hero đã chiếm chỗ phía trên.
export default function Problem({ id }: { id: string }) {
  const { label, title, items } = problem
  const [ref, inView] = useInView<HTMLUListElement>()
  return (
    // Chồng lên đáy hero 3px (cùng màu #f8f8f8) để không lộ vạch mảnh do làm tròn pixel ở chỗ nối
    <section id={id} className={cn(inter.className, 'relative -mt-0.75 overflow-clip bg-[#f8f8f8] text-[#151515]')} aria-labelledby={`${id}-title`}>
      <div className="relative mx-auto h-[calc(750*var(--u))] w-[calc(1440*var(--u))] max-lp:flex max-lp:h-auto max-lp:w-auto max-lp:flex-col max-lp:items-start max-lp:px-5 max-lp:pt-14 max-lp:pb-16">
        <span className={cn(bar, barFromRight, 'top-[calc(39*var(--u))] left-[calc(1333*var(--u))] w-[calc(46*var(--u))]')} aria-hidden="true" />
        <span className={cn(bar, barFromRight, 'top-[calc(65*var(--u))] left-[calc(1251*var(--u))] w-[calc(128*var(--u))]')} aria-hidden="true" />
        <span className={cn(bar, barFromLeft, 'top-[calc(648*var(--u))] left-[calc(78*var(--u))] w-[calc(128*var(--u))]')} aria-hidden="true" />
        <span className={cn(bar, barFromLeft, 'top-[calc(674*var(--u))] left-[calc(78*var(--u))] w-[calc(51*var(--u))]')} aria-hidden="true" />

        <FramePill className="absolute top-[calc(68*var(--u))] left-[calc(82*var(--u))] w-[calc(120*var(--u))] px-0 max-lp:static max-lp:w-26 max-lp:px-0">{label}</FramePill>
        <h2
          id={`${id}-title`}
          className="absolute top-[calc(126.6*var(--u))] left-[calc(81*var(--u))] text-[calc(54.2*var(--u))] leading-none font-bold tracking-[-.025em] whitespace-nowrap max-lp:static max-lp:mt-5 max-lp:text-[clamp(28px,8vw,44px)] max-lp:leading-[1.12] max-lp:text-balance max-lp:whitespace-normal"
        >
          {title.join(' ')}
        </h2>

        <ul ref={ref} className="pointer-events-none absolute inset-0 max-lp:static max-lp:mt-8 max-lp:grid max-lp:w-full max-lp:grid-cols-1 max-lp:gap-3.5 min-[600px]:max-lp:grid-cols-2">
          {items.map((item, index) => {
            const Icon = icons[item.icon]
            return (
              <li
                key={item.title}
                style={{ '--i': index } as CSSProperties}
                className={cn(
                  'pointer-events-auto absolute top-[calc(270*var(--u))] left-[calc((81+var(--i)*332)*var(--u))] flex h-[calc(352*var(--u))] w-[calc(302*var(--u))] flex-col border border-[#2b2b2b] p-[calc(28*var(--u))]',
                  // Nền trắng xám: phẳng bên trái, tối dần về mép phải như thẻ trong mẫu
                  'bg-[linear-gradient(90deg,#f8f8f8_0%,#f8f8f8_40%,#f1f1f1_72%,#dedede_92%,#d6d6d6_100%)]',
                  'max-lp:relative max-lp:inset-auto max-lp:h-auto max-lp:min-h-62.5 max-lp:w-auto max-lp:p-5.5',
                  // Thẻ hiện lần lượt khi cuộn tới; rê chuột thì nổi lên
                  'transition-[opacity,translate,box-shadow,transform] duration-[.6s,.6s,.3s,.3s] delay-[calc(var(--i)*110ms),calc(var(--i)*110ms),0s,0s]',
                  'hover:transform-[translateY(calc(-4*var(--u)))] hover:shadow-[0_14px_30px_rgba(0,0,0,.1)]',
                  'motion-reduce:transition-none motion-reduce:hover:transform-none',
                  inView ? 'translate-0 opacity-100' : 'translate-y-[calc(28*var(--u))] opacity-0 max-lp:motion-safe:translate-y-6 motion-reduce:translate-0 motion-reduce:opacity-100',
                )}
              >
                <span className="grid size-[calc(56*var(--u))] place-items-center rounded-full border border-black/12 bg-white text-[#e5361a] max-lp:size-12 [&_svg]:size-[calc(26*var(--u))] max-lp:[&_svg]:size-5.5">
                  <Icon aria-hidden="true" />
                </span>
                <span className="absolute top-[calc(22*var(--u))] right-[calc(26*var(--u))] text-[calc(46*var(--u))] leading-none font-extrabold tracking-[-.02em] text-black/14 max-lp:top-4 max-lp:right-5 max-lp:text-[38px]" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="mt-auto max-lp:pt-7">
                  <h3 className="mb-[calc(12*var(--u))] text-[calc(26*var(--u))] leading-[1.2] font-bold tracking-[-.015em] max-lp:mb-2 max-lp:text-[21px]">{item.title}</h3>
                  <p className="text-[calc(17.5*var(--u))] leading-[1.55] text-[#4a4a4a] max-lp:text-[15px]">{item.text}</p>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
