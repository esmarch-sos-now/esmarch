'use client'

import { Check } from 'lucide-react'
import { Container, Pill, Section, reveal } from '@/components/site/primitives'
import useInView from '@/hooks/useInView'
import { features } from '@/content/landing'
import { cn } from '@/lib/utils'
import { CourseMock, SosMock, VoiceMock } from './FeatureMockups'

const lightningDouble = '/site/lightning-double.webp'

const mockups: Record<string, () => React.JSX.Element> = { voice: VoiceMock, course: CourseMock, sos: SosMock }

function FeatureRow({ item, reverse }: { item: { visual: string; tag: string; title: string; subtitle: string; points: string[] }; reverse: boolean }) {
  const [ref, inView] = useInView<HTMLElement>()
  const Mockup = mockups[item.visual]
  return (
    <article
      ref={ref}
      data-in-view={inView}
      className={cn('group grid grid-cols-2 items-center gap-[clamp(32px,6vw,88px)] max-[899px]:grid-cols-1 max-[899px]:gap-7', reveal(inView))}
    >
      <div className={cn('max-w-115 max-[899px]:max-w-none', reverse && 'order-2 max-[899px]:order-none')}>
        <span className="inline-block rounded-full bg-[#fde08f] px-3 py-0.75 text-sm font-medium text-ink">{item.tag}</span>
        <h3 className="mt-3.5 mb-1.5 text-[clamp(26px,2.6vw,34px)] leading-[1.2] font-black tracking-[-.01em] text-ink">{item.title}</h3>
        <p className="mb-8 text-[17px] leading-[1.4] text-brand max-[899px]:mb-5">{item.subtitle}</p>
        <ul className="grid gap-4">
          {item.points.map((point: string) => (
            <li key={point} className="flex items-center gap-3.5 text-base leading-[1.4] text-[#222] max-xs:text-[15px]">
              <span className="grid size-7.5 flex-none place-items-center rounded-full bg-[#e6e9fb] text-[#4f5fd6] [&_svg]:size-4 [&_svg]:stroke-[2.5]"><Check aria-hidden="true" /></span>
              {point}
            </li>
          ))}
        </ul>
      </div>
      {/* Khung ngoài bo tròn lớn, bên trong là "màn hình" app */}
      <div
        aria-hidden="true"
        className="flex h-91.5 justify-center rounded-[48px] border border-[#e3e7f3] bg-white px-[9%] shadow-[0_30px_60px_-24px_rgba(70,90,200,.22)] max-[899px]:mx-auto max-[899px]:h-auto max-[899px]:w-full max-[899px]:max-w-130 max-[899px]:rounded-[36px] max-[899px]:px-[6%] max-xs:rounded-[28px] max-xs:px-[4%]"
      >
        <Mockup />
      </div>
    </article>
  )
}

export default function Features({ id }: { id: string }) {
  const { label, title, items } = features
  const [ref, inView] = useInView<HTMLHeadingElement>()
  return (
    <Section id={id} aria-labelledby={`${id}-title`}>
      <Container>
        <Pill>{label}</Pill>
        <h2
          ref={ref}
          id={`${id}-title`}
          className={cn('mt-2 mb-10 flex flex-wrap items-center gap-x-2.5 gap-y-1 leading-[1.2] font-black uppercase text-shadow-[3px_4px_6px_rgba(0,0,0,.25)] max-[899px]:mb-7', reveal(inView))}
        >
          <span className="text-[clamp(32px,3.6vw,46px)] text-brand max-xs:text-[30px]">{title[0]}</span>{' '}
          <span className="text-[clamp(20px,2vw,26px)] text-ink max-xs:text-lg">{title[1]}</span>
          <img className="ml-2 h-auto w-[clamp(40px,4.2vw,56px)] max-xs:ml-0 max-xs:w-8.5" src={lightningDouble} alt="" width="110" height="115" />
        </h2>
        <div className="mx-auto grid max-w-280 gap-[clamp(72px,9vw,120px)]">
          {items.map((item, index) => <FeatureRow key={item.visual} item={item} reverse={index % 2 === 1} />)}
        </div>
      </Container>
    </Section>
  )
}
