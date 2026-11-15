// Phone numbers for sign-in. Supabase Auth takes E.164 (+84…) and returns `user.phone` without the "+".

/** Country codes offered in the phone field's dropdown. Only Vietnam for now; add entries here to open more. */
export const COUNTRY_CODES = [{ country: "VN", dial: "+84", name: "Việt Nam" }] as const;
export type DialCode = (typeof COUNTRY_CODES)[number]["dial"];
export const DEFAULT_DIAL: DialCode = "+84";

/**
 * The national number typed next to the dropdown (912 345 678, 0912 345 678; a pasted +84… or 84… also works)
 * → E.164 (+84912345678), or null when it is not a Vietnamese mobile number.
 */
export function normalizePhone(value: string, dial: DialCode = DEFAULT_DIAL): string | null {
  let digits = value.replace(/[\s.()-]/g, "");
  const code = dial.slice(1); // "84"
  if (digits.startsWith(`+${code}`)) digits = digits.slice(code.length + 1);
  else if (digits.startsWith(code) && digits.length > 10) digits = digits.slice(code.length);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return /^[35789]\d{8}$/.test(digits) ? `${dial}${digits}` : null;
}

/** +84912345678 or 84912345678 → 0912 345 678, for showing a number back to the user. */
export function formatPhone(phone: string): string {
  const e164 = phone.startsWith("+") ? phone : `+${phone}`;
  const local = e164.startsWith("+84") ? `0${e164.slice(3)}` : e164;
  return local.replace(/^(\d{4})(\d{3})(\d{3})$/, "$1 $2 $3");
}
