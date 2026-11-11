import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/site/primitives'
import { appStart } from '@/content/app'
import { hero } from '@/content/landing'

// Hình động SVG nhúng bằng <img> để CSS bên trong không ảnh hưởng tới trang
const heroAnimation = '/site/hero-animation.svg'

export default function Hero() {
  const [line1, line2, line3] = hero.title
  return (
    <section id="hero" className="flex min-h-[min(calc(100svh-68px),640px)] items-center pt-6 pb-12 max-lg:min-h-0 max-lg:pt-4 max-lg:pb-10" aria-labelledby="hero-title">
      <Container className="grid grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)] items-end gap-6 max-lg:grid-cols-1">
        <div className="pb-[clamp(0px,3vw,32px)] pl-[clamp(0px,3vw,40px)] max-lg:p-0">
          <h1 id="hero-title" className="mb-4.5 flex flex-col text-[clamp(32px,3.9vw,54px)] leading-[1.12] font-black tracking-[-.01em] whitespace-nowrap uppercase max-lg:text-[min(9.4vw,48px)]">
            <span className="text-text">{line1}</span>
            <span className="text-shadow-[3px_4px_6px_rgba(0,0,0,.22)]">
              <span className="text-brand-yellow">{line2}</span> <span className="text-brand">{line3}</span>
            </span>
          </h1>
          <p className="mb-8 max-w-125 text-[clamp(17px,1.6vw,21px)] leading-[1.1] text-text text-shadow-[0_2px_3px_rgba(0,0,0,.18)]">{hero.description}</p>
          <div className="flex items-center gap-4 max-xs:gap-3">
            <Button asChild className="h-13 min-w-58 rounded-full px-6 text-lg font-normal max-xs:h-12 max-xs:min-w-0 max-xs:flex-1 max-xs:text-[17px]">
              <Link href={appStart}>{hero.cta}</Link>
            </Button>
            <a className="grid size-14 flex-none place-items-center rounded-full bg-brand text-white transition-colors hover:bg-brand-dark max-xs:size-12 [&_svg]:size-5.5 [&_svg]:stroke-[1.5]" href="#van-de" aria-label="Xem phần tiếp theo">
              <ChevronRight />
            </a>
          </div>
        </div>
        <img className="w-[min(100%,660px)] justify-self-end max-lg:w-[min(100%,560px)] max-lg:justify-self-center" src={heroAnimation} alt={hero.imageAlt} width="680" height="540" />
      </Container>
    </section>
  )
}
