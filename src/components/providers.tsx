"use client";

import { SessionProvider } from "next-auth/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionGuard } from "@/components/providers/session-guard";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SessionGuard />
      <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
    </SessionProvider>
  );
}
