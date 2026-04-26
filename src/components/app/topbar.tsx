import Link from "next/link";
import { Receipt } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { MobileNav } from "./mobile-nav";

interface TopbarProps {
  locale: string;
  userName?: string | null;
  userEmail?: string | null;
}

export async function Topbar({ locale, userName, userEmail }: TopbarProps) {
  const t = await getTranslations("app.nav");
  const prefix = locale === "en" ? "" : "/de";

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4 md:hidden">
      <MobileNav userName={userName} userEmail={userEmail} />
      <Link
        href={`${prefix}/app`}
        className="flex items-center gap-2 text-sm font-semibold"
      >
        <Receipt className="size-4 text-primary shrink-0" />
        <span>InvoiceFlow</span>
      </Link>
      <div className="flex-1" />
      <Button asChild size="sm">
        <Link href={`${prefix}/app/invoices/new`}>{t("newInvoice")}</Link>
      </Button>
    </header>
  );
}
