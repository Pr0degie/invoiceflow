"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResendVerification } from "@/components/auth/resend-verification";

type State = "verifying" | "success" | "error";

export function VerifyEmailClient() {
  const t = useTranslations("auth.verifyEmailPage");

  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [state, setState] = useState<State>(token ? "verifying" : "error");
  // Guard against React 18 StrictMode double-invocation in dev — a verify token
  // is single-use, so a second POST would report the (now-consumed) token dead.
  const ran = useRef(false);

  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true;

    (async () => {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        setState(res.ok ? "success" : "error");
      } catch {
        setState("error");
      }
    })();
  }, [token]);

  if (state === "verifying") {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t("verifying")}</p>
      </div>
    );
  }

  if (state === "success") {
    return (
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <CheckCircle2 className="size-10 text-primary" />
        <div className="space-y-1">
          <h2 className="text-base font-semibold">{t("successTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("successBody")}</p>
        </div>
        <Button asChild className="w-full h-10">
          <Link href="/auth/login">{t("toLogin")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-2 text-center">
      <XCircle className="size-10 text-destructive" />
      <div className="space-y-1">
        <h2 className="text-base font-semibold">{t("errorTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("errorBody")}</p>
      </div>
      <ResendVerification />
      <p className="text-sm text-muted-foreground">
        <Link
          href="/auth/login"
          className="text-foreground font-medium hover:text-primary transition-colors underline underline-offset-2"
        >
          {t("toLogin")}
        </Link>
      </p>
    </div>
  );
}
