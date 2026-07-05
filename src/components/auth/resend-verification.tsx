"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

const COOLDOWN_SECONDS = 60;

interface Props {
  /** When known (register success, login 403) the address is fixed and hidden. */
  email?: string;
}

/**
 * Requests a fresh verification e-mail. Shared by the "check your inbox" screen,
 * the verify-email error state and the login 403 handler. The confirmation text
 * is always the same generic message — it never reveals whether the address is
 * registered or already verified (mirrors the backend's anti-enumeration).
 */
export function ResendVerification({ email }: Props) {
  const t = useTranslations("auth.resend");
  const tErr = useTranslations("auth.errors");
  const locale = useLocale();

  const [inputEmail, setInputEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  function startCooldown() {
    setCooldown(COOLDOWN_SECONDS);
    const id = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          clearInterval(id);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  async function handleResend() {
    const target = email ?? inputEmail;

    if (!email) {
      const parsed = z.string().email().safeParse(inputEmail);
      if (!parsed.success) {
        setEmailError(tErr("invalidEmail"));
        return;
      }
      setEmailError("");
    }

    setLoading(true);
    setStatus("idle");
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: target, locale }),
      });

      if (res.status === 429) {
        setErrorMsg(t("rateLimited"));
        setStatus("error");
        return;
      }

      // Any other outcome is reported identically (anti-enumeration).
      setStatus("sent");
      startCooldown();
    } catch {
      setErrorMsg(tErr("generic"));
      setStatus("error");
    } finally {
      setLoading(false);
    }
  }

  const disabled = loading || cooldown > 0;

  return (
    <div className="space-y-3">
      {status === "sent" && (
        <Alert className="border-primary/30 bg-primary/5 text-primary [&>svg]:text-primary">
          <AlertDescription>{t("sent")}</AlertDescription>
        </Alert>
      )}
      {status === "error" && (
        <Alert variant="destructive">
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {!email && (
        <div className="space-y-1.5 text-left">
          <Label htmlFor="resend-email">{t("emailLabel")}</Label>
          <Input
            id="resend-email"
            type="email"
            placeholder="you@example.com"
            value={inputEmail}
            onChange={(e) => {
              setInputEmail(e.target.value);
              setEmailError("");
            }}
            autoComplete="email"
            className="h-10"
            aria-invalid={!!emailError}
            disabled={loading}
          />
          {emailError && (
            <p className="text-xs text-destructive">{emailError}</p>
          )}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        className="w-full h-10 gap-2"
        onClick={handleResend}
        disabled={disabled}
      >
        {loading && <Loader2 className="size-4 animate-spin" />}
        {cooldown > 0
          ? t("cooldown", { seconds: cooldown })
          : loading
            ? t("sending")
            : t("button")}
      </Button>
    </div>
  );
}
