import { Suspense } from "react";
import { SettingsView } from "@/components/app/settings-view";

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsView />
    </Suspense>
  );
}
