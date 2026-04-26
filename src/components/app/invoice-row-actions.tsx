"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import {
  MoreHorizontal,
  Eye,
  Download,
  CheckCircle,
  Send,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  useUpdateInvoiceStatus,
  useDeleteInvoice,
  useDownloadInvoicePdf,
} from "@/lib/api/hooks/useInvoices";
import type { components } from "@/lib/api/schema";
import { toast } from "sonner";

type Invoice = components["schemas"]["InvoiceResponse"];
type InvoiceStatus = components["schemas"]["InvoiceStatus"];

interface InvoiceRowActionsProps {
  invoice: Invoice;
}

export function InvoiceRowActions({ invoice }: InvoiceRowActionsProps) {
  const t = useTranslations("invoices");
  const locale = useLocale();
  const router = useRouter();
  const localePrefix = locale === "en" ? "" : `/${locale}`;
  const [deleteOpen, setDeleteOpen] = useState(false);

  const updateStatus = useUpdateInvoiceStatus();
  const deleteInvoice = useDeleteInvoice();
  const downloadPdf = useDownloadInvoicePdf();

  const status = (invoice.status ?? "Draft") as InvoiceStatus;
  const id = invoice.id!;

  function handleStatusChange(newStatus: InvoiceStatus) {
    updateStatus.mutate({ id, status: newStatus });
  }

  function handleDelete() {
    deleteInvoice.mutate(id, {
      onSuccess: () => toast.success(t("deleteSuccess")),
    });
    setDeleteOpen(false);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="size-4" />
            <span className="sr-only">{t("actions.openMenu")}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[220px]" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem
            onClick={() => router.push(`${localePrefix}/app/invoices/${id}`)}
          >
            <Eye className="mr-2 size-4" />
            {t("actions.view")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              downloadPdf.mutate({ id, number: invoice.number ?? id })
            }
          >
            <Download className="mr-2 size-4" />
            {t("actions.downloadPdf")}
          </DropdownMenuItem>

          {status === "Sent" && (
            <DropdownMenuItem onClick={() => handleStatusChange("Paid")}>
              <CheckCircle className="mr-2 size-4" />
              {t("actions.markAsPaid")}
            </DropdownMenuItem>
          )}
          {status === "Draft" && (
            <DropdownMenuItem onClick={() => handleStatusChange("Sent")}>
              <Send className="mr-2 size-4" />
              {t("actions.markAsSent")}
            </DropdownMenuItem>
          )}

          {status === "Draft" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDeleteOpen(true)}
                className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
              >
                <Trash2 className="mr-2 size-4" />
                {t("actions.delete")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("delete.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("delete.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-600"
            >
              {t("delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
