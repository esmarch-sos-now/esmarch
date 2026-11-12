// Route rules shared by the proxy, server pages and client forms.

import { appStart } from "@/content/app";

export const LOGIN_PATH = "/dang-nhap";
export const ACCOUNT_PATH = "/tai-khoan";
/** Where login/register land without an explicit ?next=: the SOS screen, same as the landing "Bắt đầu ngay" button. */
export const AFTER_LOGIN_PATH = appStart;

/** Pages that need a signed-in user; the proxy redirects to the login page without a session. */
export const PROTECTED_PREFIXES = [ACCOUNT_PATH];

export function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Only same-site relative paths are allowed as post-login destinations (no open redirects). */
export function safeNext(value: string | string[] | null | undefined, fallback = AFTER_LOGIN_PATH): string {
  const next = Array.isArray(value) ? value[0] : value;
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}

export function loginUrl(next: string): string {
  return `${LOGIN_PATH}?next=${encodeURIComponent(next)}`;
}
