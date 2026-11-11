'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Container, Pill, Section, reveal } from '@/components/site/primitives'
import useInView from '@/hooks/useInView'
import { cn } from '@/lib/utils'
import { team } from '@/content/landing'

const myDung = '/site/team/my-dung.webp'
const ngocHuu = '/site/team/ngoc-huu.webp'
const quynhGiao = '/site/team/quynh-giao.webp'
const yenNhi = '/site/team/yen-nhi.webp'
const thuHuyen = '/site/team/thu-huyen.webp'
const hoangNam = '/site/team/hoang-nam.webp'

const photos: Record<string, string> = { 'my-dung': myDung, 'ngoc-huu': ngocHuu, 'quynh-giao': quynhGiao, 'yen-nhi': yenNhi, 'thu-huyen': thuHuyen, 'hoang-nam': hoangNam }
const AUTOPLAY_MS = 5000
// Vị trí ngang của thẻ theo khoảng cách tới thẻ giữa, tính bằng bội số chiều rộng thẻ
const SHIFT = [0, 1.07, 2]

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Khoảng cách vòng tròn từ thẻ `index` tới thẻ đang chọn, trong khoảng [-n/2, n/2]
function offsetOf(index: number, active: number, total: number) {
  let offset = (index - active + total) % total
  if (offset > total / 2) offset -= total
  return offset
}

export default function Team({ id }: { id: string }) {
  const { label, title, subtitle, members } = team
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const [ref, inView] = useInView<HTMLDivElement>()
  const swipeStart = useRef<number | null>(null)
  const total = members.length
  const go = useCallback((step: number) => setActive((current) => (current + step + total) % total), [total])

  // Tự chuyển thẻ, dừng khi rê chuột/focus vào hoặc khi người dùng giảm chuyển động
  useEffect(() => {
    if (!inView || paused || prefersReducedMotion()) return
    const timer = setTimeout(() => go(1), AUTOPLAY_MS)
    return () => clearTimeout(timer)
  }, [active, inView, paused, go])

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowLeft') go(-1)
    if (event.key === 'ArrowRight') go(1)
  }
  const onPointerUp = (event: React.PointerEvent) => {
    if (swipeStart.current === null) return
    const dx = event.clientX - swipeStart.current
    swipeStart.current = null
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1)
  }

  return (
    // clip (không phải hidden) để cuộn tới #doi-ngu không làm lệch ngang băng chuyền
    <Section id={id} className="overflow-clip [--card-w:230px] max-md:[--card-w:180px]" aria-labelledby={`${id}-title`}>
      <Container>
        <Pill>{label}</Pill>
        <div ref={ref} className={cn('mt-4 flex items-end justify-between gap-6 max-md:flex-col max-md:items-start', reveal(inView))}>
          <div>
            <h2 id={`${id}-title`} className="text-[clamp(28px,3.4vw,42px)] leading-[1.2] font-black text-ink">{title[0]} <span className="text-brand-yellow">{title[1]}</span></h2>
            <p className="mt-2 text-base text-muted-foreground">{subtitle}</p>
          </div>
          <div className="flex flex-none gap-3">
            {[{ step: -1, label: 'Thành viên trước', Icon: ChevronLeft }, { step: 1, label: 'Thành viên tiếp theo', Icon: ChevronRight }].map(({ step, label: arrowLabel, Icon }) => (
              <button
                key={step}
                type="button"
                onClick={() => go(step)}
                aria-label={arrowLabel}
                className="grid size-11.5 cursor-pointer place-items-center rounded-full border border-[#f0d9d4] bg-white text-brand transition-colors duration-200 hover:bg-brand hover:text-white [&_svg]:size-5.5"
              >
                <Icon />
              </button>
            ))}
          </div>
        </div>
      </Container>

      {/* Băng chuyền 3D: thẻ giữa nổi bật, các thẻ hai bên nghiêng và mờ dần */}
      <div
        className="relative mt-8 h-[calc(var(--card-w)*1.417+40px)] touch-pan-y outline-none select-none perspective-[1400px] focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-brand-yellow"
        role="region"
        aria-roledescription="carousel"
        aria-label="Thành viên đội ngũ"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        onPointerDown={(event) => { swipeStart.current = event.clientX }}
        onPointerUp={onPointerUp}
      >
        {members.map((member, index) => {
          const offset = offsetOf(index, active, total)
          const distance = Math.abs(offset)
          const hidden = distance > 2
          return (
            <article
              key={member.id}
              className={cn(
                'absolute top-5 left-1/2 ml-[calc(var(--card-w)/-2)] aspect-[360/510] w-(--card-w) cursor-pointer overflow-hidden rounded-[22px] shadow-[0_20px_40px_-16px_rgba(20,30,80,.35)] max-md:rounded-[18px]',
                '[transform:translateX(calc(var(--card-w)*var(--shift)))_rotateY(var(--tilt))_scale(var(--scale))] transition-[transform,opacity] duration-600 ease-[cubic-bezier(.22,.8,.3,1)] motion-reduce:transition-none',
                // Lớp phủ trắng mờ cho thẻ ở xa
                "after:pointer-events-none after:absolute after:inset-0 after:bg-[rgba(240,242,250,var(--fade))] after:transition-[background] after:duration-600 after:content-[''] motion-reduce:after:transition-none",
                offset === 0 && 'cursor-default',
              )}
              style={{ '--shift': Math.sign(offset) * SHIFT[Math.min(distance, 2)], '--tilt': `${-Math.sign(offset) * 26}deg`, '--scale': 1 - distance * 0.12, '--fade': distance * 0.32, zIndex: 10 - distance, opacity: hidden ? 0 : 1, pointerEvents: hidden ? 'none' : undefined } as React.CSSProperties}
              aria-hidden={offset !== 0}
              onClick={() => offset !== 0 && setActive(index)}
            >
              <img src={photos[member.id]} alt={`${member.name}, ${member.role}`} width="360" height="510" draggable="false" className="block size-full object-cover" />
              {/* Ô kính mờ ở chân thẻ */}
              <div className="absolute right-2.5 bottom-2.5 left-2.5 rounded-[14px] border border-white/35 bg-white/16 px-3 py-2 text-white backdrop-blur-[10px] max-md:right-2 max-md:bottom-2 max-md:left-2 max-md:rounded-xl max-md:px-2.5 max-md:py-1.5">
                <span className="grid gap-0.5">
                  <strong className="text-[13px] font-semibold max-md:text-xs">SOS NOW</strong>
                  <small className="text-xs opacity-90 max-md:text-[11px]">{member.area}</small>
                </span>
              </div>
            </article>
          )
        })}
      </div>

      <div className="mt-7 flex justify-center gap-2" role="tablist" aria-label="Chọn thành viên">
        {members.map((member, index) => (
          <button
            key={member.id}
            type="button"
            role="tab"
            aria-selected={index === active}
            aria-label={member.name}
            className={cn('h-2.5 cursor-pointer rounded-full transition-[width,background] duration-300', index === active ? 'w-7 bg-brand' : 'w-2.5 bg-[#d9dbe6]')}
            onClick={() => setActive(index)}
          />
        ))}
      </div>
    </Section>
  )
}
