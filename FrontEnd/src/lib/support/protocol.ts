// "Tìm kiếm người hỗ trợ": request/response types and the HTTP calls. Live updates are Supabase Realtime signals
// (see hooks/useSupportChannel.ts); the backend is BackEnd/app/modules/support/.
import { API_BASE } from "@/lib/api/client";
import type { CompletedCourse } from "@/lib/courses/types";

export type ResponderRequest = {
  id: string;
  status: "OPEN" | "ACCEPTED" | "CANCELLED" | "COMPLETED";
  situation: string | null;
  description: string | null;
  expiresAt: string;
  photoCount: number;
  hasVideo?: boolean;
  /** Before accepting, for a request sent with an incident area (the district derived from the requester's GPS). */
  area?: string;
  /** Before accepting, for a radius request: rounded to 100 m. */
  approximateDistanceMeters?: number;
  /** After accepting only. */
  latitude?: number | null;
  longitude?: number | null;
  contactPhone?: string | null;
};

export type RequesterState = {
  id: string;
  status: ResponderRequest["status"];
  expiresAt: string;
  invitedCount: number;
  photoCount: number;
  hasVideo?: boolean;
  responder?: {
    id: string;
    displayName: string;
    contactPhone: string;
    latitude?: number;
    longitude?: number;
    distanceMeters?: number;
    /** First-aid courses the responder has finished (shown to build trust). */
    completedCourses?: CompletedCourse[];
  };
};

export const SITUATIONS = ["Bất tỉnh", "Khó thở", "Chảy máu", "Ngã, chấn thương", "Co giật", "Khác"] as const;

export type CreatedRequest = { id: string; requesterToken: string; invitedCount: number; expiresAt: string };

/** Anonymous: the requester never needs an account. With `area`, every ready responder is invited; 409 = nobody ready. */
export async function createSupportRequest(body: {
  latitude: number;
  longitude: number;
  contactPhone: string;
  area?: string;
  situation?: string;
  description?: string;
}): Promise<{ ok: true; request: CreatedRequest } | { ok: false; status: number; detail: string }> {
  const response = await fetch(`${API_BASE}/api/support-requests`, {
    method: "POST",
    credentials: "omit",
    cache: "no-store",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ ...body, shareLocationWithAcceptedResponder: true }),
  });
  if (response.ok) return { ok: true, request: (await response.json()) as CreatedRequest };
  const detail = await response.json().then((d: { detail?: unknown }) => String(d?.detail ?? ""), () => "");
  return { ok: false, status: response.status, detail };
}

export async function uploadSupportPhoto(request: CreatedRequest, photo: Blob): Promise<boolean> {
  const form = new FormData();
  form.append("file", photo, "photo.jpg");
  const response = await fetch(`${API_BASE}/api/support-requests/${request.id}/photos`, {
    method: "POST",
    credentials: "omit",
    headers: { Authorization: `Bearer ${request.requesterToken}` },
    body: form,
  });
  return response.ok;
}

type VideoPlan = { mode: "signed"; bucket: string; path: string; token: string; maxBytes: number } | { mode: "backend"; maxBytes: number };

/** One scene video. With Supabase Storage it goes straight there (it is too large for a serverless request body) and
 * the backend then checks it; otherwise (local dev) it is posted to the backend. */
export async function uploadSupportVideo(request: CreatedRequest, video: File): Promise<boolean> {
  const auth = { Authorization: `Bearer ${request.requesterToken}` };
  const base = `${API_BASE}/api/support-requests/${request.id}`;
  const planned = await fetch(`${base}/video-upload`, { method: "POST", credentials: "omit", headers: auth });
  if (!planned.ok) return false;
  const plan = (await planned.json()) as VideoPlan;
  if (video.size > plan.maxBytes) return false;
  if (plan.mode === "backend") {
    const form = new FormData();
    form.append("file", video, video.name || "video.mp4");
    return (await fetch(`${base}/video`, { method: "POST", credentials: "omit", headers: auth, body: form })).ok;
  }
  const { createClient } = await import("@/lib/supabase/client");
  const { error } = await createClient()
    .storage.from(plan.bucket)
    .uploadToSignedUrl(plan.path, plan.token, video, { contentType: video.type || "video/mp4", upsert: true });
  if (error) return false;
  return (await fetch(`${base}/video/complete`, { method: "POST", credentials: "omit", headers: auth })).ok;
}

/** The requester's current view of the request (404 = gone). */
export async function fetchRequesterState(request: CreatedRequest): Promise<RequesterState | null> {
  const response = await fetch(`${API_BASE}/api/support-requests/${request.id}`, {
    credentials: "omit",
    cache: "no-store",
    headers: { Authorization: `Bearer ${request.requesterToken}`, Accept: "application/json" },
  });
  return response.ok ? ((await response.json()) as RequesterState) : null;
}

export async function cancelSupportRequest(request: CreatedRequest): Promise<void> {
  await fetch(`${API_BASE}/api/support-requests/${request.id}`, {
    method: "DELETE",
    credentials: "omit",
    headers: { Authorization: `Bearer ${request.requesterToken}` },
  }).catch(() => undefined);
}

/** Scene photos: for invited responders while the request is open, then for the accepting one only. The proxy signs
 * the request with the account. */
export const photoUrl = (requestId: string, index: number) => `${API_BASE}/api/support/me/requests/${requestId}/photos/${index}`;

/** Where to play the scene video from: a short-lived Storage link, or (local dev) the backend stream. Same rule as photos. */
export async function videoSource(authFetch: (path: string) => Promise<Response>, requestId: string): Promise<string | null> {
  const response = await authFetch(`/api/support/me/requests/${requestId}/video-url`);
  if (!response.ok) return null;
  const { url } = (await response.json()) as { url: string | null };
  return url ?? `${API_BASE}/api/support/me/requests/${requestId}/video`;
}

/** Shrink a camera photo before upload (longest side 1280 px, JPEG): faster on mobile data, well under the 4 MB cap. */
export async function compressPhoto(file: File, maxSide = 1280): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encode"))), "image/jpeg", 0.8));
}
