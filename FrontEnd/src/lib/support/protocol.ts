// "Tìm kiếm người hỗ trợ": message types of the /api/support/ws channel and the HTTP calls around it.
// The backend protocol is documented in BackEnd/app/modules/support/realtime.py.
import { API_BASE } from "@/lib/api/client";

export type ResponderRequest = {
  id: string;
  status: "OPEN" | "ACCEPTED" | "CANCELLED" | "COMPLETED";
  situation: string | null;
  description: string | null;
  expiresAt: string;
  photoCount: number;
  /** Before accepting: rounded to 100 m. */
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
  responder?: {
    id: string;
    displayName: string;
    contactPhone: string;
    latitude?: number;
    longitude?: number;
    distanceMeters?: number;
  };
};

export type ResponderMessage =
  | { type: "pong" }
  | { type: "ready"; available: boolean; requests: ResponderRequest[] }
  | { type: "availability"; available: boolean }
  | { type: "request.new" | "request.detail"; request: ResponderRequest }
  | { type: "request.taken" | "request.cancelled" | "request.expired" | "request.completed"; requestId: string }
  | { type: "error"; message: string; requestId?: string | null };

export type RequesterMessage =
  | { type: "pong" }
  | { type: "request.state" | "request.accepted"; request: RequesterState }
  | { type: "request.invited"; invitedCount: number }
  | { type: "responder.location"; latitude: number; longitude: number; distanceMeters?: number }
  | { type: "request.completed" | "request.expired" | "request.cancelled"; requestId: string }
  | { type: "error"; message: string };

// Dev default: the FastAPI backend on the same host, like the voice assistant. Production / tunnels set
// NEXT_PUBLIC_SUPPORT_WS_URL (wss://…/api/support/ws); the page origin must be in the backend's CORS_ORIGINS.
export function supportSocketUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SUPPORT_WS_URL;
  if (configured) return configured;
  const secure = window.location.protocol === "https:";
  return `${secure ? "wss" : "ws"}://${window.location.hostname}:8000/api/support/ws`;
}

export const SITUATIONS = ["Bất tỉnh", "Khó thở", "Chảy máu", "Ngã, chấn thương", "Co giật", "Khác"] as const;

export type CreatedRequest = { id: string; requesterToken: string; invitedCount: number; expiresAt: string };

/** Anonymous: the requester never needs an account. 409 = nobody available within the radius. */
export async function createSupportRequest(body: {
  latitude: number;
  longitude: number;
  contactPhone: string;
  situation: string;
  description: string;
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

/** HTTP fallback while the socket is down: the requester's current view of the request (404 = gone). */
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

/** Photos are only served to the accepting responder; the proxy signs the request with the account. */
export const photoUrl = (requestId: string, index: number) => `${API_BASE}/api/support/me/requests/${requestId}/photos/${index}`;

/** Shrink a camera photo before upload (longest side 1280 px, JPEG): faster on mobile data, well under the 5 MB cap. */
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
