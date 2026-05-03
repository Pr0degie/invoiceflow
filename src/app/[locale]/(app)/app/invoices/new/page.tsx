import { auth } from "@/lib/auth";
import { apiClient, bearerHeader } from "@/lib/api/client";
import { InvoiceFormCreate } from "@/components/app/invoice-form";

export default async function NewInvoicePage() {
  const session = await auth();
  const token = (session as { accessToken?: string } | null)?.accessToken;

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
