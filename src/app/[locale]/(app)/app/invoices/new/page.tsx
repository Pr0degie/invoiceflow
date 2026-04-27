import { auth } from "@/lib/auth";
import { InvoiceFormCreate } from "@/components/app/invoice-form";

export default async function NewInvoicePage() {
  const session = await auth();
  return <InvoiceFormCreate userName={session?.user?.name ?? undefined} />;
}
