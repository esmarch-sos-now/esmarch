import Link from 'next/link'
import HeroNav from './HeroNav'
import HeroPhone from './HeroPhone'
import { inter } from './inter'
import { SelectionFrame } from '@/components/site/primitives'
import { appStart } from '@/content/app'
import { hero } from '@/content/landing'
import { cn } from '@/lib/utils'

// Quầng sáng lấy từ file thiết kế (/public/site/hero); điện thoại + màn hình SOS nằm trong HeroPhone.
const glowImage = '/site/hero/glow.webp'

// Hero theo mẫu thiết kế khung 1440x810 (nền đen, điện thoại nghiêng, quầng sáng cam).
// Desktop: mọi kích thước tính theo --u = 1px của khung thiết kế; dưới breakpoint `lp` thì xếp dọc với cỡ chữ cố định.
export default function Hero() {
  return (
    <section
      id="hero"
      aria-labelledby="hero-title"
      className={cn(
        inter.className,
        'relative overflow-clip bg-black pb-[calc(220*var(--u))] text-white max-lp:pb-35',
        '[&_:is(a,button):focus-visible]:outline-2 [&_:is(a,button):focus-visible]:outline-offset-3 [&_:is(a,button):focus-visible]:outline-[#55c182]',
        // Dải đen loang xuống: độ đục giảm dần về 0 trên nền #f8f8f8 của phần Vấn đề bên dưới (không có đường nối)
        "after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-[calc(220*var(--u))] after:bg-[#f8f8f8] after:bg-[linear-gradient(to_bottom,#000_0%,rgba(0,0,0,.95)_10%,rgba(0,0,0,.82)_24%,rgba(0,0,0,.64)_40%,rgba(0,0,0,.44)_56%,rgba(0,0,0,.26)_71%,rgba(0,0,0,.11)_85%,rgba(0,0,0,.03)_94%,rgba(0,0,0,0)_100%)] after:content-[''] max-lp:after:h-35",
      )}
    >
      {/* Thanh menu cố định nằm ngoài khung hero (khung có isolation riêng) để luôn nổi trên các phần bên dưới khi cuộn */}
      <HeroNav />
      {/* Cắt phần thừa của ảnh nền/điện thoại ở mép dưới khung; vẫn cho trải rộng hai bên (quầng sáng, vệt mờ) */}
      <div className="relative isolate mx-auto h-[calc(810*var(--u))] w-[calc(1440*var(--u))] bg-black [clip-path:inset(0_-100vw)] max-lp:flex max-lp:h-auto max-lp:min-h-svh max-lp:w-auto max-lp:flex-col max-lp:overflow-clip max-lp:px-4 max-lp:pt-18">
        <img
          className="pointer-events-none absolute top-[calc(-7.3*var(--u))] left-[calc(519.3*var(--u))] -z-2 h-[calc(1448.25*var(--u))] w-[calc(1448.25*var(--u))] max-lp:top-auto max-lp:-bottom-[60vw] max-lp:-left-[10vw] max-lp:size-[140vw]"
          src={glowImage}
          alt=""
          aria-hidden="true"
        />
        <HeroPhone
          alt={hero.phoneAlt}
          className={cn(
            'absolute top-[calc(147.3*var(--u))] left-[calc(945*var(--u))] -z-1 h-[calc(1454*var(--u))] w-[calc(866*var(--u))] max-w-none origin-top-left transform-[matrix(.47919,.023984,-.024003,.47963,0,0)]',
            'max-lp:relative max-lp:top-auto max-lp:left-auto max-lp:order-4 max-lp:-mb-[18%] max-lp:mt-10 max-lp:aspect-[866/1454] max-lp:h-auto max-lp:w-[min(64vw,340px)] max-lp:self-center max-lp:transform-[matrix(.999,.05,-.05,.999,0,0)]',
          )}
        />
        {/* Đáy hero tối dần về đen thuần, nằm trên điện thoại + quầng sáng nhưng dưới thẻ nổi và chữ */}
        <div
          className="pointer-events-none absolute -inset-x-[100vw] bottom-0 z-1 h-[calc(150*var(--u))] bg-[linear-gradient(to_bottom,rgba(0,0,0,0)_0%,rgba(0,0,0,.12)_25%,rgba(0,0,0,.45)_55%,rgba(0,0,0,.85)_80%,#000_100%)] max-lp:h-37.5"
          aria-hidden="true"
        />

        {/* Hai thẻ nổi cạnh điện thoại (mobile: xếp thành một hàng phía trên điện thoại) */}
        <div className="contents max-lp:order-3 max-lp:mt-6.5 max-lp:flex max-lp:gap-2.5">
          {hero.tags.map((tag, index) => (
            <span
              key={tag}
              className={cn(
                'absolute z-2 flex h-[calc(46*var(--u))] w-[calc(196*var(--u))] items-center justify-center rounded-full bg-[linear-gradient(90deg,#bdeaf6_0%,#7db3e8_45%,#3357c4_100%)] text-[calc(20*var(--u))] leading-none font-medium shadow-[inset_0_1px_0_rgba(255,255,255,.55),0_10px_28px_rgba(20,40,120,.35)]',
                'max-lp:static max-lp:h-9.5 max-lp:w-auto max-lp:px-5 max-lp:text-sm',
                index === 0 ? 'top-[calc(428*var(--u))] left-[calc(1300*var(--u))]' : 'top-[calc(684*var(--u))] left-[calc(727*var(--u))]',
              )}
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Chữ bên trái (vị trí theo đường chân chữ trong mẫu) */}
        <div className="pointer-events-none absolute inset-0 z-2 *:pointer-events-auto max-lp:relative max-lp:inset-auto max-lp:order-2 max-lp:flex max-lp:flex-col max-lp:items-start max-lp:px-1 max-lp:pt-14">
          <h1 id="hero-title" className="font-normal max-lp:flex max-lp:flex-col max-lp:items-start max-lp:gap-4.5">
            <span className="absolute top-[calc(176*var(--u))] left-[calc(122*var(--u))] text-[calc(29.6*var(--u))] leading-none whitespace-nowrap max-lp:relative max-lp:inset-auto max-lp:text-[22px]">
              {hero.eyebrow}
            </span>
            {/* Khung chọn màu xanh quanh chữ là chi tiết trang trí của mẫu */}
            <SelectionFrame className="absolute top-[calc(228*var(--u))] left-[calc(122*var(--u))] h-[calc(100*var(--u))] w-[calc(600*var(--u))] max-lp:relative max-lp:inset-auto max-lp:inline-flex max-lp:h-auto max-lp:w-auto max-lp:px-4.5 max-lp:pt-2 max-lp:pb-1.5">
              {/* padding-right: hiệu chỉnh quang học để nét chữ nằm đúng tâm khung xanh */}
              <span className="relative bg-[linear-gradient(90deg,#c8321c,#b2441f)] bg-clip-text pr-[.06em] text-[calc(104.7*var(--u))] leading-none font-bold tracking-[-.025em] whitespace-nowrap text-transparent max-lp:text-[clamp(52px,15vw,84px)]">
                {hero.title}
              </span>
            </SelectionFrame>
          </h1>
          {/* Inter rộng hơn font của mẫu: nới khung + khít chữ để vẫn 2 dòng như mẫu */}
          <p className="absolute top-[calc(348*var(--u))] left-[calc(122*var(--u))] w-[calc(600*var(--u))] text-[calc(21.5*var(--u))] leading-[calc(29.5*var(--u))] tracking-[-.01em] max-lp:relative max-lp:inset-auto max-lp:mt-5.5 max-lp:w-auto max-lp:max-w-130 max-lp:text-base max-lp:leading-[1.45]">
            {hero.description}
          </p>
          <div className="glass absolute top-[calc(428*var(--u))] left-[calc(122*var(--u))] flex h-[calc(58*var(--u))] w-[calc(600*var(--u))] items-center rounded-full pr-[calc(6*var(--u))] pl-[calc(22.5*var(--u))] max-lp:relative max-lp:inset-auto max-lp:mt-6.5 max-lp:h-13.5 max-lp:w-full max-lp:max-w-110 max-lp:pr-1.25 max-lp:pl-5">
            <span className="flex-1 truncate text-[calc(21.9*var(--u))] max-lp:text-[15px]">{hero.prompt}</span>
            <Link
              href={appStart}
              className="inline-flex h-[calc(46*var(--u))] shrink-0 items-center rounded-full bg-white px-[calc(26*var(--u))] text-[calc(20.2*var(--u))] leading-none text-[#111] no-underline transition-shadow duration-200 hover:shadow-[0_8px_28px_rgba(255,255,255,.22)] max-lp:h-11 max-lp:px-5 max-lp:text-[15px]"
            >
              {hero.cta}
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
