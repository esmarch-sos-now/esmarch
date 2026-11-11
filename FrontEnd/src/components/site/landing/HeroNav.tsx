'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import Logo from './Logo'
import { navLinks } from '@/content/landing'

// Thanh menu dạng viên thuốc kính mờ, cố định ở đầu màn hình khi cuộn trang
export default function HeroNav() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = () => setOpen(false)

  // Khi đã cuộn khỏi đầu trang: nền kính tối đặc hơn để chữ trắng vẫn đọc được trên các phần nền sáng
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Đóng menu (mobile) khi bấm ra ngoài hoặc nhấn Esc
  useEffect(() => {
    if (!open) return
    const onClick = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) close() }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    document.addEventListener('pointerdown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <header className={`lp-nav lp-glass ${scrolled ? 'is-scrolled' : ''}`} ref={ref}>
      <Logo />
      <nav id="lp-nav-menu" className={`lp-nav-menu ${open ? 'open' : ''}`} aria-label="Điều hướng chính">
        <ul className="lp-nav-links">
          {navLinks.map((link) => (
            <li key={link.id}><a href={`#${link.id}`} onClick={close}>{link.label}</a></li>
          ))}
        </ul>
        <div className="lp-nav-auth">
          <Link className="lp-nav-signup" href="/dang-ky" onClick={close}>Đăng ký</Link>
          <Link className="lp-nav-signin" href="/dang-nhap" onClick={close}>Đăng nhập</Link>
        </div>
      </nav>
      <button className="lp-nav-toggle" aria-expanded={open} aria-controls="lp-nav-menu"
        aria-label={open ? 'Đóng menu' : 'Mở menu'} onClick={() => setOpen(!open)}>
        {open ? <X /> : <Menu />}
      </button>
    </header>
  )
}
