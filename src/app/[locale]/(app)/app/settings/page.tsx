import { getTranslations } from "next-intl/server";

export default async function SettingsPage() {
  const t = await getTranslations("app.pages");

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{t("settings")}</h1>
    </div>
  );
}
