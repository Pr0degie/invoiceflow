"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { signIn } from "next-auth/react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ResendVerification } from "@/components/auth/resend-verification";

export function LoginForm() {
  const t = useTranslations("auth.signIn");
  const tErr = useTranslations("auth.errors");
  const tSignUp = useTranslations("auth.signUp");

  const schema = z.object({
    email: z.string().email(tErr("invalidEmail")),
    password: z.string().min(1, tErr("passwordRequired")),
  });

  type FormErrors = Partial<Record<keyof z.infer<typeof schema>, string>>;

  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered") === "true";
  const passwordReset = searchParams.get("reset") === "true";

  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState("");
  // Set when the backend answers 403 email_not_verified — swaps the generic
  // error for a "verify first" message plus a resend action.
  const [unverified, setUnverified] = useState(false);
  const [loading, setLoading] = useState(false);

  function setField<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");
    setUnverified(false);

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
    const res = await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false,
    });
    setLoading(false);

    if (res?.error) {
      // `code` is set from EmailNotVerifiedError thrown in authorize().
      if (res.code === "email_not_verified") {
        setUnverified(true);
      } else {
        setServerError(tErr("invalidCredentials"));
      }
      return;
    }

    router.push("/app");
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {registered && !serverError && !unverified && (
        <Alert className="mb-5 border-primary/30 bg-primary/5 text-primary [&>svg]:text-primary">
          <AlertDescription>{t("accountCreated")}</AlertDescription>
        </Alert>
      )}

      {passwordReset && !serverError && !unverified && (
        <Alert className="mb-5 border-primary/30 bg-primary/5 text-primary [&>svg]:text-primary">
          <AlertDescription>{t("passwordResetDone")}</AlertDescription>
        </Alert>
      )}

      {serverError && (
        <Alert variant="destructive" className="mb-5">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      {unverified && (
        <div className="mb-5 space-y-3">
          <Alert variant="destructive">
            <AlertDescription>{tErr("emailNotVerified")}</AlertDescription>
          </Alert>
          <ResendVerification email={form.email} />
        </div>
      )}

      {/* Fields */}
      <div className="space-y-4">
        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("emailLabel")}</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={(e) => setField("email", e.target.value)}
            autoComplete="email"
            className="h-10"
            aria-invalid={!!errors.email}
            disabled={loading}
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email}</p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t("passwordLabel")}</Label>
            <Link
              href="/auth/forgot-password"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("forgotPassword")}
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setField("password", e.target.value)}
              autoComplete="current-password"
              className="h-10 pr-10"
              aria-invalid={!!errors.password}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPassword ? tSignUp("hidePassword") : tSignUp("showPassword")}
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
      </div>

      {/* Submit */}
      <Button
        type="submit"
        className="w-full h-10 mt-5 gap-2"
        disabled={loading}
      >
        {loading && <Loader2 className="size-4 animate-spin" />}
        {loading ? t("submitting") : t("submitButton")}
      </Button>

      {/* Footer */}
      <p className="text-center text-sm text-muted-foreground mt-5">
        {t("noAccount")}{" "}
        <Link
          href="/auth/register"
          className="text-foreground font-medium hover:text-primary transition-colors underline underline-offset-2"
        >
          {t("signUpLink")}
        </Link>
      </p>
    </form>
  );
}
