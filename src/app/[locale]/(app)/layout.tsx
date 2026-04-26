import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/login");
  }

  if ((session as { error?: string }).error === "RefreshAccessTokenError") {
    redirect("/auth/login");
  }

  const { locale } = await params;

  return (
    <AppShell
      userName={session.user.name}
      userEmail={session.user.email}
      locale={locale}
    >
      {children}
    </AppShell>
  );
}
