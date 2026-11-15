'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { FrameContainer, FramePill, Section, reveal } from '@/components/site/primitives'
import useInView from '@/hooks/useInView'
import { faq } from '@/content/landing'
import { cn } from '@/lib/utils'
import { inter } from './inter'

// Câu hỏi thường gặp: giới thiệu bên trái, danh sách câu hỏi mở/đóng bên phải
export default function Faq({ id }: { id: string }) {
  const { label, title, subtitle, items } = faq
  const [open, setOpen] = useState(0)
  const [ref, inView] = useInView<HTMLDivElement>()
  return (
    <Section id={id} className={inter.className} aria-labelledby={`${id}-title`}>
      <FrameContainer ref={ref} className={cn('grid grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] items-start gap-[clamp(32px,5vw,72px)] max-lp:grid-cols-1 max-lp:gap-7', reveal(inView))}>
        <div>
          <FramePill>{label}</FramePill>
          <h2 id={`${id}-title`} className="mt-5 text-[min(3.011vw,43.4px)] leading-[1.1] font-bold tracking-[-.025em] text-white max-lp:text-[clamp(28px,8vw,44px)] max-lp:leading-[1.12]">
            {title[0]} {title[1]}
          </h2>
          <p className="mt-2.5 text-[17px] leading-normal text-white/65 max-lp:text-[15px]">{subtitle}</p>
        </div>

        <ul className="grid gap-3">
          {items.map((item, index) => {
            const isOpen = open === index
            return (
              <li
                key={item.q}
                className={cn('rounded-[18px] border transition-[background,box-shadow,border-color] duration-200', isOpen ? 'border-white/12 bg-[#222] shadow-[0_14px_34px_rgba(0,0,0,.4)]' : 'border-transparent bg-[#1c1c1c]')}
              >
                <h3>
                  <button
                    type="button"
                    id={`faq-q-${index}`}
                    aria-expanded={isOpen}
                    aria-controls={`faq-a-${index}`}
                    onClick={() => setOpen(isOpen ? -1 : index)}
                    className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4.5 text-left text-base leading-[1.4] font-semibold text-white max-xs:p-4 max-xs:text-[15px]"
                  >
                    <span>{item.q}</span>
                    <span
                      className={cn(
                        'grid size-8 flex-none place-items-center rounded-full border transition-[rotate,background,color] duration-300 motion-reduce:transition-none [&_svg]:size-4.5',
                        isOpen ? 'rotate-45 border-white bg-white text-[#111]' : 'border-white/15 bg-white/5 text-white',
                      )}
                    >
                      <Plus aria-hidden="true" />
                    </span>
                  </button>
                </h3>
                {/* Mở/đóng mượt bằng grid-template-rows 0fr -> 1fr */}
                <div
                  id={`faq-a-${index}`}
                  role="region"
                  aria-labelledby={`faq-q-${index}`}
                  className={cn('grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none', isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-4.5 text-[15px] leading-[1.6] text-white/70 max-xs:px-4 max-xs:pb-4">{item.a}</p>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </FrameContainer>
    </Section>
  )
}
