"use client";

const FIREBASE_SDK_VERSION = "13.2.0";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};
const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? "";

type FirebaseMessagingCompat = {
  getToken(options: { vapidKey: string; serviceWorkerRegistration: ServiceWorkerRegistration }): Promise<string>;
};

type FirebaseCompat = {
  apps: unknown[];
  initializeApp(options: typeof config): void;
  messaging(): FirebaseMessagingCompat;
};

declare global {
  interface Window {
    firebase?: FirebaseCompat;
  }
}

export function firebaseMessagingConfigured(): boolean {
  return Boolean(config.apiKey && config.projectId && config.messagingSenderId && config.appId && vapidKey);
}

function loadScript(filename: string): Promise<void> {
  const src = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/${filename}`;
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
  if (existing?.dataset.loaded === "true") return Promise.resolve();
  if (existing) return new Promise((resolve, reject) => {
    existing.addEventListener("load", () => resolve(), { once: true });
    existing.addEventListener("error", () => reject(new Error("Firebase SDK failed to load.")), { once: true });
  });
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => { script.dataset.loaded = "true"; resolve(); };
    script.onerror = () => reject(new Error("Firebase SDK failed to load."));
    document.head.append(script);
  });
}

export async function getResponderFcmToken(): Promise<string | null> {
  if (!firebaseMessagingConfigured() || !window.isSecureContext || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return null;
  }
  await loadScript("firebase-app-compat.js");
  await loadScript("firebase-messaging-compat.js");
  const firebase = window.firebase;
  if (!firebase) return null;
  if (firebase.apps.length === 0) firebase.initializeApp(config);
  const serviceWorker = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  return firebase.messaging().getToken({ vapidKey, serviceWorkerRegistration: serviceWorker });
}
