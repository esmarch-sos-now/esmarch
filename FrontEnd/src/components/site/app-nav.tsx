'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { HandHeart, LogIn, Mic, ScanFace, Siren, UserRound, UsersRound, type LucideIcon } from 'lucide-react'
import Logo from '@/components/site/landing/Logo'
import { useSession } from '@/hooks/use-auth'
import { useSupporterProfile } from '@/hooks/use-supporter'
import { authCopy } from '@/content/auth'
import { appNav } from '@/content/app'
import { ACCOUNT_PATH, LOGIN_PATH } from '@/lib/auth/paths'
import { cn } from '@/lib/utils'

// Biểu tượng của từng trang trong thanh điều hướng dưới đáy (theo path trong appNav)
const icons: Record<string, LucideIcon> = {
  '/app/sos': Siren,
  '/app/tro-ly': Mic,
  '/app/luyen-tap': ScanFace,
  '/app/nguoi-ho-tro': UsersRound,
  '/app/san-sang-ho-tro': HandHeart,
}

// Ai cũng thấy trang người hỗ trợ: người đã được xác minh thấy "Chế độ hỗ trợ", người khác thấy lời mời đăng ký
const SUPPORTER_PATH = '/app/san-sang-ho-tro'
const BECOME_SUPPORTER = 'Đăng ký làm người hỗ trợ'

type Item = { href: string; label: string; Icon: LucideIcon; active: boolean; sos?: boolean }

function NavItem({ item, className }: { item: Item; className?: string }) {
  const { href, label, Icon, active, sos } = item
  return (
    <li className={cn('group/item relative flex-1', className)}>
      <Link
        href={href}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'mx-auto grid size-12 place-items-center rounded-2xl no-underline transition-[background,color,scale] duration-200 active:scale-92 max-xs:size-11 [&_svg]:size-6 max-xs:[&_svg]:size-5.5',
          'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow',
          active
            ? sos ? 'bg-brand text-white shadow-[0_6px_16px_rgba(218,54,26,.35)]' : 'bg-ink text-white'
            : sos ? 'text-brand hover:bg-brand-soft' : 'text-[#6b6b6b] hover:bg-black/5 hover:text-ink',
        )}
      >
        <Icon aria-hidden="true" strokeWidth={active ? 2.2 : 1.9} />
      </Link>
      {/* Tên trang hiện khi rê chuột hoặc focus bàn phím (màn hình có chuột) */}
      <span
        className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 hidden -translate-x-1/2 translate-y-1 rounded-lg bg-ink px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-white opacity-0 transition-[opacity,translate] duration-150 group-hover/item:translate-y-0 group-hover/item:opacity-100 group-has-focus-visible/item:translate-y-0 group-has-focus-visible/item:opacity-100 [@media(hover:hover)]:block"
        aria-hidden="true"
      >
        {label}
      </span>
    </li>
  )
}

/** Điều hướng của các trang app: logo ở đầu trang, các trang và tài khoản là biểu tượng trên thanh cố định dưới đáy.
 * `bar={false}`: chỉ có logo, không có thanh dưới đáy (trang Đăng ký). */
export default function AppNav({ bar = true }: { bar?: boolean }) {
  const pathname = usePathname()
  const { user, status } = useSession()
  const supporter = useSupporterProfile()
  const verified = supporter.data?.status === 'verified'

  const items: Item[] = appNav.map((link) => ({
    href: link.path,
    label: link.path === SUPPORTER_PATH && !verified ? BECOME_SUPPORTER : link.label,
    Icon: icons[link.path] ?? UserRound,
    active: pathname === link.path,
    sos: link.path === '/app/sos',
  }))
  const account: Item = user
    ? { href: ACCOUNT_PATH, label: user.displayName ?? authCopy.nav.account, Icon: UserRound, active: pathname === ACCOUNT_PATH }
    : { href: LOGIN_PATH, label: 'Đăng nhập', Icon: LogIn, active: pathname === LOGIN_PATH }

  return (
    <>
      {/* Đầu trang chỉ còn logo; chiều cao giữ như navbar cũ để các trang tính chiều cao màn hình không đổi */}
      <header className="flex h-17 items-center bg-paper px-[max(16px,calc((100%-1280px)/2+16px))] shadow-[inset_0_-1px_0_var(--color-line)] max-lg:h-14">
        <Logo />
      </header>
      {bar && <nav
        aria-label="Điều hướng chính"
        // Chừa chỗ cuối trang để thanh cố định không che nội dung
        className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(10px,env(safe-area-inset-bottom))] [body:has(&)]:pb-[calc(84px+env(safe-area-inset-bottom))]"
      >
        <ul className="flex w-full max-w-120 items-center rounded-[22px] border border-line bg-paper/92 p-1.5 shadow-[0_12px_32px_rgba(0,0,0,.14)] backdrop-blur-md">
          {items.map((item) => <NavItem key={item.href} item={item} />)}
          <li className="mx-1 h-7 w-px self-center bg-line" aria-hidden="true" />
          <NavItem item={account} className={status === 'loading' ? 'invisible' : undefined} />
        </ul>
      </nav>}
    </>
  )
}
