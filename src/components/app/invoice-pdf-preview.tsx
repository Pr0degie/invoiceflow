"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api/errors";

// Exactly the same fetch path as the download flow (useInvoices.ts): the auth
// proxy at /api/backend injects the Bearer header from the httpOnly session
// cookie. For drafts the endpoint renders the current state (ENTWURF
// watermark), for finalized invoices it serves the archived PDF.
async function fetchPdfObjectUrl(id: string): Promise<string> {
  const response = await fetch(`/api/backend/api/invoices/${id}/pdf`);
  if (!response.ok) throw new ApiError(response.status, null);
  return URL.createObjectURL(await response.blob());
}

// iOS Safari renders PDFs inside iframes unreliably (first page only, or not
// at all). Simple switch per spec: small viewports skip the dialog and open
// the PDF in a new tab via the browser's native viewer.
const SMALL_VIEWPORT_QUERY = "(max-width: 767px)";

type PreviewTarget = { id: string; number: string | null | undefined };

/**
 * Shared PDF preview for detail view and list row actions.
 *
 * Usage: `const pdfPreview = useInvoicePdfPreview();` — call
 * `pdfPreview.preview({ id, number })` from a click handler and render
 * `{pdfPreview.dialog}` once in the component tree.
 */
export function useInvoicePdfPreview() {
  const t = useTranslations("invoices");
  const [target, setTarget] = useState<PreviewTarget | null>(null);
  const [isOpeningTab, setIsOpeningTab] = useState(false);

  const close = useCallback(() => setTarget(null), []);

  const preview = useCallback(
    async (nextTarget: PreviewTarget) => {
      if (!window.matchMedia(SMALL_VIEWPORT_QUERY).matches) {
        setTarget(nextTarget);
        return;
      }

      // Mobile fallback. window.open must run synchronously in the click
      // handler — after the awaited fetch, popup blockers would eat it.
      const tab = window.open("", "_blank");
      setIsOpeningTab(true);
      try {
        const url = await fetchPdfObjectUrl(nextTarget.id);
        if (!tab) {
          URL.revokeObjectURL(url);
          toast.error(t("preview.error"));
          return;
        }
        tab.location.href = url;
        // The object URL must outlive the new tab's load; revoke afterwards.
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } catch {
        tab?.close();
        toast.error(t("preview.error"));
      } finally {
        setIsOpeningTab(false);
      }
    },
    [t]
  );

  const dialog = (
    <InvoicePdfPreviewDialog target={target} onClose={close} />
  );

  return { preview, isPending: isOpeningTab, dialog };
}

function InvoicePdfPreviewDialog({
  target,
  onClose,
}: {
  target: PreviewTarget | null;
  onClose: () => void;
}) {
  const t = useTranslations("invoices");
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const id = target?.id ?? null;

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    let url: string | null = null;

    (async () => {
      try {
        url = await fetchPdfObjectUrl(id);
        if (cancelled) {
          // Cleanup already ran while the fetch was in flight — revoke here.
          URL.revokeObjectURL(url);
          return;
        }
        setObjectUrl(url);
      } catch {
        if (!cancelled) {
          toast.error(t("preview.error"));
          onClose();
        }
      }
    })();

    // Runs when the dialog closes (target → null) or the component unmounts:
    // no object URL leaks.
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
      setObjectUrl(null);
    };
  }, [id, t, onClose]);

  const numberLabel = target?.number ?? t("draftNumber");

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        // No description — the PDF itself is the content.
        aria-describedby={undefined}
        className="h-[90vh] w-[92vw] max-w-none grid-rows-[auto_1fr] sm:max-w-none"
      >
        <DialogHeader>
          <DialogTitle className="pr-8 font-mono tabular-nums">
            {t("preview.title", { number: numberLabel })}
          </DialogTitle>
        </DialogHeader>
        {objectUrl ? (
          <iframe
            src={objectUrl}
            title={t("preview.title", { number: numberLabel })}
            className="h-full w-full rounded-md border bg-muted"
          />
        ) : (
          <div className="flex items-center justify-center gap-2 rounded-md border bg-muted/40 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t("preview.loading")}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
