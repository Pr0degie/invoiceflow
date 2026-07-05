"use client";

import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { MailCheck } from "lucide-react";
import { ResendVerification } from "@/components/auth/resend-verification";

export function CheckEmailClient() {
  const t = useTranslations("auth.checkEmailPage");

  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <MailCheck className="size-10 text-primary" />
      <p className="text-sm text-muted-foreground">
        {email ? t("body", { email }) : t("bodyNoEmail")}
      </p>

      <div className="w-full">
        {/* email is known from register → resend is a single button */}
        <ResendVerification email={email || undefined} />
      </div>

      <p className="text-sm text-muted-foreground">
        <Link
          href="/auth/login"
          className="text-foreground font-medium hover:text-primary transition-colors underline underline-offset-2"
        >
          {t("backToLogin")}
        </Link>
      </p>
    </div>
  );
}
