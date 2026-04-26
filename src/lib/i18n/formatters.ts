"use client";

import { useFormatter, useLocale } from "next-intl";
import { formatDistanceToNow } from "date-fns";
import { de, enUS } from "date-fns/locale";

export function useFormatCurrency() {
  const format = useFormatter();
  return (amount: number) =>
    format.number(amount, { style: "currency", currency: "EUR" });
}

export function useFormatDate() {
  const format = useFormatter();
  return (date: Date | string) =>
    format.dateTime(new Date(date), { dateStyle: "medium" });
}

export function useFormatRelative() {
  const locale = useLocale();
  return (date: Date | string) =>
    formatDistanceToNow(new Date(date), {
      addSuffix: true,
      locale: locale === "de" ? de : enUS,
    });
}
