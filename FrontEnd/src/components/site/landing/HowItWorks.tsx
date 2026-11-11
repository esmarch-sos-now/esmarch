'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { MapPin, Navigation, PhoneCall, Siren } from 'lucide-react'
import { Container, Pill, Section, reveal } from '@/components/site/primitives'
import { howItWorks } from '@/content/landing'
import { cn } from '@/lib/utils'

const lightning = '/site/lightning.webp'
const stepSos = '/site/step-sos.webp'
const stepLocation = '/site/step-location.webp'
const stepCall = '/site/step-call.webp'
const stepNavigation = '/site/step-navigation.webp'

const STEP_MS = 4000
const media = [
  { image: stepSos, Icon: Siren },
  { image: stepLocation, Icon: MapPin },
  { image: stepCall, Icon: PhoneCall },
  { image: stepNavigation, Icon: Navigation }
]

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Màn hình hẹp (<900px): các bước xếp dọc, bước đang chọn mở ra như accordion
export default function HowItWorks({ id }: { id: string }) {
  const { label, title, steps } = howItWorks
  const [active, setActive] = useState(0)
  const [visible, setVisible] = useState(false)
  const [seen, setSeen] = useState(false)
  const [paused, setPaused] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)
  const autoplay = visible && !paused && !prefersReducedMotion()

  // Chỉ tự chuyển bước khi phần này đang nằm trong màn hình
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting)
      if (entry.isIntersecting) setSeen(true)
    }, { threshold: 0.2 })
    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  // Hẹn giờ gắn với `active` nên bấm chọn bước sẽ đếm lại từ đầu
  useEffect(() => {
    if (!autoplay) return
    const timer = setTimeout(() => setActive((current) => (current + 1) % steps.length), STEP_MS)
    return () => clearTimeout(timer)
  }, [active, autoplay, steps.length])

  return (
    <Section id={id} ref={sectionRef} aria-labelledby={`${id}-title`}>
      <Container>
        <div className={reveal(seen)}>
          <Pill>{label}</Pill>
          <h2 id={`${id}-title`} className="mt-2 mb-7 flex flex-wrap items-center gap-x-2.5 gap-y-1 leading-[1.2] font-black text-shadow-[3px_4px_6px_rgba(0,0,0,.25)] max-[899px]:mb-5">
            <span className="text-[clamp(20px,2vw,26px)] text-[#111] max-xs:text-lg">{title[0]}</span>{' '}
            <span className="text-[clamp(32px,3.6vw,46px)] text-brand-yellow uppercase max-xs:text-[30px]">{title[1]}</span>
            <img className="ml-2 h-auto w-[clamp(40px,4.2vw,56px)] max-xs:ml-0 max-xs:w-8.5" src={lightning} alt="" width="90" height="120" />
          </h2>
        </div>

        <ol
          className="mx-auto flex min-h-85 max-w-260 items-center gap-[clamp(12px,2vw,28px)] max-[899px]:min-h-0 max-[899px]:flex-col max-[899px]:items-stretch max-[899px]:gap-2.5"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          {steps.map((step, index) => {
            const { image, Icon } = media[index]
            const isActive = index === active
            return (
              <li
                key={step.title}
                style={{ animationDelay: `${index * 140}ms` }}
                className={cn(
                  'min-w-0 flex-[1_1_0] transition-[flex-grow] duration-500 motion-reduce:animate-none motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none',
                  isActive && 'grow-[1.4]',
                  seen ? 'animate-step-rise' : 'translate-y-6 opacity-0',
                )}
              >
                <button
                  type="button"
                  aria-current={isActive ? 'step' : undefined}
                  onClick={() => setActive(index)}
                  className={cn(
                    'relative flex w-full flex-col overflow-hidden rounded-[10px] bg-[#f1f1f1] text-left text-text transition-[height,padding,box-shadow] duration-500 motion-reduce:transition-none max-[899px]:h-auto',
                    isActive
                      ? 'h-80 cursor-default px-0 pt-0 pb-4 shadow-[0_16px_36px_rgba(0,0,0,.08)]'
                      : 'h-57.5 cursor-pointer p-3.5 hover:shadow-[0_10px_24px_rgba(0,0,0,.06)] max-[899px]:flex-row max-[899px]:items-center max-[899px]:gap-3 max-[899px]:px-3.5 max-[899px]:py-3',
                  )}
                >
                  <span className={cn('block overflow-hidden transition-[height] duration-500 motion-reduce:transition-none', isActive ? 'h-35' : 'h-0')}>
                    <img src={image} alt="" loading="lazy" className="block size-full object-cover" />
                  </span>
                  <span className={cn('font-number text-[34px] leading-none text-[#bdbdbd] text-shadow-[1px_2px_3px_rgba(0,0,0,.15)] max-[899px]:text-[26px]', isActive && 'hidden')}>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span
                    className={cn(
                      'flex flex-col gap-2',
                      isActive
                        ? 'mt-3.5 px-4 max-[899px]:mt-3 max-[899px]:items-start'
                        : 'mt-auto max-[899px]:mt-0 max-[899px]:flex-1 max-[899px]:flex-row max-[899px]:items-center',
                    )}
                  >
                    <span className="grid size-7.5 place-items-center rounded-full bg-white text-brand [&_svg]:size-3.75"><Icon aria-hidden="true" /></span>
                    <span className="text-[clamp(15px,1.2vw,17px)] leading-[1.3] font-medium">{step.title}</span>
                    <span
                      className={cn(
                        'overflow-hidden text-[13px] text-muted-foreground transition-opacity duration-300 motion-reduce:transition-none',
                        isActive ? 'max-h-50 opacity-100 delay-250' : 'max-h-0 opacity-0 max-[899px]:hidden',
                      )}
                    >
                      {step.description}
                    </span>
                  </span>
                  {isActive && (
                    <span
                      key={active}
                      style={{ '--step-duration': `${STEP_MS}ms` } as CSSProperties}
                      className={cn('absolute bottom-0 left-0 h-0.75 w-full origin-left animate-step-progress bg-brand', !autoplay && '[animation-play-state:paused]')}
                    />
                  )}
                </button>
              </li>
            )
          })}
        </ol>
      </Container>
    </Section>
  )
}
