"use client";

import { useState } from "react";
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ApiError } from "@/lib/api/errors";
import { signOutOnAuthError } from "@/lib/auth/sign-out-on-auth-error";

// A 401 means the session is dead (expired/revoked tokens) — sign out and
// go to login instead of surfacing it as a per-query toast.
function onApiError(error: unknown) {
  if (error instanceof ApiError && error.isUnauthorized) {
    signOutOnAuthError();
  }
}

function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({ onError: onApiError }),
    mutationCache: new MutationCache({ onError: onApiError }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Retrying a 401 can't succeed — fail fast so the signout fires.
        retry: (failureCount, error) =>
          failureCount < 1 &&
          !(error instanceof ApiError && error.isUnauthorized),
      },
    },
  });
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // useState so we don't recreate the client across re-renders (SSR-safe)
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
