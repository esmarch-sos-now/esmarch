"use client";

// Frame of the admin area: its own sidebar (no SOS / assistant / practice links: an admin account only manages)
// and a slim top bar with the breadcrumb. On phones the sidebar opens as a sheet from the top-bar button.
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, HeartHandshake, LogOut, UserRound, Users } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { adminCopy } from "@/content/admin";
import { useLogout, useSession } from "@/hooks/use-auth";
import { ADMIN_PAGES, LOGIN_PATH } from "@/lib/auth/paths";
import { formatPhone } from "@/lib/auth/schemas";
import { Mark } from "./table-kit";

const nav = adminCopy.nav;

const sections = [
  { href: ADMIN_PAGES.users, label: nav.users, icon: Users },
  { href: ADMIN_PAGES.responders, label: nav.responders, icon: HeartHandshake },
  { href: ADMIN_PAGES.courses, label: nav.courses, icon: BookOpen },
];

const titles: Record<string, string> = {
  [ADMIN_PAGES.users]: nav.users,
  [ADMIN_PAGES.responders]: nav.responders,
  [ADMIN_PAGES.courses]: nav.courses,
  [ADMIN_PAGES.account]: nav.account,
};

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useSession();
  const logout = useLogout();
  const name = user?.displayName || adminCopy.roles.ADMIN;
  const login = user?.phone ? formatPhone(user.phone) : user?.email;

  async function signOut() {
    await logout.trigger({ everywhere: false }).catch(() => undefined);
    router.replace(LOGIN_PATH);
  }

  return (
    <SidebarProvider className="bg-background">
      <Sidebar collapsible="offcanvas" className="border-r">
        <SidebarHeader className="px-3 pt-4">
          <Link href={ADMIN_PAGES.users} className="flex items-center gap-2 px-1 text-ink no-underline">
            {/* eslint-disable-next-line @next/next/no-img-element -- same small logo mark as the site navbar */}
            <img src="/site/logo-mark.webp" alt="" width="46" height="62" className="h-7 w-auto" />
            <span className="text-[15px] font-extrabold tracking-tight">SOS NOW</span>
            <span className="rounded-md bg-brand-soft px-1.5 py-0.5 text-[11px] font-semibold text-brand">{adminCopy.brand}</span>
          </Link>
        </SidebarHeader>
        <SidebarContent className="px-1">
          <SidebarGroup>
            <SidebarGroupLabel className="text-[11px] tracking-wide uppercase">{nav.group}</SidebarGroupLabel>
            <SidebarMenu>
              {sections.map(({ href, label, icon: Icon }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton asChild isActive={pathname === href}>
                    <Link href={href}>
                      <Icon />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="px-2 pb-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === ADMIN_PAGES.account}>
                <Link href={ADMIN_PAGES.account}>
                  <UserRound />
                  <span>{nav.account}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={signOut} disabled={logout.isMutating}>
                <LogOut />
                <span>{nav.logout}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <SidebarSeparator className="mx-0" />
          {user && (
            <div className="flex items-center gap-2 rounded-lg border bg-background px-2 py-2">
              <Mark id={user.id} name={name} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{name}</p>
                <p className="truncate text-xs text-muted-foreground">{login}</p>
              </div>
            </div>
          )}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <SidebarTrigger className="md:hidden" />
          <nav aria-label="breadcrumb" className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">{adminCopy.crumb}</span>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium">{titles[pathname] ?? ""}</span>
          </nav>
        </header>
        <div className="min-w-0 flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
