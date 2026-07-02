"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { signOutOnAuthError } from "@/lib/auth/sign-out-on-auth-error";

/**
 * Watches the client session for a failed token refresh and signs out
 * instead of leaving the app running against a dead session. Complements
 * the server-side redirect in the (app) layout, which only runs on
 * navigation.
 */
export function SessionGuard() {
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.error === "RefreshAccessTokenError") {
      signOutOnAuthError();
    }
  }, [session?.error]);

  return null;
}
