// Form schemas (zod) for react-hook-form. Limits mirror the FastAPI models in app/modules/auth/schemas.py.
import * as z from "zod";
import { authCopy } from "@/content/auth";

const { errors } = authCopy;

const email = z.string().trim().min(1, errors.emailRequired).max(254, errors.invalidEmail).pipe(z.email(errors.invalidEmail));
const newPassword = z.string().min(8, errors.passwordShort).max(128, errors.passwordLong);
const displayName = z.string().trim().max(100, errors.nameLong);
const code = z.string().regex(/^\d{6}$/, errors.codeFormat);

const matching = <T extends { password: string; confirm: string }>(value: T) => value.password === value.confirm;
const mismatch = { message: errors.passwordMismatch, path: ["confirm"] };

export const loginSchema = z.object({ email, password: z.string().min(1, errors.passwordRequired).max(128) });

export const registerSchema = z
  .object({ displayName, email, password: newPassword, confirm: z.string() })
  .refine(matching, mismatch);

export const verifySchema = z.object({ code });

export const forgotSchema = z.object({ email });

export const resetSchema = z.object({ code, password: newPassword, confirm: z.string() }).refine(matching, mismatch);

export const profileSchema = z.object({ displayName });

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1, errors.passwordRequired).max(128), password: newPassword, confirm: z.string() })
  .refine(matching, mismatch);

