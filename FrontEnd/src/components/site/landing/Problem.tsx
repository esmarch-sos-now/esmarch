'use client'

import type { CSSProperties } from 'react'
import { ArrowRight, BookX, CircleHelp, PhoneOff, Timer, type LucideIcon } from 'lucide-react'
import { Container, Pill, Section, reveal } from '@/components/site/primitives'
import useInView from '@/hooks/useInView'
import { problem } from '@/content/landing'
import { cn } from '@/lib/utils'

const icons: Record<string, LucideIcon> = { help: CircleHelp, timer: Timer, phone: PhoneOff, book: BookX }

export default function Problem({ id }: { id: string }) {
  const { label, title, subtitle, items, solution, solutionLink } = problem
  const [ref, inView] = useInView<HTMLUListElement>()
  return (
    <Section id={id} aria-labelledby={`${id}-title`}>
      <Container>
        <Pill>{label}</Pill>
        <h2 id={`${id}-title`} className="mt-3 text-[clamp(28px,3.2vw,42px)] leading-[1.15] font-black tracking-[-.01em] text-text">
          {title[0]} <span className="text-brand-yellow text-shadow-[3px_4px_6px_rgba(0,0,0,.18)]">{title[1]}</span>
        </h2>
        <p className="mt-2.5 max-w-155 text-base text-muted-foreground">{subtitle}</p>

        <ul ref={ref} className="mt-9 grid grid-cols-4 gap-[clamp(12px,2vw,24px)] max-lg:grid-cols-2 max-xs:grid-cols-1">
          {items.map((item, index) => {
            const Icon = icons[item.icon]
            return (
              <li
                key={item.title}
                style={{ '--delay': `${index * 110}ms` } as CSSProperties}
                className={cn(
                  'relative flex min-h-57.5 flex-col gap-2.5 overflow-hidden rounded-[10px] bg-[#f1f1f1] px-4.5 py-5 max-lg:min-h-0',
                  'transition-[opacity,translate,box-shadow] delay-(--delay) duration-600 ease-out hover:shadow-[0_14px_30px_rgba(0,0,0,.08)]',
                  'motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none',
                  inView ? 'translate-y-0 opacity-100 hover:-translate-y-0.75 hover:delay-0 motion-reduce:hover:translate-y-0' : 'translate-y-7 opacity-0',
                )}
              >
                <span className="absolute top-3 right-4 font-number text-[40px] leading-none text-[#d4d4d4]">{String(index + 1).padStart(2, '0')}</span>
                <span className="grid size-10 place-items-center rounded-full bg-white text-brand [&_svg]:size-5"><Icon aria-hidden="true" /></span>
                <h3 className="mt-1.5 text-[17px] leading-[1.3] font-bold text-ink">{item.title}</h3>
                <p className="text-sm leading-[1.55] text-muted-foreground">{item.text}</p>
              </li>
            )
          })}
        </ul>

        <div className={cn('mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-[14px] bg-brand px-6 py-4.5 text-white delay-450 max-xs:px-4.5 max-xs:py-4', reveal(inView))}>
          <p className="text-[clamp(16px,1.6vw,19px)] leading-[1.4] font-bold">{solution}</p>
          <a href={solutionLink.href} className="inline-flex items-center gap-2 rounded-full bg-brand-yellow px-5 py-2.5 text-[15px] font-medium whitespace-nowrap text-ink transition-colors hover:bg-[#ffd04d] max-xs:w-full max-xs:justify-center [&_svg]:size-4.5">
            {solutionLink.label} <ArrowRight aria-hidden="true" />
          </a>
        </div>
      </Container>
    </Section>
  )
}
