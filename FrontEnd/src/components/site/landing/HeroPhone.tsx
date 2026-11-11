'use client'

import { useEffect, useRef } from 'react'
import { Menu, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'

const phoneFrame = '/site/hero/phone.webp'
const logoMark = '/site/logo-mark.webp'

const ring = 'absolute rounded-full animate-sos-pulse motion-reduce:animate-none motion-reduce:opacity-50'

// Điện thoại với màn hình SOS "sống": nút SOS có sóng lan giống nút ở phần Tính năng.
// Khối bên trong có kích thước cố định 866x1454 (hệ toạ độ của ảnh khung); script chỉ đặt hệ số
// thu phóng --s theo bề rộng thực tế của khung ngoài, nên màn hình luôn khít với khung điện thoại.
// className: vị trí/kích thước khung ngoài (hero đặt nghiêng tuyệt đối, CTA dựng thẳng); khung ngoài phải được định vị.
export default function HeroPhone({ alt, className }: { alt: string; className?: string }) {
  const outer = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = outer.current
    if (!el) return
    const update = () => {
      el.style.setProperty('--s', String(el.clientWidth / 866))
      el.dataset.ready = 'true'
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div className={cn('group', className)} ref={outer} role="img" aria-label={alt}>
      <div
        className="absolute top-0 left-0 h-[1454px] w-[866px] origin-top-left scale-(--s,.8) opacity-0 transition-opacity duration-300 group-data-[ready=true]:opacity-100 motion-reduce:transition-none"
        aria-hidden="true"
      >
        {/* Màn hình SOS (390x844) ghép phối cảnh vào ô màn hình của khung điện thoại */}
        <div className="absolute top-0 left-0 flex h-[844px] w-[390px] origin-top-left transform-[matrix3d(1.4104664,0.13170189,0,0.00010929786,0.28793851,1.5652971,0,-0.000058255877,0,0,1,0,57.742839,17.111516,0,1)] flex-col items-center overflow-hidden bg-white pt-10 text-center font-sans text-ink">
          <div className="flex h-14 w-full shrink-0 items-center justify-between border-b border-line px-4">
            <span className="inline-flex items-center gap-2 font-[Arial,sans-serif] text-[19px] leading-none font-black tracking-[-.02em]">
              <img src={logoMark} alt="" width="46" height="62" className="h-8 w-auto" />
              <span>SOS NOW</span>
            </span>
            <span className="grid size-10 place-items-center rounded-full bg-brand text-white shadow-[0_6px_14px_rgba(218,54,26,.35)] [&_svg]:size-5"><Menu /></span>
          </div>
          <p className="mx-4 mt-10 text-[28px] leading-[1.15] font-black tracking-[-.01em]">Bạn đang gặp nguy hiểm?</p>
          <p className="mx-5.5 mt-3 text-base leading-[1.55] text-gray">Nhấn nút bên dưới để gọi 115 và xem cơ sở y tế gần bạn nhất. Hãy bình tĩnh, trợ giúp sẽ sớm đến với bạn.</p>
          <div className="relative mt-8.5 mb-5.5 grid size-[335px] shrink-0 place-items-center">
            {/* Nút SOS + 2 vòng sóng lan giống nút ở phần Tính năng (cùng keyframes, cùng tỉ lệ vòng/nút) */}
            <span className={cn(ring, 'size-[316px] bg-[rgba(234,84,85,.1)]')} />
            <span className={cn(ring, 'size-[252px] bg-[rgba(234,84,85,.14)] [animation-delay:.6s]')} />
            <span className="relative grid size-[208px] place-items-center rounded-full bg-[linear-gradient(160deg,#e5484d,#f07b7b)] text-[58px] leading-none font-black tracking-[.04em] text-white shadow-[0_18px_40px_rgba(229,72,77,.45),inset_0_-6px_0_rgba(0,0,0,.08)]">
              SOS
            </span>
          </div>
          <p className="inline-flex items-center gap-2 text-lg font-bold text-brand [&_svg]:size-5"><Phone /> Gọi 115 ngay</p>
          <p className="mt-2 text-[13px] leading-normal text-gray">Cuộc gọi đến 115 hoàn toàn miễn phí.</p>
        </div>
        <img className="pointer-events-none absolute inset-0 block h-[1454px] w-[866px] max-w-none" src={phoneFrame} alt="" width="866" height="1454" />
      </div>
    </div>
  )
}
