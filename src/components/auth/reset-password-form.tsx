"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ResetPasswordForm() {
  const t = useTranslations("auth.resetPasswordPage");
  const tErr = useTranslations("auth.errors");

  // Client-side password rules mirror register (backend enforces min 8).
  const schema = z
    .object({
      password: z
        .string()
        .min(8, tErr("passwordMinLength"))
        .regex(/[a-zA-Z]/, tErr("passwordNeedsLetter"))
        .regex(/[0-9]/, tErr("passwordNeedsNumber")),
      confirmPassword: z.string(),
    })
    .refine((d) => d.password === d.confirmPassword, {
      message: tErr("passwordsMustMatch"),
      path: ["confirmPassword"],
    });

  type FormErrors = Partial<Record<"password" | "confirmPassword", string>>;

  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState("");
  const [tokenDead, setTokenDead] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => router.push("/auth/login?reset=true"), 2500);
    return () => clearTimeout(id);
  }, [done, router]);

  function setField(key: "password" | "confirmPassword", value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");

    const result = schema.safeParse(form);
    if (!result.success) {
      const fieldErrors: FormErrors = {};
      result.error.issues.forEach((issue) => {
        const key = issue.path[0] as keyof FormErrors;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: form.password }),
      });

      if (res.ok) {
        setDone(true);
        return;
      }
      if (res.status === 429) {
        setServerError(t("rateLimited"));
        return;
      }
      // 400 invalid_or_expired_token
      setTokenDead(true);
    } catch {
      setServerError(tErr("generic"));
    } finally {
      setLoading(false);
    }
  }

  // No token in the URL, or the backend rejected it → dead-end with a way back.
  if (!token || tokenDead) {
    return (
      <div className="space-y-5">
        <Alert variant="destructive">
          <AlertDescription>
            {token ? t("invalidToken") : t("missingToken")}
          </AlertDescription>
        </Alert>
        <Button asChild variant="outline" className="w-full h-10">
          <Link href="/auth/forgot-password">{t("requestNew")}</Link>
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-5">
        <Alert className="border-primary/30 bg-primary/5 text-primary [&>svg]:text-primary">
          <AlertDescription>{t("success")}</AlertDescription>
        </Alert>
        <p className="text-center text-sm text-muted-foreground">
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

  return (
    <form onSubmit={handleSubmit} noValidate>
      {serverError && (
        <Alert variant="destructive" className="mb-5">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        {/* New password */}
        <div className="space-y-1.5">
          <Label htmlFor="password">{t("passwordLabel")}</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder={t("passwordPlaceholder")}
              value={form.password}
              onChange={(e) => setField("password", e.target.value)}
              autoComplete="new-password"
              className="h-10 pr-10"
              aria-invalid={!!errors.password}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPassword ? t("hidePassword") : t("showPassword")}
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password}</p>
          )}
        </div>

        {/* Confirm */}
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">{t("confirmLabel")}</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirm ? "text" : "password"}
              placeholder={t("confirmPlaceholder")}
              value={form.confirmPassword}
              onChange={(e) => setField("confirmPassword", e.target.value)}
              autoComplete="new-password"
              className="h-10 pr-10"
              aria-invalid={!!errors.confirmPassword}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showConfirm ? t("hidePassword") : t("showPassword")}
            >
              {showConfirm ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-xs text-destructive">{errors.confirmPassword}</p>
          )}
        </div>
      </div>

      <Button type="submit" className="w-full h-10 mt-5 gap-2" disabled={loading}>
        {loading && <Loader2 className="size-4 animate-spin" />}
        {loading ? t("submitting") : t("submitButton")}
      </Button>
    </form>
  );
}
