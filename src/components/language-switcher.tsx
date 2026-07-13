"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const locales = ["en", "de"] as const;

export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations("language");
  const pathname = usePathname();

  function switchLocale(next: string) {
    if (next === locale) return;

    // For 'as-needed' prefix: EN has no prefix, DE has /de prefix
    let newPath: string;
    if (next === "en") {
      // Remove /de prefix if present
      newPath = pathname.replace(/^\/de(\/|$)/, "/") || "/";
    } else {
      // Add /de prefix, removing any existing locale prefix first
      const stripped = pathname.replace(/^\/de(\/|$)/, "/");
      newPath = `/de${stripped === "/" ? "" : stripped}`;
    }

    // Persist the choice in next-intl's locale cookie BEFORE navigating.
    // With localePrefix 'as-needed', the default locale ('en') lives at '/'
    // with no prefix; next-intl's locale detection would otherwise redirect a
    // full-page load of '/' back to the previously chosen locale (e.g. '/de').
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; samesite=lax`;

    // Full-page navigation (not client-side router.push): switching locale
    // remounts the [locale] root layout, which re-renders next-themes' anti-flash
    // <script> on the client and trips React 19's "script tag while rendering"
    // console error. A real page load renders that script server-side instead.
    window.location.href = newPath;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
          aria-label={t("switcher.label")}
        >
          <Globe className="size-3.5" />
          {locale.toUpperCase()}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[120px]">
        {locales.map((l) => (
          <DropdownMenuItem
            key={l}
            onClick={() => switchLocale(l)}
            className={l === locale ? "font-medium text-foreground" : "text-muted-foreground"}
          >
            {t(l)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
