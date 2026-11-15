'use client'

import { FramePill, reveal } from '@/components/site/primitives'
import useInView from '@/hooks/useInView'
import { expert } from '@/content/landing'
import { cn } from '@/lib/utils'
import { inter, serif } from './inter'

// "Chuyên gia" theo mẫu: ảnh chuyên gia kèm tên bên trái, trích dẫn chữ có chân trong khung xám bên phải.
export default function Expert({ id }: { id: string }) {
  const { label, name, role, photo, quote, note } = expert
  const [ref, inView] = useInView<HTMLDivElement>()
  return (
    <section id={id} className={cn(inter.className, 'bg-[#111] text-white')} aria-labelledby={`${id}-title`}>
      <div className="mx-auto w-[calc(1440*var(--u))] px-[calc(47*var(--u))] pt-[calc(40*var(--u))] pb-[calc(140*var(--u))] max-lp:w-auto max-lp:px-5 max-lp:pt-12 max-lp:pb-16">
        <h2 id={`${id}-title`} className="flex font-normal">
          <FramePill>{label}</FramePill>
        </h2>
        <div ref={ref} className={cn('mt-[calc(56*var(--u))] grid grid-cols-[calc(534*var(--u))_1fr] gap-[calc(23*var(--u))] pl-[calc(43*var(--u))] max-lp:mt-6 max-lp:grid-cols-1 max-lp:gap-6 max-lp:pl-0', reveal(inView))}>
          <figure className="text-center">
            {/* Ảnh có sẵn nền chuyển đen sang trắng như mẫu */}
            <img src={photo} alt={name} width="796" height="652" className="block aspect-[534/437] w-full object-cover" />
            <figcaption className="mt-[calc(18*var(--u))] max-lp:mt-3">
              <strong className="block text-[calc(24*var(--u))] leading-[1.3] font-bold max-lp:text-lg">{name}</strong>
              <span className="block text-[calc(19*var(--u))] leading-[1.4] text-white/70 max-lp:text-[15px]">{role}</span>
            </figcaption>
          </figure>
          <div>
            <blockquote className="flex aspect-[756/437] items-center bg-[#303030] px-[calc(86*var(--u))] max-lp:aspect-auto max-lp:px-6 max-lp:py-9">
              <p className={cn(serif.className, 'text-[calc(27*var(--u))] leading-[1.45] text-white/95 max-lp:text-xl')}>“{quote}”</p>
            </blockquote>
            <p className="mt-[calc(10*var(--u))] text-[calc(12.5*var(--u))] text-white/55 max-lp:mt-2 max-lp:text-xs">{note}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
