"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { LayoutDashboard, Receipt, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { key: "overview" as const, href: "/app", icon: LayoutDashboard, exact: true },
  { key: "invoices" as const, href: "/app/invoices", icon: Receipt, exact: false },
  { key: "settings" as const, href: "/app/settings", icon: Settings, exact: false },
];

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations("app.nav");
  const locale = useLocale();
  const rawPathname = usePathname();
  const pathname = rawPathname.replace(/^\/de/, "") || "/";

  function localePath(path: string) {
    return locale === "en" ? path : `/de${path}`;
  }

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav className="space-y-0.5">
      {navItems.map(({ key, href, icon: Icon, exact }) => {
        const active = isActive(href, exact);
        return (
          <Link
            key={href}
            href={localePath(href)}
            onClick={onNavigate}
            className={cn(
              "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-accent text-accent-foreground before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-4 before:w-0.5 before:rounded-full before:bg-primary"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
          >
            <Icon className="size-4 shrink-0" />
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
