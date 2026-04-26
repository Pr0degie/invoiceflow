import Link from "next/link";
import { Receipt } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";

interface AppSidebarProps {
  userName?: string | null;
  userEmail?: string | null;
  locale: string;
}

export async function AppSidebar({ userName, userEmail, locale }: AppSidebarProps) {
  const t = await getTranslations("app.nav");
  const prefix = locale === "en" ? "" : "/de";

  return (
    <aside className="hidden md:flex w-[220px] shrink-0 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex h-14 shrink-0 items-center px-4 border-b border-border">
        <Link
          href={`${prefix}/app`}
          className="flex items-center gap-2 text-sm font-semibold hover:opacity-80 transition-opacity"
        >
          <Receipt className="size-4 text-primary shrink-0" />
          <span>InvoiceFlow</span>
        </Link>
      </div>

      {/* Scrollable nav area */}
      <div className="flex flex-1 flex-col gap-3 p-3 overflow-y-auto">
        {/* Primary CTA */}
        <Button asChild className="w-full" size="sm">
          <Link href={`${prefix}/app/invoices/new`}>{t("newInvoice")}</Link>
        </Button>

        <Separator />

        {/* Navigation items */}
        <SidebarNav />

        <div className="flex-1" />
      </div>

      {/* User menu at bottom */}
      <div className="shrink-0 border-t border-border p-2">
        <UserMenu name={userName} email={userEmail} />
      </div>
    </aside>
  );
}
