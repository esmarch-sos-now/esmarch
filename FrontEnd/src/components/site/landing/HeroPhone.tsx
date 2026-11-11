'use client'

import { useEffect, useRef } from 'react'
import { Menu, Phone } from 'lucide-react'

const phoneFrame = '/site/hero/phone.webp'
const logoMark = '/site/logo-mark.webp'

// Điện thoại nghiêng với màn hình SOS "sống": nút SOS có sóng lan giống nút ở phần Tính năng.
// Khối bên trong có kích thước cố định 866x1454 (hệ toạ độ của ảnh khung); script chỉ đặt hệ số
// thu phóng --s theo bề rộng thực tế của khung ngoài, nên màn hình luôn khít với khung điện thoại.
export default function HeroPhone({ alt }: { alt: string }) {
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
    <div className="lp-hero-phone" ref={outer} role="img" aria-label={alt}>
      <div className="lp-hero-phone-inner" aria-hidden="true">
        <div className="lp-screen">
          <div className="lp-screen-bar">
            <span className="lp-screen-logo">
              <img src={logoMark} alt="" width="46" height="62" />
              <span>SOS NOW</span>
            </span>
            <span className="lp-screen-menu"><Menu /></span>
          </div>
          <p className="lp-screen-question">Bạn đang gặp nguy hiểm?</p>
          <p className="lp-screen-hint">Nhấn nút bên dưới để gọi 115 và xem cơ sở y tế gần bạn nhất. Hãy bình tĩnh, trợ giúp sẽ sớm đến với bạn.</p>
          <div className="lp-screen-stage">
            <span className="lp-screen-ring" />
            <span className="lp-screen-ring lp-screen-ring-2" />
            <span className="lp-screen-button">SOS</span>
          </div>
          <p className="lp-screen-cta"><Phone /> Gọi 115 ngay</p>
          <p className="lp-screen-note">Cuộc gọi đến 115 hoàn toàn miễn phí.</p>
        </div>
        <img className="lp-hero-phone-frame" src={phoneFrame} alt="" width="866" height="1454" />
      </div>
    </div>
  )
}
