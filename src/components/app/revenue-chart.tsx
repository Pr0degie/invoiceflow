"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useFormatCurrency } from "@/lib/i18n/formatters";
import type { components } from "@/lib/api/schema";

type MonthlyRevenue = components["schemas"]["MonthlyRevenueDto"];

interface RevenueChartProps {
  data?: MonthlyRevenue[] | null;
  loading?: boolean;
}

function formatMonthLabel(month: string, locale: string): string {
  const [year, m] = month.split("-");
  const date = new Date(parseInt(year), parseInt(m) - 1, 1);
  return date.toLocaleString(locale === "de" ? "de-DE" : "en-US", {
    month: "short",
  });
}

function formatCompactY(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
  return String(value);
}

export function RevenueChart({ data, loading }: RevenueChartProps) {
  const t = useTranslations("dashboard.chart");
  const locale = useLocale();
  const formatCurrency = useFormatCurrency();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-20" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-72 w-full" />
        </CardContent>
      </Card>
    );
  }

  const isDark = resolvedTheme === "dark";
  const paidColor = isDark ? "#34d399" : "#059669";      // emerald-400 / emerald-600
  const sentColor = isDark ? "#93c5fd" : "#3b82f6";      // blue-300 / blue-500
  const gridColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const axisColor = isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)";

  const chartData = (data ?? []).map((row) => ({
    month: formatMonthLabel(row.month ?? "", locale),
    [t("paid")]: row.paid ?? 0,
    [t("outstanding")]: row.sent ?? 0,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{t("title")}</CardTitle>
        <CardDescription>{t("chartSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        {!mounted || chartData.length === 0 ? (
          <div className="flex h-72 items-center justify-center">
            <p className="text-sm text-muted-foreground">
              {chartData.length === 0 ? "—" : ""}
            </p>
            {!mounted && <Skeleton className="h-72 w-full" />}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={288}>
            <BarChart
              data={chartData}
              margin={{ top: 4, right: 0, left: -8, bottom: 0 }}
              barCategoryGap="30%"
            >
              <CartesianGrid vertical={false} stroke={gridColor} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: axisColor }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={formatCompactY}
                tick={{ fontSize: 12, fill: axisColor }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                formatter={(value) => [
                  formatCurrency(typeof value === "number" ? value : 0),
                ]}
                contentStyle={{
                  backgroundColor: isDark ? "#1c1c1c" : "#fff",
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)"}`,
                  borderRadius: 8,
                  fontSize: 13,
                }}
                labelStyle={{ color: axisColor, marginBottom: 4 }}
                cursor={{ fill: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" }}
              />
              <Legend
                iconType="square"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
              />
              <Bar
                dataKey={t("paid")}
                fill={paidColor}
                radius={[3, 3, 0, 0]}
                maxBarSize={24}
              />
              <Bar
                dataKey={t("outstanding")}
                fill={sentColor}
                radius={[3, 3, 0, 0]}
                maxBarSize={24}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
