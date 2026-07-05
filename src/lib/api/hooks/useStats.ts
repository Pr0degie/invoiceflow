"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { queryKeys, type StatsRange } from "@/lib/api/query-keys";
import type { components } from "@/lib/api/schema";

type Stats = components["schemas"]["StatsDto"];

export function useStats(range: StatsRange = {}) {
  // No token here — the /api/backend auth proxy attaches it server-side.
  const { status } = useSession();

  return useQuery({
    queryKey: queryKeys.stats(range),
    queryFn: async () => {
      const result = await apiClient.GET("/api/invoices/stats", {
        params: { query: range },
      });
      if (result.error) throw new ApiError(result.response.status, result.error);
      return result.data as Stats;
    },
    enabled: status === "authenticated",
    staleTime: 60_000,
  });
}
