"use client";

import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { ApiError, fetcher } from "@/lib/api/client";

// Global SWR configuration (https://swr.vercel.app/docs/global-configuration).
export function SWRProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: false, // location-based results should not refetch on tab focus
        dedupingInterval: 5000,
        shouldRetryOnError: (error) => !(error instanceof ApiError) || error.status >= 500,
        errorRetryCount: 2,
      }}
    >
      {children}
    </SWRConfig>
  );
}
