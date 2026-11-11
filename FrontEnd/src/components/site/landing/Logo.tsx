import Link from 'next/link'

const logoMark = '/site/logo-mark.webp'

export default function Logo() {
  return (
    <Link className="inline-flex items-center gap-2 text-ink no-underline" href="/" aria-label="SOSNOW - Trang chủ">
      <img src={logoMark} alt="" width="46" height="62" className="h-8.5 w-auto max-lg:h-7.5" />
      <span className="-translate-y-px font-[Arial,var(--font-geist)] text-xl leading-none font-black tracking-[-.02em] max-lg:text-lg max-xs:text-[17px]">SOS NOW</span>
    </Link>
  )
}
