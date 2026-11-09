import Link from 'next/link'

const logoMark = '/site/logo-mark.webp'

export default function Logo() {
  return (
    <Link className="logo" href="/" aria-label="SOSNOW - Trang chủ">
      <img src={logoMark} alt="" width="46" height="62" />
      <span>SOS NOW</span>
    </Link>
  )
}
