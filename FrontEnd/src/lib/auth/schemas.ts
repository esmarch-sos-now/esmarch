// Form schemas (zod) for react-hook-form. Supabase Auth enforces its own password policy on top of these.
import * as z from "zod";
import { authCopy } from "@/content/auth";
import { normalizePhone } from "@/lib/auth/phone";

const { errors } = authCopy;

const phone = z
  .string()
  .trim()
  .min(1, errors.phoneRequired)
  .refine((value) => normalizePhone(value) !== null, errors.invalidPhone);
const newPassword = z.string().min(8, errors.passwordShort).max(72, errors.passwordLong); // bcrypt limit in Supabase
const displayName = z.string().trim().max(100, errors.nameLong);
const code = z.string().regex(/^\d{6}$/, errors.codeFormat);

const matching = <T extends { password: string; confirm: string }>(value: T) => value.password === value.confirm;
const mismatch = { message: errors.passwordMismatch, path: ["confirm"] };

export const loginSchema = z.object({ phone, password: z.string().min(1, errors.passwordRequired).max(72) });

export const registerSchema = z
  .object({ displayName, phone, password: newPassword, confirm: z.string() })
  .refine(matching, mismatch);

export const codeSchema = z.object({ code });

export const forgotSchema = z.object({ phone });

export const newPasswordSchema = z.object({ password: newPassword, confirm: z.string() }).refine(matching, mismatch);

export const profileSchema = z.object({ displayName });

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1, errors.passwordRequired).max(72), password: newPassword, confirm: z.string() })
  .refine(matching, mismatch);
