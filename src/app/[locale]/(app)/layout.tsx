import { getSessionUser } from "@/lib/auth/server-session";
import { redirect } from "@/i18n/navigation";
import { AppShell } from "@/components/app/app-shell";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const user = await getSessionUser();
  const { locale } = await params;

  // proxy.ts already sends dead sessions to the login; this is the backstop
  // should a request ever reach the layout without passing it. Locale-aware,
  // and no bounce: the proxy lets a dead session through to /auth.
  if (!user) {
    return redirect({ href: "/auth/login", locale });
  }

  return (
    <AppShell
      userName={user.name}
      userEmail={user.email}
      locale={locale}
    >
      {children}
    </AppShell>
  );
}
