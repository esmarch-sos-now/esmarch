// Form schemas (zod) for react-hook-form. Limits mirror the FastAPI models in app/modules/auth/schemas.py.
import * as z from "zod";
import { authCopy } from "@/content/auth";

const { errors } = authCopy;

const newPassword = z.string().min(8, errors.passwordShort).max(128, errors.passwordLong);
const displayName = z.string().trim().max(100, errors.nameLong);
const code = z.string().regex(/^\d{6}$/, errors.codeFormat);

const matching = <T extends { password: string; confirm: string }>(value: T) => value.password === value.confirm;
const mismatch = { message: errors.passwordMismatch, path: ["confirm"] };

/** Vietnamese mobile number to E.164 (+84…), or null. Mirrors security.normalize_phone in the backend. */
export function normalizePhone(value: string): string | null {
  let digits = value.replace(/[\s.()-]/g, "");
  if (digits.startsWith("0")) digits = `+84${digits.slice(1)}`;
  else if (digits.startsWith("84")) digits = `+${digits}`;
  return /^\+84[35789]\d{8}$/.test(digits) ? digits : null;
}

/** +84912345678 → 0912 345 678, for showing a number back to the user. */
export function formatPhone(e164: string): string {
  const local = e164.startsWith("+84") ? `0${e164.slice(3)}` : e164;
  return local.replace(/^(\d{4})(\d{3})(\d{3})$/, "$1 $2 $3");
}

const phone = z
  .string()
  .trim()
  .min(1, errors.phoneRequired)
  .refine((value) => normalizePhone(value) !== null, errors.invalidPhone);

// Older accounts still sign in with their email, so the login name is a phone number or an email.
const loginName = z
  .string()
  .trim()
  .min(1, errors.phoneRequired)
  .max(254)
  .refine((value) => normalizePhone(value) !== null || z.email().safeParse(value).success, errors.invalidPhone);

export const loginSchema = z.object({ username: loginName, password: z.string().min(1, errors.passwordRequired).max(128) });

export const registerSchema = z
  .object({ displayName, phone, password: newPassword, confirm: z.string() })
  .refine(matching, mismatch);

export const verifySchema = z.object({ code });

export const forgotSchema = z.object({ phone });

export const resetSchema = z.object({ password: newPassword, confirm: z.string() }).refine(matching, mismatch);

export const profileSchema = z.object({ displayName });

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1, errors.passwordRequired).max(128), password: newPassword, confirm: z.string() })
  .refine(matching, mismatch);

