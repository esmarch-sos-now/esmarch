// Browser-side API client. Requests go to the Next origin and are proxied to the FastAPI backend
// (see rewrites in next.config.ts), so no CORS and no backend URL in the bundle.
export const API_BASE = "/backend";

export class ApiError extends Error {
  status: number;
  retryAfter: number;
  constructor(status: number, retryAfter = 0) {
    super(
      status === 429
        ? "Bạn đã tra cứu nhiều lần. Vui lòng chờ rồi thử lại."
        : status === 400
          ? "Thông tin tìm kiếm chưa hợp lệ. Hãy chọn lại vị trí hoặc quận/huyện."
          : "Chưa kết nối được dịch vụ. Hãy thử lại sau.",
    );
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  // A hard timeout also covers slow response bodies. Never log or send these URLs to analytics.
  const timeout = AbortSignal.timeout(8000);
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
    headers: { Accept: "application/json", ...init.headers },
    credentials: "omit",
    cache: "no-store",
  });
  if (!response.ok) {
    const retry = response.headers.get("Retry-After") ?? "";
    const seconds = /^\d+$/.test(retry) ? Number(retry) : Math.ceil((Date.parse(retry) - Date.now()) / 1000);
    throw new ApiError(response.status, response.status === 429 ? Math.min(3600, Math.max(1, seconds || 60)) : 0);
  }
  return response.json() as Promise<T>;
}

/** Default SWR fetcher: the SWR key is the API path (with query string). */
export const fetcher = <T = unknown>(path: string): Promise<T> => request<T>(path);

export const postJson = <T, B>(path: string, body: B): Promise<T> =>
  request<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
