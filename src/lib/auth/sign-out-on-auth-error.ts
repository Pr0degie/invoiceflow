"use client";

import { signOut } from "next-auth/react";

let signingOut = false;

/**
 * Ends a dead session (expired/invalid refresh token, 401 from the API)
 * exactly once and redirects to login. Guarded so a burst of failing
 * queries doesn't trigger parallel signOut calls.
 */
export function signOutOnAuthError() {
  if (signingOut) return;
  signingOut = true;
  void signOut({ callbackUrl: "/auth/login" });
}
