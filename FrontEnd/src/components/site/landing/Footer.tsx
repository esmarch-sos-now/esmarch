import Link from 'next/link'
import { Container } from '@/components/site/primitives'
import { footer } from '@/content/landing'
import Logo from './Logo'

export default function Footer() {
  const { developer, contactLabel, contact, columns } = footer
  const linkClass = 'text-sm text-[#333] no-underline hover:text-brand'
  return (
    <footer className="pt-8 pb-5 text-ink">
      <Container className="grid grid-cols-[1fr_minmax(0,480px)] gap-8 max-[899px]:grid-cols-1 max-[899px]:gap-6">
        <div className="[&_p]:mt-2.5 [&_p]:text-sm">
          <Logo />
          <p>Được phát triển: <strong>{developer}</strong></p>
          <p>{contactLabel} <span className="text-muted-foreground">{contact}</span></p>
        </div>
        <nav className="grid grid-cols-3 gap-5 max-xs:grid-cols-2" aria-label="Liên kết cuối trang">
          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="mt-1 mb-3.5 text-base font-bold">{column.title}</h3>
              <ul className="grid gap-2.5">
                {/* Link tới mục trên landing (#) dùng thẻ a để trình duyệt tự cuộn tới mục */}
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.to.includes('#') ? <a className={linkClass} href={link.to}>{link.label}</a> : <Link className={linkClass} href={link.to}>{link.label}</Link>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </Container>
      <Container className="mt-6 flex flex-wrap justify-between gap-2.5 border-t border-line pt-4 text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} SOS NOW · {developer}</span>
        <span>Trong nguy hiểm tính mạng, hãy gọi <a className="underline" href="tel:115">115</a>.</span>
      </Container>
    </footer>
  )
}
