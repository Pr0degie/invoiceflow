import { headers } from "next/headers";
import { readApiToken } from "@/lib/auth/api-token";
import { apiClient, bearerHeader } from "@/lib/api/client";
import { InvoiceFormCreate } from "@/components/app/invoice-form";

export default async function NewInvoicePage() {
  // Server component: read the invoice-api token from the server-only JWT
  // (it is no longer exposed on the session) and call the backend directly.
  const token = await readApiToken(await headers());

  let defaults: { senderName?: string; senderAddress?: string } = {};

  if (token) {
    const { data } = await apiClient.GET("/api/auth/me", {
      headers: bearerHeader(token),
    });
    if (data) {
      defaults = {
        senderName: data.defaultSenderName ?? data.name ?? undefined,
        senderAddress: data.defaultSenderAddress ?? undefined,
      };
    }
  }

  return <InvoiceFormCreate defaults={defaults} />;
}
