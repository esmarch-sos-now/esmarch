"use client";

// SMS one-time codes through Firebase Phone Auth (https://firebase.google.com/docs/auth/web/phone-auth).
// Firebase sends the SMS and checks the code; we only keep the resulting ID token long enough to hand it to our
// backend (via /api/auth/phone-*), which verifies it and reads the phone number from it. The Firebase session itself
// is dropped right away: our own cookies are the only sign-in.
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  RecaptchaVerifier,
  getAuth,
  signInWithPhoneNumber,
  signOut,
  type Auth,
  type ConfirmationResult,
} from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const smsConfigured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);

let auth: Auth | null = null;
let verifier: RecaptchaVerifier | null = null;

function firebaseAuth(): Auth {
  if (!smsConfigured) throw new SmsError("not-configured");
  if (!auth) {
    const app: FirebaseApp = getApps().length ? getApp() : initializeApp(config);
    auth = getAuth(app);
    auth.languageCode = "vi"; // SMS text and reCAPTCHA in Vietnamese
  }
  return auth;
}

export type SmsErrorCode =
  | "not-configured"
  | "invalid-phone"
  | "invalid-code"
  | "code-expired"
  | "too-many-requests"
  | "quota-exceeded"
  | "captcha-failed"
  | "network"
  | "unknown";

export class SmsError extends Error {
  code: SmsErrorCode;
  constructor(code: SmsErrorCode) {
    super(code);
    this.code = code;
  }
}

function toSmsError(error: unknown): SmsError {
  if (error instanceof SmsError) return error;
  const code = (error as { code?: string } | null)?.code ?? "";
  const map: Record<string, SmsErrorCode> = {
    "auth/invalid-phone-number": "invalid-phone",
    "auth/missing-phone-number": "invalid-phone",
    "auth/invalid-verification-code": "invalid-code",
    "auth/missing-verification-code": "invalid-code",
    "auth/code-expired": "code-expired",
    "auth/too-many-requests": "too-many-requests",
    "auth/quota-exceeded": "quota-exceeded",
    "auth/captcha-check-failed": "captcha-failed",
    "auth/invalid-app-credential": "captcha-failed",
    "auth/network-request-failed": "network",
    // Phone sign-in not enabled, domain not authorised, or no billing plan for real SMS: a setup problem.
    "auth/operation-not-allowed": "not-configured",
    "auth/unauthorized-domain": "not-configured",
    "auth/billing-not-enabled": "not-configured",
    "auth/invalid-api-key": "not-configured",
  };
  if (process.env.NODE_ENV !== "production") console.warn("Firebase SMS error", code, error);
  return new SmsError(map[code] ?? "unknown");
}

/**
 * Sends the SMS code to an E.164 number. `container` is the id of an empty element for the invisible reCAPTCHA
 * that Firebase uses to block bots; it only shows a challenge when it suspects one.
 */
export async function sendSmsCode(phone: string, container: string): Promise<ConfirmationResult> {
  try {
    const auth = firebaseAuth();
    verifier?.clear();
    verifier = new RecaptchaVerifier(auth, container, { size: "invisible" });
    return await signInWithPhoneNumber(auth, phone, verifier);
  } catch (error) {
    verifier?.clear();
    verifier = null;
    throw toSmsError(error);
  }
}

/** Checks the 6-digit code and returns a fresh ID token proving the phone number, for our backend. */
export async function confirmSmsCode(confirmation: ConfirmationResult, code: string): Promise<string> {
  try {
    const credential = await confirmation.confirm(code);
    const token = await credential.user.getIdToken();
    await signOut(firebaseAuth()).catch(() => undefined);
    return token;
  } catch (error) {
    throw toSmsError(error);
  }
}

export function clearSmsVerifier() {
  verifier?.clear();
  verifier = null;
}
