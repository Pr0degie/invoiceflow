"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { queryKeys, type InvoiceListFilters } from "@/lib/api/query-keys";
import type { components } from "@/lib/api/schema";

type Invoice = components["schemas"]["InvoiceResponse"];
type CreateInvoiceInput = components["schemas"]["CreateInvoiceRequest"];
type UpdateStatusInput = components["schemas"]["UpdateStatusRequest"];

// No tokens in the client: all calls hit the auth proxy at /api/backend,
// which injects the Bearer header from the httpOnly session cookie
// (src/app/api/backend/[...path]/route.ts). Queries only gate on the session
// status so unauthenticated mounts (e.g. /debug-api) don't fire doomed 401s.
function useAuthed() {
  const { status } = useSession();
  return status === "authenticated";
}

function throwOnError(
  result: { error?: unknown; response: { status: number } },
  error: unknown
) {
  if (error) throw new ApiError(result.response.status, error);
}

export function useInvoices(filters: InvoiceListFilters = {}) {
  const authed = useAuthed();

  return useQuery({
    queryKey: queryKeys.invoices.list(filters),
    queryFn: async () => {
      const result = await apiClient.GET("/api/invoices", {
        params: { query: filters },
      });
      throwOnError(result, result.error);
      return result.data as Invoice[];
    },
    enabled: authed,
  });
}

export function useInvoice(id: string) {
  const authed = useAuthed();

  return useQuery({
    queryKey: queryKeys.invoices.detail(id),
    queryFn: async () => {
      const result = await apiClient.GET("/api/invoices/{id}", {
        params: { path: { id } },
      });
      throwOnError(result, result.error);
      return result.data as Invoice;
    },
    enabled: authed && !!id,
    staleTime: 10_000,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateInvoiceInput) => {
      const result = await apiClient.POST("/api/invoices", {
        body: input,
      });
      throwOnError(result, result.error);
      return result.data as Invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.lists() });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: () => {
      toast.error("Invoice could not be created.");
    },
  });
}

export function useUpdateInvoiceStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: UpdateStatusInput["status"];
    }) => {
      const result = await apiClient.PATCH("/api/invoices/{id}/status", {
        params: { path: { id } },
        body: { status },
      });
      throwOnError(result, result.error);
      return result.data as Invoice;
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.invoices.detail(id),
      });
      const previous = queryClient.getQueryData(queryKeys.invoices.detail(id));
      queryClient.setQueryData(
        queryKeys.invoices.detail(id),
        (old: Invoice | undefined) => (old ? { ...old, status } : old)
      );
      return { previous };
    },
    onError: (_err, { id }, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(queryKeys.invoices.detail(id), ctx.previous);
      }
      toast.error("Status could not be updated.");
    },
    onSettled: (_data, _err, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.lists() });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

// Finalization assigns the sequential number, freezes the invoice, and archives
// its PDF — no optimistic update, the server response is the source of truth.
export function useFinalizeInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    // issueDate ("YYYY-MM-DD") overrides the Ausstellungsdatum; omitted, the
    // server stamps its own today — avoids client/server midnight skew.
    mutationFn: async ({ id, issueDate }: { id: string; issueDate?: string }) => {
      const result = await apiClient.POST("/api/invoices/{id}/finalize", {
        params: { path: { id } },
        body: issueDate ? { issueDate } : undefined,
      });
      throwOnError(result, result.error);
      return result.data as Invoice;
    },
    onSuccess: (invoice, { id }) => {
      queryClient.setQueryData(queryKeys.invoices.detail(id), invoice);
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.lists() });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (err) => {
      // 409 carries an actionable reason (incomplete tax profile, missing
      // service date) — surface it instead of a generic line.
      const body =
        err instanceof ApiError ? (err.body as { error?: string } | null) : null;
      toast.error(body?.error ?? "Invoice could not be finalized.");
    },
  });
}

// Reopen: audited exception to immutability for invoices that were NOT sent
// yet — resets Finalized → Draft. The invoice keeps its number; re-finalizing
// reuses it. No optimistic update: the server enforces the guards (400/409).
export function useReopenInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await apiClient.POST("/api/invoices/{id}/reopen", {
        params: { path: { id } },
      });
      throwOnError(result, result.error);
      return result.data as Invoice;
    },
    onSuccess: (invoice, id) => {
      queryClient.setQueryData(queryKeys.invoices.detail(id), invoice);
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.lists() });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (err) => {
      const body =
        err instanceof ApiError ? (err.body as { error?: string } | null) : null;
      toast.error(body?.error ?? "Invoice could not be reopened.");
    },
  });
}

// Storno: issues a reversing Cancellation invoice and sets the original to
// Cancelled. Returns the Stornorechnung.
export function useCancelInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await apiClient.POST("/api/invoices/{id}/cancel", {
        params: { path: { id } },
      });
      throwOnError(result, result.error);
      return result.data as Invoice;
    },
    onSuccess: (_storno, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.lists() });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (err) => {
      const body =
        err instanceof ApiError ? (err.body as { error?: string } | null) : null;
      toast.error(body?.error ?? "Invoice could not be cancelled.");
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await apiClient.DELETE("/api/invoices/{id}", {
        params: { path: { id } },
      });
      throwOnError(result, result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.lists() });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError && err.isConflict
          ? "Only draft invoices can be deleted."
          : "Invoice could not be deleted.";
      toast.error(msg);
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: CreateInvoiceInput;
    }) => {
      const result = await apiClient.PUT("/api/invoices/{id}", {
        params: { path: { id } },
        body: data,
      });
      throwOnError(result, result.error);
      return result.data as Invoice;
    },
    onSuccess: (updatedInvoice, { id }) => {
      queryClient.setQueryData(queryKeys.invoices.detail(id), updatedInvoice);
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.lists() });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError && err.isConflict
          ? "Only draft invoices can be edited."
          : "Invoice could not be saved.";
      toast.error(msg);
    },
  });
}

export function useDownloadInvoicePdf() {
  return useMutation({
    mutationFn: async ({ id, number }: { id: string; number: string | null | undefined }) => {
      // Auth happens in the proxy — the browser only sends the session cookie.
      const response = await fetch(`/api/backend/api/invoices/${id}/pdf`);
      if (!response.ok) throw new ApiError(response.status, null);

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${number ?? "Entwurf"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: () => {
      toast.error("PDF could not be downloaded.");
    },
  });
}

export function useDownloadInvoiceXml() {
  return useMutation({
    mutationFn: async ({ id, number }: { id: string; number: string | null | undefined }) => {
      const response = await fetch(`/api/backend/api/invoices/${id}/xml`);
      if (!response.ok) throw new ApiError(response.status, null);

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${number ?? "Entwurf"}.xml`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: () => {
      toast.error("E-Rechnung (XML) could not be downloaded.");
    },
  });
}
