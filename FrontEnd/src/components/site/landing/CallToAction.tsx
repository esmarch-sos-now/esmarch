'use client'

import Link from 'next/link'
import { Container, reveal } from '@/components/site/primitives'
import { appStart } from '@/content/app'
import useInView from '@/hooks/useInView'
import { callToAction } from '@/content/landing'
import { cn } from '@/lib/utils'

const googlePlay = '/site/badge-google-play.webp'
const appStore = '/site/badge-app-store.webp'

const badges: Record<string, string> = { 'google-play': googlePlay, 'app-store': appStore }

// Lời mời tải app bên trái, điện thoại minh họa màn SOS bên phải, cắt ngang bởi đường kẻ cuối mục
export default function CallToAction({ id }: { id: string }) {
  const { title, stores, phone } = callToAction
  const [ref, inView] = useInView<HTMLDivElement>()
  return (
    <section id={id} className="mt-10 overflow-hidden border-b border-[#555]" aria-labelledby={`${id}-title`}>
      <Container
        ref={ref}
        className={cn('grid max-w-270 grid-cols-[minmax(0,1fr)_auto] items-center gap-8 pt-12 max-[899px]:grid-cols-1 max-[899px]:gap-2 max-[899px]:pt-10', reveal(inView))}
      >
        <div className="pb-12 pl-[clamp(0px,3vw,32px)] max-[899px]:p-0 max-[899px]:text-center">
          <h2 id={`${id}-title`} className="max-w-125 text-[clamp(24px,2.6vw,34px)] leading-[1.2] font-black tracking-[-.01em] text-ink text-shadow-[3px_4px_6px_rgba(0,0,0,.22)] max-[899px]:mx-auto max-xs:text-[22px]">
            {title}
          </h2>
          {/* App chưa phát hành nên cả hai nút tạm dẫn về trang Nút SOS của bản web */}
          <div className="mt-6.5 flex flex-wrap gap-3.5 max-[899px]:justify-center max-xs:gap-2.5">
            {stores.map((store) => (
              <Link key={store.id} href={appStart} aria-label={store.label} className="block rounded-lg transition-[translate,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(0,0,0,.15)]">
                <img src={badges[store.id]} alt="" width="192" height="64" className="block h-auto w-37.5 rounded-lg max-xs:w-33" />
              </Link>
            ))}
          </div>
        </div>

        {/* Điện thoại minh họa màn hình SOS, phần dưới bị cắt bởi đường kẻ cuối mục */}
        <div
          aria-hidden="true"
          className={cn(
            'relative mr-[clamp(0px,3vw,32px)] flex h-80 w-65 flex-col items-center self-end rounded-t-[42px] border-7 border-b-0 border-[#111] bg-white px-2 pt-16.5 text-center shadow-[0_0_0_3px_#cfcfcf]',
            'max-[899px]:mt-7 max-[899px]:mr-0 max-[899px]:h-67.5 max-[899px]:w-57.5 max-[899px]:justify-self-center max-[899px]:pt-14.5',
            // Nút bấm cạnh máy
            "before:absolute before:top-22 before:-left-3.25 before:h-22.5 before:w-1 before:rounded-xs before:bg-[#9a9a9a] before:shadow-[0_-40px_0_-1px_#9a9a9a] before:content-['']",
            "after:absolute after:top-37.5 after:-right-3.25 after:h-16 after:w-1 after:rounded-xs after:bg-[#9a9a9a] after:content-['']",
          )}
        >
          <span className="absolute top-2.75 left-1/2 h-5.25 w-18.5 -translate-x-1/2 rounded-full bg-[#111]" />
          <p className="text-base font-bold whitespace-nowrap max-[899px]:text-sm">{phone.question}</p>
          <p className="mt-1.5 max-w-47.5 text-[11px] leading-normal text-[#999]">{phone.hint}</p>
          <div className="relative mt-2.5 grid w-full flex-1 place-items-center">
            <span className="absolute size-40 animate-sos-pulse rounded-full bg-[rgba(234,84,85,.1)] motion-reduce:animate-none max-[899px]:size-34" />
            <span className="absolute size-32 animate-sos-pulse rounded-full bg-[rgba(234,84,85,.14)] [animation-delay:.6s] motion-reduce:animate-none max-[899px]:size-27" />
            <span className="relative grid size-28 place-items-center rounded-full bg-[linear-gradient(160deg,#e5484d,#f07b7b)] text-2xl font-extrabold tracking-[.04em] text-white shadow-[0_12px_30px_rgba(229,72,77,.4)] max-[899px]:size-23.5 max-[899px]:text-xl">
              SOS
            </span>
          </div>
        </div>
      </Container>
    </section>
  )
}
