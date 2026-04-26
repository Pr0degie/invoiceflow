"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertCircle, Receipt, FileStack } from "lucide-react";
import { useStats } from "@/lib/api/hooks/useStats";
import { useInvoices } from "@/lib/api/hooks/useInvoices";
import type { StatsRange } from "@/lib/api/query-keys";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFormatCurrency } from "@/lib/i18n/formatters";
import { KpiCard } from "./kpi-card";
import { RevenueChart } from "./revenue-chart";
import { ActivityList } from "./activity-list";
import { RangeSelector, type RangeKey } from "./range-selector";
import { DashboardEmpty } from "./dashboard-empty";

function rangeToParams(range: RangeKey): StatsRange {
  const now = new Date();
  const to = now.toISOString().split("T")[0];

  switch (range) {
    case "30d": {
      const from = new Date(now);
      from.setDate(from.getDate() - 30);
      return { from: from.toISOString().split("T")[0], to };
    }
    case "ytd":
      return { from: `${now.getFullYear()}-01-01`, to };
    case "12m": {
      const from = new Date(now);
      from.setFullYear(from.getFullYear() - 1);
      return { from: from.toISOString().split("T")[0], to };
    }
    default:
      return {};
  }
}

function greetingPeriod(): "morning" | "afternoon" | "evening" {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

interface DashboardViewProps {
  userName?: string | null;
}

export function DashboardView({ userName }: DashboardViewProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("dashboard");
  const formatCurrency = useFormatCurrency();

  const range = (searchParams.get("range") ?? "30d") as RangeKey;
  const statsRange = rangeToParams(range);

  const {
    data: stats,
    isLoading: statsLoading,
    isFetching: statsFetching,
    error: statsError,
    refetch,
  } = useStats(statsRange);

  const { data: allInvoices, isLoading: invoicesLoading } = useInvoices();

  const recentInvoices = [...(allInvoices ?? [])]
    .sort(
      (a, b) =>
        new Date(b.createdAt ?? 0).getTime() -
        new Date(a.createdAt ?? 0).getTime()
    )
    .slice(0, 5);

  const totalInvoiceCount =
    (stats?.paidCount ?? 0) +
    (stats?.sentCount ?? 0) +
    (stats?.draftCount ?? 0) +
    (stats?.overdueCount ?? 0);

  const isEmpty = !statsLoading && !!stats && totalInvoiceCount === 0;
  const isSilentRefetch = statsFetching && !statsLoading && !isEmpty;
  const overdueCount = stats?.overdueCount ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("overview.title")}
          </h1>
          {userName && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t(`greetings.${greetingPeriod()}`)}, {userName}.
            </p>
          )}
        </div>
        <RangeSelector value={range} onChange={(r) => router.push(`${pathname}?range=${r}`)} />
      </div>

      {/* Error banner — shows even when data is stale */}
      {statsError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>{t("error.title")}</AlertTitle>
          <AlertDescription>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => refetch()}
            >
              {t("error.retry")}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {isEmpty ? (
        <DashboardEmpty />
      ) : (
        <div
          className={cn(
            "space-y-4 transition-opacity duration-200",
            isSilentRefetch && "opacity-50"
          )}
        >
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard
              label={t("kpi.outstanding")}
              value={formatCurrency(stats?.totalOutstanding ?? 0)}
              icon={Receipt}
              loading={statsLoading}
            />
            <KpiCard
              label={t("kpi.paid")}
              value={formatCurrency(stats?.totalPaid ?? 0)}
              valueClassName="text-emerald-600 dark:text-emerald-500"
              loading={statsLoading}
            />
            <KpiCard
              label={t("kpi.overdue")}
              value={String(overdueCount)}
              subtext={t("kpi.overdueInvoices", { count: overdueCount })}
              valueClassName={overdueCount > 0 ? "text-red-600 dark:text-red-500" : ""}
              loading={statsLoading}
            />
            <KpiCard
              label={t("kpi.drafts")}
              value={formatCurrency(stats?.totalDraft ?? 0)}
              subtext={t("kpi.draftInvoices", { count: stats?.draftCount ?? 0 })}
              icon={FileStack}
              valueClassName="text-muted-foreground"
              loading={statsLoading}
            />
          </div>

          {/* Chart + Activity */}
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <RevenueChart
                data={stats?.monthlyRevenue}
                loading={statsLoading}
              />
            </div>
            <ActivityList
              invoices={recentInvoices}
              loading={invoicesLoading}
            />
          </div>
        </div>
      )}
    </div>
  );
}
