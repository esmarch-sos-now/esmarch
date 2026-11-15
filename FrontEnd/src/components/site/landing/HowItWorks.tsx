'use client'

import { FramePill, reveal } from '@/components/site/primitives'
import useInView from '@/hooks/useInView'
import { howItWorks } from '@/content/landing'
import { cn } from '@/lib/utils'
import { inter } from './inter'

// Màu từng nút minh họa trong ô "Ấn nút SOS" (SOS đỏ, Gọi 115 xám, Chia sẻ vị trí xanh), lệch nhau như mẫu
const chips = [
  'bg-[#d8341f] text-white',
  'ml-[calc(120*var(--u))] bg-[#a3a3a3] text-[#f4f4f4] max-lp:ml-14',
  'bg-[#22b33a] text-white',
]

const cellTitle = 'text-[calc(25*var(--u))] leading-[1.2] font-bold tracking-[-.01em] max-lp:text-[21px]'
const cellText = 'mt-[calc(14*var(--u))] max-w-[calc(330*var(--u))] text-[calc(17.5*var(--u))] leading-[1.6] text-white/72 max-lp:mt-2 max-lp:max-w-none max-lp:text-[15px]'

// "Quy trình cơ bản" theo mẫu: một ô trên (Ấn nút SOS) và hai ô dưới (Gọi hỗ trợ | Dẫn đường), chia bằng đường kẻ.
export default function HowItWorks({ id }: { id: string }) {
  const { label, title, sos, call, navigate } = howItWorks
  const [ref, inView] = useInView<HTMLDivElement>()
  return (
    <section id={id} className={cn(inter.className, 'bg-[#111] text-white')} aria-labelledby={`${id}-title`}>
      <div className="mx-auto w-[calc(1440*var(--u))] px-[calc(47*var(--u))] pt-[calc(60*var(--u))] pb-[calc(120*var(--u))] max-lp:w-auto max-lp:px-5 max-lp:pt-12 max-lp:pb-16">
        <FramePill>{label}</FramePill>
        <h2 id={`${id}-title`} className="mt-[calc(8*var(--u))] text-center text-[calc(50*var(--u))] leading-[1.1] font-bold tracking-[-.02em] max-lp:mt-5 max-lp:text-left max-lp:text-[clamp(28px,8vw,44px)]">
          {title}
        </h2>

        <div ref={ref} className={cn('mx-auto mt-[calc(80*var(--u))] grid w-[calc(910*var(--u))] grid-cols-2 max-lp:mt-8 max-lp:w-full max-lp:grid-cols-1', reveal(inView))}>
          {/* Ấn nút SOS */}
          <div className="col-span-2 flex items-start justify-between border-b-[max(1.5px,calc(2*var(--u)))] border-[#5a5a5a] pr-[calc(150*var(--u))] pb-[calc(44*var(--u))] pl-[calc(8*var(--u))] max-lp:col-span-1 max-lp:flex-col max-lp:gap-6 max-lp:px-0 max-lp:pb-8">
            <div>
              <h3 className={cellTitle}>{sos.title}</h3>
              <p className={cellText}>{sos.description}</p>
            </div>
            <ul className="flex flex-col items-start gap-[calc(14*var(--u))] max-lp:gap-2.5" aria-label="Các thao tác sau khi ấn SOS">
              {sos.chips.map((chip, index) => (
                <li key={chip} className={cn('inline-flex h-[calc(38*var(--u))] min-w-[calc(124*var(--u))] items-center justify-center rounded-full px-[calc(18*var(--u))] text-[calc(16*var(--u))] leading-none shadow-[inset_0_1px_0_rgba(255,255,255,.3)] max-lp:h-9 max-lp:min-w-28 max-lp:text-sm', chips[index])}>
                  {chip}
                </li>
              ))}
            </ul>
          </div>

          {/* Gọi hỗ trợ: số bệnh viện, cơ sở y tế đã xác minh */}
          <div className="border-r-[max(1.5px,calc(2*var(--u)))] border-[#5a5a5a] pt-[calc(44*var(--u))] pr-[calc(22*var(--u))] pb-[calc(10*var(--u))] pl-[calc(10*var(--u))] max-lp:border-r-0 max-lp:border-b-[1.5px] max-lp:px-0 max-lp:py-8">
            <h3 className={cellTitle}>{call.title}</h3>
            <p className={cn(cellText, 'mt-[calc(4*var(--u))]')}>{call.description}</p>
            <dl className="mt-[calc(28*var(--u))] flex gap-[calc(34*var(--u))] max-lp:mt-5 max-lp:gap-3">
              {call.stats.map((stat) => (
                <div key={stat.label} className="flex h-[calc(126*var(--u))] w-[calc(186*var(--u))] flex-col bg-[#3a3a3a] px-[calc(12*var(--u))] pt-[calc(10*var(--u))] pb-[calc(8*var(--u))] max-lp:h-auto max-lp:w-40 max-lp:p-3">
                  <dt className="order-1 text-[calc(15*var(--u))] leading-none text-white/75 max-lp:text-sm">{stat.label}</dt>
                  <dd className="order-2 mt-[calc(4*var(--u))] text-center text-[calc(52*var(--u))] leading-none font-extrabold max-lp:my-2 max-lp:text-[44px]">{stat.value}</dd>
                  <dd className="order-3 mt-auto flex items-center gap-[calc(5*var(--u))] text-[calc(11*var(--u))] leading-none text-white/60 max-lp:gap-1.5 max-lp:text-[11px]">
                    <span className="size-[calc(8*var(--u))] rounded-full bg-[#2fc44f] max-lp:size-2" aria-hidden="true" />
                    {call.verified}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Dẫn đường */}
          <div className="pt-[calc(44*var(--u))] pl-[calc(40*var(--u))] max-lp:px-0 max-lp:pt-8">
            <h3 className={cellTitle}>{navigate.title}</h3>
            <p className={cellText}>{navigate.description}</p>
            <div className="mt-[calc(40*var(--u))] flex gap-[calc(34*var(--u))] max-lp:mt-5 max-lp:gap-3" aria-hidden="true">
              {navigate.actions.map((action, index) => (
                <span
                  key={action}
                  className={cn(
                    'inline-flex h-[calc(52*var(--u))] w-[calc(184*var(--u))] items-center justify-center text-[calc(18*var(--u))] leading-none max-lp:h-11 max-lp:w-36 max-lp:text-[15px]',
                    index === 0 ? 'bg-[#3a3a3a] text-white/55' : 'bg-[#c9c9c9] text-[#2a2a2a]',
                  )}
                >
                  {action}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
