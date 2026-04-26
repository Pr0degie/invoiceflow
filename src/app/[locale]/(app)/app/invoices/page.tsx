import { Suspense } from "react";
import { InvoiceListView } from "@/components/app/invoice-list-view";

export default function InvoicesPage() {
  return (
    <Suspense>
      <InvoiceListView />
    </Suspense>
  );
}
