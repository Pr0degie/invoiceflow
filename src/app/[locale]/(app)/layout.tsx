import { auth } from "@/lib/auth";
import { redirect } from "@/i18n/navigation";
import { AppShell } from "@/components/app/app-shell";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const session = await auth();
  const { locale } = await params;

  // Locale-aware: a /de user whose session died lands on the German login.
  // proxy.ts lets a dead session through to /auth (hasLiveSession), so this
  // redirect can't bounce back.
  if (!session?.user || session.error === "RefreshAccessTokenError") {
    return redirect({ href: "/auth/login", locale });
  }

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
