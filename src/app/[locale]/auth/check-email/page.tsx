import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AuthLayout } from "@/components/auth/auth-layout";
import { CheckEmailClient } from "@/components/auth/check-email-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "auth.checkEmailPage",
  });
  return { title: t("title") };
}

export default async function CheckEmailPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "auth.checkEmailPage",
  });

  return (
    <AuthLayout heading={t("title")} subheading={t("subtitle")}>
      <Suspense>
        <CheckEmailClient />
      </Suspense>
    </AuthLayout>
  );
}
