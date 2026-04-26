"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function DashboardEmpty() {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const prefix = locale === "en" ? "" : "/de";

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="flex size-20 items-center justify-center rounded-full bg-muted">
        <FileText className="size-9 text-muted-foreground" />
      </div>
      <h2 className="mt-6 text-xl font-semibold tracking-tight">
        {t("empty.title")}
      </h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {t("empty.description")}
      </p>
      <Button asChild className="mt-8">
        <Link href={`${prefix}/app/invoices/new`}>{t("empty.cta")}</Link>
      </Button>
    </div>
  );
}
