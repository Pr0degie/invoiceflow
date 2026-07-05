import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AuthLayout } from "@/components/auth/auth-layout";
import { VerifyEmailClient } from "@/components/auth/verify-email-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "auth.verifyEmailPage",
  });
  return { title: t("title") };
}

export default async function VerifyEmailPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "auth.verifyEmailPage",
  });

  return (
    <AuthLayout heading={t("title")} subheading={t("subtitle")}>
      <Suspense>
        <VerifyEmailClient />
      </Suspense>
    </AuthLayout>
  );
}
