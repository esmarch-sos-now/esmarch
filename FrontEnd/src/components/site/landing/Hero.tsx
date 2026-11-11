import Link from 'next/link'
import HeroNav from './HeroNav'
import HeroPhone from './HeroPhone'
import { inter } from './inter'
import { appStart } from '@/content/app'
import { hero } from '@/content/landing'

// Quầng sáng lấy từ file thiết kế (/public/site/hero); điện thoại + màn hình SOS nằm trong HeroPhone.
const glowImage = '/site/hero/glow.webp'

export default function Hero() {
  return (
    <section id="hero" className={`lp-hero ${inter.className}`} aria-labelledby="hero-title">
      {/* Thanh menu cố định nằm ngoài khung hero (khung có isolation riêng) để luôn nổi trên các phần bên dưới khi cuộn */}
      <HeroNav />
      <div className="lp-hero-stage">
        <img className="lp-hero-glow" src={glowImage} alt="" aria-hidden="true" />
        <HeroPhone alt={hero.phoneAlt} />
        {/* Vệt chuyển dần từ nền tối sang nền xám nhạt của phần Vấn đề bên dưới */}
        <div className="lp-hero-fade" aria-hidden="true" />

        {/* Hai thẻ nổi cạnh điện thoại (mobile: xếp thành một hàng phía trên điện thoại) */}
        <div className="lp-hero-tags">
          {hero.tags.map((tag, index) => (
            <span key={tag} className={`lp-hero-tag lp-hero-tag-${index + 1}`}>{tag}</span>
          ))}
        </div>

        <div className="lp-hero-copy">
          <h1 id="hero-title" className="lp-hero-title">
            <span className="lp-hero-eyebrow">{hero.eyebrow}</span>
            {/* Khung chọn màu xanh quanh chữ là chi tiết trang trí của mẫu */}
            <span className="lp-hero-brand">
              <span className="lp-hero-brand-text">{hero.title}</span>
              <i className="lp-handle lp-handle-tl" aria-hidden="true" />
              <i className="lp-handle lp-handle-tr" aria-hidden="true" />
              <i className="lp-handle lp-handle-bl" aria-hidden="true" />
              <i className="lp-handle lp-handle-br" aria-hidden="true" />
            </span>
          </h1>
          <p className="lp-hero-description">{hero.description}</p>
          <div className="lp-hero-action lp-glass">
            <span className="lp-hero-prompt">{hero.prompt}</span>
            <Link className="lp-hero-cta" href={appStart}>{hero.cta}</Link>
          </div>
        </div>
      </div>
    </section>
  )
}
