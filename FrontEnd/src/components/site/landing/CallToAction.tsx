'use client'

import Link from 'next/link'
import { FrameContainer, reveal } from '@/components/site/primitives'
import { appStart } from '@/content/app'
import useInView from '@/hooks/useInView'
import { callToAction, hero } from '@/content/landing'
import { cn } from '@/lib/utils'
import HeroPhone from './HeroPhone'
import { inter } from './inter'

const googlePlay = '/site/badge-google-play.webp'
const appStore = '/site/badge-app-store.webp'

const badges: Record<string, string> = { 'google-play': googlePlay, 'app-store': appStore }

// Lời mời tải app bên trái, điện thoại minh họa màn SOS bên phải, cắt ngang bởi đường kẻ cuối mục
export default function CallToAction({ id }: { id: string }) {
  const { title, stores } = callToAction
  const [ref, inView] = useInView<HTMLDivElement>()
  return (
    <section id={id} className={cn(inter.className, 'mt-10 overflow-hidden border-b border-white/15')} aria-labelledby={`${id}-title`}>
      <FrameContainer
        ref={ref}
        className={cn('grid grid-cols-[minmax(0,1fr)_auto] items-center gap-8 pt-12 max-[899px]:grid-cols-1 max-[899px]:gap-2 max-[899px]:pt-10', reveal(inView))}
      >
        <div className="pb-12 max-[899px]:p-0 max-[899px]:text-center">
          <h2 id={`${id}-title`} className="max-w-140 text-[min(3.011vw,43.4px)] leading-[1.1] font-bold tracking-[-.025em] text-white max-[899px]:mx-auto max-[899px]:text-[clamp(26px,7vw,40px)]">
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

        {/* Cùng ảnh điện thoại + màn hình SOS như ở hero, dựng thẳng; phần dưới bị cắt bởi đường kẻ cuối mục */}
        <div className="relative mr-[clamp(0px,4vw,60px)] h-95 w-70 self-end overflow-hidden max-[899px]:mt-7 max-[899px]:mr-0 max-[899px]:h-80 max-[899px]:w-60 max-[899px]:justify-self-center">
          <HeroPhone alt={hero.phoneAlt} className="relative aspect-[866/1454] w-full" />
        </div>
      </FrameContainer>
    </section>
  )
}
