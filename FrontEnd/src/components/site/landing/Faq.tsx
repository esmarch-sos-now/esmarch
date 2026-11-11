'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Container, Pill, Section, reveal } from '@/components/site/primitives'
import useInView from '@/hooks/useInView'
import { faq } from '@/content/landing'
import { cn } from '@/lib/utils'

// Câu hỏi thường gặp: giới thiệu bên trái, danh sách câu hỏi mở/đóng bên phải
export default function Faq({ id }: { id: string }) {
  const { label, title, subtitle, items } = faq
  const [open, setOpen] = useState(0)
  const [ref, inView] = useInView<HTMLDivElement>()
  return (
    <Section id={id} aria-labelledby={`${id}-title`}>
      <Container ref={ref} className={cn('grid grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] items-start gap-[clamp(32px,5vw,72px)] max-[899px]:grid-cols-1 max-[899px]:gap-7', reveal(inView))}>
        <div>
          <Pill>{label}</Pill>
          <h2 id={`${id}-title`} className="mt-2 text-[clamp(32px,3.6vw,46px)] leading-[1.15] font-black tracking-[-.01em] text-ink text-shadow-[3px_4px_6px_rgba(0,0,0,.2)] max-xs:text-[30px]">
            {title[0]} <span className="text-brand-yellow">{title[1]}</span>
          </h2>
          <p className="mt-2.5 text-base text-muted-foreground">{subtitle}</p>
        </div>

        <ul className="grid gap-3">
          {items.map((item, index) => {
            const isOpen = open === index
            return (
              <li
                key={item.q}
                className={cn('rounded-xl transition-[background,box-shadow] duration-200', isOpen ? 'bg-white shadow-[0_14px_32px_rgba(0,0,0,.08),inset_0_0_0_1px_var(--color-line)]' : 'bg-[#f1f1f1]')}
              >
                <h3>
                  <button
                    type="button"
                    id={`faq-q-${index}`}
                    aria-expanded={isOpen}
                    aria-controls={`faq-a-${index}`}
                    onClick={() => setOpen(isOpen ? -1 : index)}
                    className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4.5 text-left text-base leading-[1.4] font-bold text-ink max-xs:p-4 max-xs:text-[15px]"
                  >
                    <span>{item.q}</span>
                    <span
                      className={cn(
                        'grid size-8 flex-none place-items-center rounded-full transition-[rotate,background,color] duration-300 motion-reduce:transition-none [&_svg]:size-4.5',
                        isOpen ? 'rotate-45 bg-brand text-white' : 'bg-white text-brand',
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
                    <p className="px-5 pb-4.5 text-[15px] leading-[1.6] text-muted-foreground max-xs:px-4 max-xs:pb-4">{item.a}</p>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </Container>
    </Section>
  )
}
