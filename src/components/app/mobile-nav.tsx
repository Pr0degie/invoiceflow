"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Receipt } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";

interface MobileNavProps {
  userName?: string | null;
  userEmail?: string | null;
}

export function MobileNav({ userName, userEmail }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("app.nav");
  const locale = useLocale();
  const prefix = locale === "en" ? "" : "/de";

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[220px] p-0 flex flex-col">
          <SheetHeader className="flex-row items-center h-14 px-4 border-b border-border space-y-0 shrink-0">
            <SheetTitle asChild>
              <Link
                href={`${prefix}/app`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 text-sm font-semibold"
              >
                <Receipt className="size-4 text-primary shrink-0" />
                InvoiceFlow
              </Link>
            </SheetTitle>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-3 p-3">
            <Button asChild className="w-full" size="sm">
              <Link href={`${prefix}/app/invoices/new`} onClick={() => setOpen(false)}>
                {t("newInvoice")}
              </Link>
            </Button>
            <Separator />
            <SidebarNav onNavigate={() => setOpen(false)} />

            <div className="mt-auto border-t border-border pt-2">
              <UserMenu name={userName} email={userEmail} />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
