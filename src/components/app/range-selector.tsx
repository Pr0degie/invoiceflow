"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type RangeKey = "30d" | "ytd" | "12m" | "all";

const RANGES: RangeKey[] = ["30d", "ytd", "12m", "all"];

interface RangeSelectorProps {
  value: RangeKey;
  onChange: (range: RangeKey) => void;
}

export function RangeSelector({ value, onChange }: RangeSelectorProps) {
  const t = useTranslations("dashboard.range");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0 gap-1.5">
          {t(value)}
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px]">
        {RANGES.map((r) => (
          <DropdownMenuItem
            key={r}
            onClick={() => onChange(r)}
            className={r === value ? "font-medium text-foreground" : ""}
          >
            {t(r)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
