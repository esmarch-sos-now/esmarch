'use client'

import type { CSSProperties } from 'react'
import { Hospital, MapPin, Mic, ScanFace, Search, Siren, type LucideIcon } from 'lucide-react'
import { FramePill, reveal } from '@/components/site/primitives'
import useInView from '@/hooks/useInView'
import { features } from '@/content/landing'
import { cn } from '@/lib/utils'
import { inter } from './inter'

const icons: Record<string, LucideIcon> = {
  siren: Siren,
  location: MapPin,
  hospital: Hospital,
  voice: Mic,
  search: Search,
  practice: ScanFace,
}

// "Tính năng" theo mẫu nền tối: SOS khẩn cấp + 3 biểu tượng tròn viền mảnh, rồi 3 cột AI Voice | Tìm người hỗ trợ | Luyện tập.
export default function Features({ id }: { id: string }) {
  const { label, sos, items } = features
  const [ref, inView] = useInView<HTMLDivElement>()
  return (
    <section id={id} className={cn(inter.className, 'bg-[#111] text-white')} aria-labelledby={`${id}-title`}>
      <div ref={ref} className="mx-auto w-[calc(1440*var(--u))] px-[calc(47*var(--u))] pt-[calc(40*var(--u))] pb-[calc(130*var(--u))] max-lp:w-auto max-lp:px-5 max-lp:pt-12 max-lp:pb-16">
        <FramePill>{label}</FramePill>

        <div className={cn('mt-[calc(46*var(--u))] flex items-center justify-between pl-[calc(5*var(--u))] max-lp:mt-5 max-lp:flex-col max-lp:items-start max-lp:gap-7 max-lp:pl-0', reveal(inView))}>
          <div>
            <h2 id={`${id}-title`} className="text-[calc(50*var(--u))] leading-[1.1] font-bold tracking-[-.02em] max-lp:text-[clamp(28px,8vw,44px)]">{sos.title}</h2>
            <p className="mt-[calc(26*var(--u))] text-[calc(19*var(--u))] leading-[1.6] text-white/75 max-lp:mt-3 max-lp:text-base">
              {sos.lines.map((line) => (
                <span key={line} className="block">{line}</span>
              ))}
            </p>
          </div>
          <ul className="mr-[calc(40*var(--u))] flex gap-[calc(110*var(--u))] max-lp:mr-0 max-lp:gap-5">
            {sos.icons.map(({ icon, label: iconLabel }) => {
              const Icon = icons[icon]
              return (
                <li key={icon} title={iconLabel} className="grid size-[calc(88*var(--u))] place-items-center rounded-full border-[max(1px,calc(1.5*var(--u)))] border-white/55 text-white/85 max-lp:size-16 [&_svg]:size-[calc(36*var(--u))] [&_svg]:stroke-[1.4] max-lp:[&_svg]:size-7">
                  <Icon aria-hidden="true" />
                  <span className="sr-only">{iconLabel}</span>
                </li>
              )
            })}
          </ul>
        </div>

        <ul className="mt-[calc(160*var(--u))] grid grid-cols-[1fr_1fr_.8fr] gap-[calc(40*var(--u))] max-lp:mt-12 max-lp:grid-cols-1 max-lp:gap-10 min-[600px]:max-lp:grid-cols-2">
          {items.map((item, index) => {
            const Icon = icons[item.icon]
            return (
              <li
                key={item.title}
                style={{ '--i': index } as CSSProperties}
                className={cn(
                  'transition-[opacity,translate] duration-600 ease-out delay-[calc(var(--i)*120ms)] motion-reduce:transition-none',
                  inView ? 'translate-0 opacity-100' : 'translate-y-[calc(24*var(--u))] opacity-0 max-lp:motion-safe:translate-y-5 motion-reduce:translate-0 motion-reduce:opacity-100',
                )}
              >
                <Icon className="size-[calc(34*var(--u))] stroke-[1.5] text-white/80 max-lp:size-7" aria-hidden="true" />
                <h3 className="mt-[calc(14*var(--u))] text-[calc(30*var(--u))] leading-[1.15] font-bold tracking-[-.01em] max-lp:mt-3 max-lp:text-2xl">{item.title}</h3>
                <ul className="mt-[calc(14*var(--u))] grid gap-[calc(6*var(--u))] max-lp:mt-3 max-lp:gap-1.5">
                  {item.points.map((point) => (
                    <li key={point} className="text-[calc(16*var(--u))] leading-[1.45] text-white/65 max-lp:text-[15px]">{point}</li>
                  ))}
                </ul>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
