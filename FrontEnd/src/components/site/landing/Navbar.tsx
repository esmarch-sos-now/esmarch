'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, UserRound, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSession } from '@/hooks/use-auth'
import { authCopy } from '@/content/auth'
import { navLinks } from '@/content/landing'
import { ACCOUNT_PATH, LOGIN_PATH } from '@/lib/auth/paths'
import { cn } from '@/lib/utils'
import Logo from './Logo'

// Mặc định là menu cuộn tới các mục của landing; các trang app truyền `appLinks` để chuyển trang
type AppLink = { path: string; label: string }

export default function Navbar({ appLinks }: { appLinks?: AppLink[] }) {
  const pathname = usePathname()
  const { user, status } = useSession()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const close = () => setOpen(false)
  const plain = Boolean(appLinks)

  // Kéo xuống thì thanh menu chuyển sang dạng thẻ bo góc
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

  // Landing: link trắng khi hover trên dải vàng; app và menu thu gọn: link đỏ
  const linkHover = plain ? 'hover:text-brand' : 'lg:hover:text-white hover:text-brand'
  const links = appLinks
    ? appLinks.map((link) => ({ key: link.path, href: link.path, label: link.label, active: pathname === link.path }))
    : navLinks.map((link) => ({ key: link.id, href: `#${link.id}`, label: link.label, active: false }))

  return (
    <header className="sticky top-0 z-10 flex h-17 items-center max-lg:h-14">
      <div
        className={cn(
          'mx-auto flex h-17 w-full items-center transition-all duration-350 ease-in-out max-lg:h-14',
          'px-[max(16px,calc((100%-1280px)/2+16px))]',
          plain ? 'bg-paper shadow-[inset_0_-1px_0_var(--color-line)]' : 'bg-brand-yellow',
          scrolled && 'h-13 w-[calc(100%-32px)] max-w-312 rounded-2xl px-4 max-lg:h-12 max-lg:rounded-[14px] max-lg:pr-1.5 max-lg:pl-3',
          scrolled && (plain ? 'shadow-[0_10px_28px_rgba(0,0,0,.1),inset_0_0_0_1px_var(--color-line)]' : 'shadow-[0_10px_28px_rgba(0,0,0,.12)]'),
        )}
      >
        <Logo />
        <div className="relative flex flex-1 items-center max-lg:ml-auto max-lg:flex-none" ref={menuRef}>
          <button
            className={cn(
              'hidden size-10 cursor-pointer place-items-center rounded-full bg-brand text-white shadow-[0_6px_16px_rgba(218,54,26,.35)] transition hover:bg-brand-dark active:scale-94 max-lg:grid [&_svg]:size-5',
              scrolled && 'max-lg:size-9',
            )}
            aria-expanded={open}
            aria-controls="main-nav"
            aria-label={open ? 'Đóng menu' : 'Mở menu'}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
          <nav
            id="main-nav"
            aria-label="Điều hướng chính"
            className={cn(
              'flex flex-1 items-center',
              'max-lg:invisible max-lg:absolute max-lg:top-[calc(100%+12px)] max-lg:right-0 max-lg:w-[min(280px,calc(100vw-32px))] max-lg:origin-top-right max-lg:-translate-y-2 max-lg:scale-90 max-lg:flex-col max-lg:items-stretch max-lg:gap-3 max-lg:rounded-[20px] max-lg:bg-paper max-lg:p-3 max-lg:opacity-0 max-lg:shadow-[0_16px_40px_rgba(0,0,0,.14)] max-lg:transition-[opacity,scale,translate,visibility] max-lg:duration-180',
              open && 'max-lg:visible max-lg:translate-y-0 max-lg:scale-100 max-lg:opacity-100',
            )}
          >
            <ul className="mx-auto flex gap-[clamp(20px,3vw,44px)] max-lg:m-0 max-lg:flex-col max-lg:gap-0">
              {links.map((link) => {
                const className = cn(
                  'text-base text-[#333] no-underline max-lg:block max-lg:rounded-xl max-lg:px-3 max-lg:py-2.5 max-lg:text-lg max-lg:hover:bg-brand-soft',
                  linkHover,
                  link.active && 'font-bold text-ink underline decoration-2 underline-offset-6',
                )
                return (
                  <li key={link.key}>
                    {appLinks
                      ? <Link href={link.href} className={className} aria-current={link.active ? 'page' : undefined} onClick={close}>{link.label}</Link>
                      : <a href={link.href} className={className} onClick={close}>{link.label}</a>}
                  </li>
                )
              })}
            </ul>
            <div className={cn('flex items-center gap-3 max-lg:justify-between max-lg:border-t max-lg:border-line max-lg:px-3 max-lg:pt-3 max-lg:pb-1', status === 'loading' && 'invisible')}>
              {user ? (
                // Đã đăng nhập: chỉ hiện tên (kèm biểu tượng), không có nền nút; bấm vào để mở trang Tài khoản
                <Link
                  href={ACCOUNT_PATH}
                  onClick={close}
                  className={cn('inline-flex items-center gap-1.5 text-[17px] font-extrabold text-ink no-underline max-lg:text-lg [&_svg]:size-4.5', linkHover)}
                >
                  <UserRound aria-hidden="true" />{user.displayName ?? authCopy.nav.account}
                </Link>
              ) : (
                <>
                  <Link className={cn('text-[17px] font-extrabold text-ink no-underline max-lg:text-lg', linkHover)} href="/dang-ky" onClick={close}>Sign up</Link>
                  <Button asChild className="h-10 rounded-full px-6 text-base font-extrabold max-lg:h-11 max-lg:text-lg">
                    <Link href={LOGIN_PATH} onClick={close}>Sign in</Link>
                  </Button>
                </>
              )}
            </div>
          </nav>
        </div>
      </div>
    </header>
  )
}
