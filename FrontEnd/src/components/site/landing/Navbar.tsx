'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import Logo from './Logo'
import { navLinks } from '@/content/landing'

// Mặc định là menu cuộn tới các mục của landing; các trang app truyền `appLinks` để chuyển trang
type AppLink = { path: string; label: string }

export default function Navbar({ appLinks }: { appLinks?: AppLink[] }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const close = () => setOpen(false)

  // Kéo xuống thì thanh menu chuyển sang dạng thẻ vàng bo góc
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Đóng menu khi bấm ra ngoài hoặc nhấn Esc
  useEffect(() => {
    if (!open) return
    const onClick = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) close() }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    document.addEventListener('pointerdown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <header className={`navbar ${appLinks ? 'navbar-plain' : ''} ${scrolled ? 'scrolled' : ''}`}>
      <div className="container navbar-inner">
        <Logo />
        <div className="nav-wrap" ref={menuRef}>
          <button className="menu-toggle" aria-expanded={open} aria-controls="main-nav" aria-label={open ? 'Đóng menu' : 'Mở menu'} onClick={() => setOpen(!open)}>
            {open ? <X /> : <Menu />}
          </button>
          <nav id="main-nav" className={`nav ${open ? 'open' : ''}`} aria-label="Điều hướng chính">
            <ul className="nav-links">
              {appLinks
                ? appLinks.map((link) => <li key={link.path}><Link href={link.path} className={pathname === link.path ? 'active' : undefined} aria-current={pathname === link.path ? 'page' : undefined} onClick={close}>{link.label}</Link></li>)
                : navLinks.map((link) => <li key={link.id}><a href={`#${link.id}`} onClick={close}>{link.label}</a></li>)}
            </ul>
            <div className="nav-auth">
              <Link className="sign-up" href="/dang-ky" onClick={close}>Sign up</Link>
              <Link className="button button-primary sign-in" href="/dang-nhap" onClick={close}>Sign in</Link>
            </div>
          </nav>
        </div>
      </div>
    </header>
  )
}
