"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { apiClient, bearerHeader } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { queryKeys, type InvoiceListFilters } from "@/lib/api/query-keys";
import type { components } from "@/lib/api/schema";

type Invoice = components["schemas"]["InvoiceResponse"];
type CreateInvoiceInput = components["schemas"]["CreateInvoiceRequest"];
type UpdateStatusInput = components["schemas"]["UpdateStatusRequest"];

function useToken() {
  const { data: session } = useSession();
  return (session as { accessToken?: string } | null)?.accessToken;
}

function throwOnError(
  result: { error?: unknown; response: { status: number } },
  error: unknown
) {
  if (error) throw new ApiError(result.response.status, error);
}

export function useInvoices(filters: InvoiceListFilters = {}) {
  const token = useToken();

  return useQuery({
    queryKey: queryKeys.invoices.list(filters),
    queryFn: async () => {
      const result = await apiClient.GET("/api/invoices", {
        params: { query: filters },
        headers: bearerHeader(token),
      });
      throwOnError(result, result.error);
      return result.data as Invoice[];
    },
    enabled: !!token,
    staleTime: 30_000,
  });
}

export function useInvoice(id: string) {
  const token = useToken();

  return useQuery({
    queryKey: queryKeys.invoices.detail(id),
    queryFn: async () => {
      const result = await apiClient.GET("/api/invoices/{id}", {
        params: { path: { id } },
        headers: bearerHeader(token),
      });
      throwOnError(result, result.error);
      return result.data as Invoice;
    },
    enabled: !!token && !!id,
    staleTime: 10_000,
  });
}

export function useCreateInvoice() {
  const token = useToken();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateInvoiceInput) => {
      const result = await apiClient.POST("/api/invoices", {
        body: input,
        headers: bearerHeader(token),
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
  const token = useToken();
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
        headers: bearerHeader(token),
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

export function useDeleteInvoice() {
  const token = useToken();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await apiClient.DELETE("/api/invoices/{id}", {
        params: { path: { id } },
        headers: bearerHeader(token),
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
  const token = useToken();
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
        headers: bearerHeader(token),
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
  const token = useToken();

  return useMutation({
    mutationFn: async ({ id, number }: { id: string; number: string }) => {
      const response = await fetch(
        `/api/backend/api/invoices/${id}/pdf`,
        { headers: bearerHeader(token) as HeadersInit }
      );
      if (!response.ok) throw new ApiError(response.status, null);

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: () => {
      toast.error("PDF could not be downloaded.");
    },
  });
}
