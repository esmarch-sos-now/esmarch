"use client";

import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { SESSION_KEY } from "@/hooks/use-auth";
import type { User } from "@/lib/auth/client";

/** Seeds the SWR session cache with a user the server already resolved (see lib/auth/server.ts). */
export function SessionProvider({ user, children }: { user: User | null; children: ReactNode }) {
  return <SWRConfig value={{ fallback: { [SESSION_KEY]: user } }}>{children}</SWRConfig>;
}
