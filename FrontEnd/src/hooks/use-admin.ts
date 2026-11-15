"use client";

// Admin page data: /api/admin/users and /api/admin/responders, through the /backend proxy with the session cookie.
// Lists are SWR queries; every change goes through `send` and then revalidates the list it touched.
import { useCallback } from "react";
import useSWR from "swr";
import { useAuthFetch } from "@/hooks/use-auth";

export type Role = "USER" | "ADMIN";

export type AdminUser = {
  id: string;
  phone: string | null;
  email: string | null;
  displayName: string | null;
  role: Role;
  isActive: boolean;
  verified: boolean;
  isResponder: boolean;
  createdAt: string;
};

export type AdminResponder = {
  id: string;
  displayName: string;
  contactPhone: string;
  skills: string[];
  verified: boolean;
  verifiedAt: string | null;
  verificationSource: string;
  online: boolean;
  account: { id: string; phone: string | null; email: string | null; displayName: string | null } | null;
};

export class AdminError extends Error {
  status: number;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
  }
}

export type UserPage = { items: AdminUser[]; total: number };

export const PAGE_SIZE = 20;

/** fetch → JSON for admin endpoints; throws AdminError with the backend's status and detail. */
function useAdminFetch() {
  const authFetch = useAuthFetch();
  return useCallback(
    async <T>(path: string, init?: RequestInit): Promise<T> => {
      const response = await authFetch(path, init);
      if (!response.ok) {
        let detail = "Request failed.";
        try {
          const body = (await response.json()) as { detail?: string };
          if (body.detail) detail = body.detail;
        } catch {}
        throw new AdminError(response.status, detail);
      }
      return (response.status === 204 ? undefined : await response.json()) as T;
    },
    [authFetch],
  );
}

export type UserView = "all" | "admin" | "user" | "locked";

export function useAdminUsers(query: string, view: UserView, page: number) {
  const send = useAdminFetch();
  const params = new URLSearchParams({ offset: String(page * PAGE_SIZE), limit: String(PAGE_SIZE) });
  if (query) params.set("q", query);
  if (view === "admin") params.set("role", "ADMIN");
  if (view === "user") params.set("role", "USER");
  if (view === "locked") params.set("active", "false");
  const key = `/api/admin/users?${params}`;
  const list = useSWR<UserPage>(key, (path: string) => send<UserPage>(path), { keepPreviousData: true });
  const { mutate } = list;
  const update = useCallback(
    async (ids: string[], change: { role?: Role; isActive?: boolean }) =>
      patchAll(ids, (id) =>
        send<AdminUser>(`/api/admin/users/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(change),
        }),
      ).finally(() => mutate()),
    [send, mutate],
  );
  return { ...list, update };
}

/**
 * Runs one request per id and resolves once all have settled. With a single id its error is rethrown (so the caller
 * can show why); with several it throws a BulkError carrying how many failed.
 */
async function patchAll(ids: string[], run: (id: string) => Promise<unknown>): Promise<void> {
  const results = await Promise.allSettled(ids.map(run));
  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length === 0) return;
  if (ids.length === 1) throw (failures[0] as PromiseRejectedResult).reason;
  throw new BulkError(failures.length);
}

export class BulkError extends Error {
  failed: number;
  constructor(failed: number) {
    super(`${failed} failed`);
    this.failed = failed;
  }
}

export function useAdminResponders() {
  const send = useAdminFetch();
  const list = useSWR<AdminResponder[]>("/api/admin/responders", (path: string) => send<AdminResponder[]>(path));
  const { mutate } = list;
  const update = useCallback(
    async (ids: string[], change: { verified?: boolean; skills?: string[] }) =>
      patchAll(ids, (id) =>
        send<AdminResponder>(`/api/admin/responders/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(change),
        }),
      ).finally(() => mutate()),
    [send, mutate],
  );
  const remove = useCallback(
    async (id: string) => {
      await send<void>(`/api/admin/responders/${encodeURIComponent(id)}`, { method: "DELETE" });
      await mutate();
    },
    [send, mutate],
  );
  return { ...list, update, remove };
}
