"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ForgotPasswordForm() {
  const t = useTranslations("auth.forgotPasswordPage");
  const tErr = useTranslations("auth.errors");

  const schema = z.object({ email: z.string().email(tErr("invalidEmail")) });

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Once submitted we always show the same neutral confirmation, regardless of
  // whether the address exists — never leak account state.
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const result = schema.safeParse({ email });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.status === 429) {
        setError(t("rateLimited"));
        return;
      }
      setSent(true);
    } catch {
      setError(tErr("generic"));
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-5">
        <Alert className="border-primary/30 bg-primary/5 text-primary [&>svg]:text-primary">
          <AlertDescription>{t("sent")}</AlertDescription>
        </Alert>
        <Link
          href="/auth/login"
          className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          {t("backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && (
        <Alert variant="destructive" className="mb-5">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="email">{t("emailLabel")}</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError("");
          }}
          autoComplete="email"
          className="h-10"
          aria-invalid={!!error}
          disabled={loading}
        />
      </div>

      <Button type="submit" className="w-full h-10 mt-5 gap-2" disabled={loading}>
        {loading && <Loader2 className="size-4 animate-spin" />}
        {loading ? t("submitting") : t("submitButton")}
      </Button>

      <p className="text-center text-sm text-muted-foreground mt-5">
        <Link
          href="/auth/login"
          className="text-foreground font-medium hover:text-primary transition-colors underline underline-offset-2"
        >
          {t("backToLogin")}
        </Link>
      </p>
    </form>
  );
}
