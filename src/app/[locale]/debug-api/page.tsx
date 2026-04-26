import { redirect } from "next/navigation";
import { DebugApiClient } from "./debug-client";

export default function DebugApiPage() {
  if (process.env.NODE_ENV !== "development") {
    redirect("/");
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold mb-2">API Debug</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Development only — not accessible in production.
      </p>
      <DebugApiClient />
    </div>
  );
}
