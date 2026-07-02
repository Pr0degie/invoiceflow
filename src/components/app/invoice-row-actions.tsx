"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import {
  MoreHorizontal,
  Eye,
  Download,
  CheckCircle,
  FileCheck,
  Ban,
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
  useFinalizeInvoice,
  useCancelInvoice,
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
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const updateStatus = useUpdateInvoiceStatus();
  const deleteInvoice = useDeleteInvoice();
  const downloadPdf = useDownloadInvoicePdf();
  const finalizeInvoice = useFinalizeInvoice();
  const cancelInvoice = useCancelInvoice();

  const status = (invoice.status ?? "Draft") as InvoiceStatus;
  const isCancellation = invoice.type === "Cancellation";
  const id = invoice.id!;

  function handleFinalize() {
    finalizeInvoice.mutate(id, {
      onSuccess: (finalized) =>
        toast.success(
          t("form.success.finalized", { number: finalized.number ?? "" })
        ),
    });
    setFinalizeOpen(false);
  }

  function handleCancel() {
    cancelInvoice.mutate(id, {
      onSuccess: (storno) =>
        toast.success(t("storno.success", { number: storno.number ?? "" })),
    });
    setCancelOpen(false);
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
              downloadPdf.mutate({ id, number: invoice.number })
            }
          >
            <Download className="mr-2 size-4" />
            {t("actions.downloadPdf")}
          </DropdownMenuItem>

          {status === "Draft" && (
            <DropdownMenuItem onClick={() => setFinalizeOpen(true)}>
              <FileCheck className="mr-2 size-4" />
              {t("actions.finalize")}
            </DropdownMenuItem>
          )}
          {status === "Finalized" && !isCancellation && (
            <DropdownMenuItem onClick={() => updateStatus.mutate({ id, status: "Paid" })}>
              <CheckCircle className="mr-2 size-4" />
              {t("actions.markAsPaid")}
            </DropdownMenuItem>
          )}

          {status === "Finalized" && !isCancellation && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setCancelOpen(true)}
                className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
              >
                <Ban className="mr-2 size-4" />
                {t("actions.storno")}
              </DropdownMenuItem>
            </>
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

      <AlertDialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("form.finalize.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("form.finalize.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("form.finalize.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleFinalize}>
              {t("form.finalize.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("storno.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("storno.description", { number: invoice.number ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("storno.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-600"
            >
              {t("storno.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
