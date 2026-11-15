'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import Logo from './Logo'
import { navLinks } from '@/content/landing'
import { cn } from '@/lib/utils'

const navText = 'text-[calc(18*var(--u))] leading-none text-white no-underline transition-opacity duration-200 hover:opacity-75 max-lp:text-[15px]'

// Thanh menu đặc màu tối, trải hết chiều ngang và cố định ở đầu màn hình khi cuộn trang
export default function HeroNav() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLElement>(null)
  const close = () => setOpen(false)

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
    <header
      ref={ref}
      // Bấm link mục lục thì chừa chỗ cho thanh menu cố định
      className="fixed inset-x-0 top-0 z-50 border-b border-white/6 bg-[#16181a]/95 backdrop-blur-md [html:has(&)]:scroll-pt-20"
    >
      <div className="relative mx-auto flex h-[calc(76*var(--u))] w-[calc(1440*var(--u))] items-center px-[calc(132*var(--u))] max-lp:h-16 max-lp:w-auto max-lp:px-4">
      <Logo variant="glass" />
      <nav
        id="lp-nav-menu"
        aria-label="Điều hướng chính"
        className={cn(
          'contents',
          // Mobile: menu thả xuống. Nằm trong thanh kính nên backdrop-filter không nhìn xuyên ra ngoài được: dùng kính gần đặc
          'max-lp:absolute max-lp:top-[calc(100%+8px)] max-lp:right-4 max-lp:left-4 max-lp:flex-col max-lp:gap-2 max-lp:rounded-[22px] max-lp:border max-lp:border-white/16 max-lp:bg-[linear-gradient(135deg,rgba(40,40,44,.97),rgba(20,20,23,.97))] max-lp:p-2.5 max-lp:shadow-[inset_0_1px_0_rgba(255,255,255,.25),0_18px_40px_rgba(0,0,0,.5)]',
          open ? 'max-lp:flex' : 'max-lp:hidden',
        )}
      >
        <ul className="absolute left-1/2 flex -translate-x-1/2 max-lp:translate-x-0 gap-[calc(27*var(--u))] max-lp:static max-lp:flex-col max-lp:gap-0">
          {navLinks.map((link) => (
            <li key={link.id}>
              <a href={`#${link.id}`} onClick={close} className={cn(navText, 'max-lp:block max-lp:px-3.5 max-lp:py-3')}>{link.label}</a>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-[calc(13*var(--u))] max-lp:m-0 max-lp:justify-between max-lp:border-t max-lp:border-white/12 max-lp:px-1 max-lp:pt-2 max-lp:pb-0.5">
          <Link href="/dang-ky" onClick={close} className={cn(navText, 'max-lp:px-2.5 max-lp:py-2')}>Đăng ký</Link>
          <Link
            href="/dang-nhap"
            onClick={close}
            className="inline-flex h-[calc(42*var(--u))] items-center rounded-full bg-white px-[calc(22*var(--u))] text-[calc(18*var(--u))] leading-none font-semibold text-[#111] no-underline transition-shadow duration-200 hover:shadow-[0_6px_20px_rgba(255,255,255,.2)] max-lp:h-10.5 max-lp:px-4.5 max-lp:text-[15px]"
          >
            Đăng nhập
          </Link>
        </div>
      </nav>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="lp-nav-menu"
        aria-label={open ? 'Đóng menu' : 'Mở menu'}
        onClick={() => setOpen(!open)}
        className="hidden cursor-pointer place-items-center rounded-full bg-white text-black max-lp:ml-auto max-lp:grid max-lp:size-10.5 [&_svg]:size-5"
      >
        {open ? <X /> : <Menu />}
      </button>
      </div>
    </header>
  )
}
