import Link from 'next/link'
import { cn } from '@/lib/utils'

const logoMark = '/site/logo-mark.webp'

// default: navbar của các trang app; glass: thanh menu kính mờ ở hero (chữ trắng, cỡ theo khung thiết kế --u)
const variants = {
  default: {
    link: 'gap-2 text-ink',
    img: 'h-8.5 max-lg:h-7.5',
    text: '-translate-y-px font-[Arial,var(--font-geist)] text-xl font-black tracking-[-.02em] max-lg:text-lg max-xs:text-[17px]'
  },
  glass: {
    link: 'gap-[calc(8*var(--u))] text-white max-lp:gap-2',
    img: 'h-[calc(40*var(--u))] max-lp:h-8',
    text: 'text-[calc(21*var(--u))] font-medium max-lp:text-[17px]'
  }
}

export default function Logo({ variant = 'default' }: { variant?: keyof typeof variants }) {
  const styles = variants[variant]
  return (
    <Link className={cn('inline-flex items-center no-underline', styles.link)} href="/" aria-label="SOSNOW - Trang chủ">
      <img src={logoMark} alt="" width="46" height="62" className={cn('w-auto', styles.img)} />
      <span className={cn('leading-none', styles.text)}>SOS NOW</span>
    </Link>
  )
}
