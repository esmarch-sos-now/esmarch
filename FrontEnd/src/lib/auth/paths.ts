// Route rules shared by the proxy, server pages and client forms.

import { appStart } from "@/content/app";

export const LOGIN_PATH = "/dang-nhap";
export const ACCOUNT_PATH = "/tai-khoan";
export const ADMIN_PATH = "/admin";
/** Where login/register land without an explicit ?next=: the SOS screen, same as the landing "Bắt đầu ngay" button. */
export const AFTER_LOGIN_PATH = appStart;

/** "Đăng ký làm người hỗ trợ" / supporter mode. Public: everyone can read the conditions; the steps need sign-in. */
export const SUPPORTER_PATH = "/app/san-sang-ho-tro";

/** Pages that need a signed-in user; the proxy redirects to the login page without a session. */
export const PROTECTED_PREFIXES = [ACCOUNT_PATH, ADMIN_PATH];

export function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** The admin area: an ADMIN account is kept inside it (see proxy.ts). */
export function isAdminPath(pathname: string): boolean {
  return pathname === ADMIN_PATH || pathname.startsWith(`${ADMIN_PATH}/`);
}

export const ADMIN_PAGES = {
  users: ADMIN_PATH,
  responders: `${ADMIN_PATH}/nguoi-ho-tro`,
  courses: `${ADMIN_PATH}/khoa-hoc`,
  account: `${ADMIN_PATH}/tai-khoan`,
} as const;

/** Only same-site relative paths are allowed as post-login destinations (no open redirects). */
export function safeNext(value: string | string[] | null | undefined, fallback = AFTER_LOGIN_PATH): string {
  const next = Array.isArray(value) ? value[0] : value;
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}

export function loginUrl(next: string): string {
  return `${LOGIN_PATH}?next=${encodeURIComponent(next)}`;
}
