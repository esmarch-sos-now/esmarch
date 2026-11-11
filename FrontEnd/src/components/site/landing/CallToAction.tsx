'use client'

import Link from 'next/link'
import { appStart } from '@/content/app'
import useInView from '@/hooks/useInView'
import { callToAction, hero } from '@/content/landing'
import HeroPhone from './HeroPhone'
import { inter } from './inter'

const googlePlay = '/site/badge-google-play.webp'
const appStore = '/site/badge-app-store.webp'

const badges: Record<string, string> = { 'google-play': googlePlay, 'app-store': appStore }

export default function CallToAction({ id }: { id: string }) {
  const { title, stores } = callToAction
  const [ref, inView] = useInView<HTMLDivElement>()
  return (
    <section id={id} className={`cta-band ${inter.className}`} aria-labelledby={`${id}-title`}>
      <div ref={ref} className={`lp-container cta-inner reveal ${inView ? 'in-view' : ''}`}>
        <div className="cta-copy">
          <h2 id={`${id}-title`} className="cta-title">{title}</h2>
          {/* App chưa phát hành nên cả hai nút tạm dẫn về trang Nút SOS của bản web */}
          <div className="cta-stores">
            {stores.map((store) => (
              <Link key={store.id} href={appStart} aria-label={store.label}>
                <img src={badges[store.id]} alt="" width="192" height="64" />
              </Link>
            ))}
          </div>
        </div>

        {/* Cùng ảnh điện thoại + màn hình SOS như ở hero; phần dưới bị cắt bởi đường kẻ cuối mục */}
        <div className="cta-phone">
          <HeroPhone alt={hero.phoneAlt} />
        </div>
      </div>
    </section>
  )
}
