import Link from 'next/link'
import HeroNav from './HeroNav'
import { inter } from './inter'
import { appStart } from '@/content/app'
import { hero } from '@/content/landing'
import { cn } from '@/lib/utils'

// Ảnh hai bàn tay nắm lấy nhau (ảnh gốc dọc, đã xoay ngang cho khung hero)
const handsImage = '/site/hero/hands.webp'

// Hero theo mẫu nền tối: thanh menu đặc ở trên, ảnh bàn tay phủ kín khung, chữ bên trái trên lớp tối dần.
// Desktop: kích thước theo --u (1px của khung 1440); dưới breakpoint `lp` thì cỡ chữ cố định.
export default function Hero() {
  return (
    <section
      id="hero"
      aria-labelledby="hero-title"
      className={cn(
        inter.className,
        'relative overflow-clip bg-[#111] pt-[calc(76*var(--u))] text-white max-lp:pt-16',
        '[&_:is(a,button):focus-visible]:outline-2 [&_:is(a,button):focus-visible]:outline-offset-3 [&_:is(a,button):focus-visible]:outline-white',
      )}
    >
      <HeroNav />
      <div className="relative isolate h-[calc(730*var(--u))] max-lp:h-auto max-lp:min-h-[min(640px,88svh)]">
        <img src={handsImage} alt={hero.imageAlt} className="absolute inset-0 -z-2 size-full object-cover object-[60%_45%] max-lp:object-[62%_50%]" />
        {/* Tối dần sang trái để chữ trắng đọc rõ; đáy tối dần về nền #111 của phần dưới */}
        <div
          className="pointer-events-none absolute inset-0 -z-1 bg-[linear-gradient(90deg,rgba(17,17,17,.82)_0%,rgba(17,17,17,.55)_32%,rgba(17,17,17,.1)_58%,rgba(17,17,17,0)_75%),linear-gradient(to_bottom,rgba(17,17,17,0)_80%,#111_100%)] max-lp:bg-[linear-gradient(to_bottom,rgba(17,17,17,.55)_0%,rgba(17,17,17,.75)_55%,#111_100%)]"
          aria-hidden="true"
        />
        <div className="mx-auto flex h-full w-[calc(1440*var(--u))] flex-col justify-center px-[calc(92*var(--u))] pb-[calc(150*var(--u))] max-lp:min-h-[inherit] max-lp:w-auto max-lp:justify-end max-lp:px-5 max-lp:pt-24 max-lp:pb-14">
          <h1 id="hero-title" className="flex flex-col font-normal">
            <span className="text-[calc(22*var(--u))] leading-none max-lp:text-lg">{hero.eyebrow}</span>
            <span className="mt-[calc(14*var(--u))] text-[calc(84*var(--u))] leading-none font-extrabold tracking-[-.02em] whitespace-nowrap text-[#e01e1e] max-lp:mt-3 max-lp:text-[clamp(52px,15vw,76px)]">
              {hero.title}
            </span>
          </h1>
          <p className="mt-[calc(12*var(--u))] max-w-[calc(600*var(--u))] text-[calc(20*var(--u))] leading-[1.5] text-white/90 max-lp:mt-4 max-lp:max-w-130 max-lp:text-base">
            {hero.description}
          </p>
          <div className="glass relative mt-[calc(26*var(--u))] flex h-[calc(50*var(--u))] w-[calc(530*var(--u))] items-center rounded-full pr-[calc(5*var(--u))] pl-[calc(24*var(--u))] max-lp:mt-6 max-lp:h-13 max-lp:w-full max-lp:max-w-110 max-lp:pr-1.25 max-lp:pl-5">
            <a href="#van-de" className="flex-1 truncate text-[calc(18*var(--u))] text-white/80 no-underline hover:text-white max-lp:text-[15px]">
              {hero.prompt}
            </a>
            <Link
              href={appStart}
              className="inline-flex h-[calc(40*var(--u))] shrink-0 items-center rounded-full bg-white px-[calc(26*var(--u))] text-[calc(17*var(--u))] leading-none font-medium text-[#111] no-underline transition-shadow duration-200 hover:shadow-[0_8px_28px_rgba(255,255,255,.22)] max-lp:h-10.5 max-lp:px-5 max-lp:text-[15px]"
            >
              {hero.cta}
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
