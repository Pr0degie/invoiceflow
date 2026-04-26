import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";

export async function Hero() {
  const t = await getTranslations("landing.hero");
  const tActions = await getTranslations("common.actions");

  const invoiceRows = [
    {
      number: "INV-2025-042",
      client: "Müller GmbH",
      amount: "€ 2.400,00",
      status: t("dashboard.status.sent"),
      statusClass:
        "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50",
    },
    {
      number: "INV-2025-041",
      client: "Weber & Co.",
      amount: "€ 980,00",
      status: t("dashboard.status.paid"),
      statusClass:
        "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50",
    },
    {
      number: "INV-2025-040",
      client: "Schulz KG",
      amount: "€ 1.750,00",
      status: t("dashboard.status.overdue"),
      statusClass:
        "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50",
    },
  ];

  return (
    <section className="relative flex flex-col items-center justify-center text-center px-4 pt-24 pb-16 md:pt-32 md:pb-20 lg:pt-40 lg:pb-24 overflow-hidden">
      {/* Dot grid — light mode */}
      <div
        className="absolute inset-0 -z-10 dark:hidden"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(0,0,0,0.07) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      {/* Dot grid — dark mode */}
      <div
        className="absolute inset-0 -z-10 hidden dark:block"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      {/* Radial vignette */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 50%, transparent 30%, var(--color-background) 90%)",
        }}
      />

      {/* Eyebrow badge */}
      <Badge variant="outline" className="h-7 px-3 text-xs rounded-full gap-2 mb-8">
        <span className="size-1.5 rounded-full bg-primary" />
        {t("eyebrow")}
      </Badge>

      {/* Headline */}
      <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] max-w-3xl mb-6">
        {t("headline")}{" "}
        <span
          style={{
            backgroundImage:
              "linear-gradient(135deg, var(--color-primary) 0%, oklch(0.65 0.14 160) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          {t("headlineAccent")}
        </span>
      </h1>

      {/* Sub-headline */}
      <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10">
        {t("sub")}
      </p>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-3 mb-10">
        <Link href="/auth/register">
          <Button size="lg" className="h-11 px-6 text-base gap-2">
            {tActions("getStartedFree")}
            <ArrowRight className="size-4" />
          </Button>
        </Link>
        <Link href="#features">
          <Button variant="outline" size="lg" className="h-11 px-6 text-base">
            {t("seeHowItWorks")}
          </Button>
        </Link>
      </div>

      {/* Trust line */}
      <p className="text-sm text-muted-foreground mb-14">{t("trustLine")}</p>

      {/* Invoice dashboard mockup */}
      <div className="w-full max-w-2xl rounded-xl border border-border bg-card shadow-2xl overflow-hidden text-left">
        {/* Window chrome */}
        <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border bg-muted/40">
          <div className="size-3 rounded-full bg-red-400/80" />
          <div className="size-3 rounded-full bg-yellow-400/80" />
          <div className="size-3 rounded-full bg-green-400/80" />
          <span className="ml-2 text-xs text-muted-foreground font-mono select-none">
            {t("dashboard.title")}
          </span>
        </div>

        {/* KPI bar */}
        <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
          <div className="px-5 py-4">
            <p className="text-xs text-muted-foreground mb-1">
              {t("dashboard.outstanding")}
            </p>
            <p className="text-lg font-semibold tabular-nums">€ 4.200,00</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xs text-muted-foreground mb-1">
              {t("dashboard.paidThisMonth")}
            </p>
            <p className="text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              € 8.760,00
            </p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xs text-muted-foreground mb-1">
              {t("dashboard.overdue")}
            </p>
            <p className="text-lg font-semibold tabular-nums text-red-600 dark:text-red-400">
              3
            </p>
          </div>
        </div>

        {/* Invoice rows */}
        <div className="divide-y divide-border">
          {invoiceRows.map((row) => (
            <div
              key={row.number}
              className="flex items-center justify-between px-5 py-3 text-sm"
            >
              <span className="font-mono text-xs text-muted-foreground w-28 shrink-0">
                {row.number}
              </span>
              <span className="flex-1 text-foreground font-medium truncate px-3">
                {row.client}
              </span>
              <span className="tabular-nums text-foreground w-28 text-right shrink-0">
                {row.amount}
              </span>
              <span
                className={`ml-4 text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${row.statusClass}`}
              >
                {row.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
