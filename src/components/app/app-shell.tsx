import { AppSidebar } from "./sidebar";
import { Topbar } from "./topbar";

interface AppShellProps {
  children: React.ReactNode;
  userName?: string | null;
  userEmail?: string | null;
  locale: string;
}

export function AppShell({ children, userName, userEmail, locale }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar userName={userName} userEmail={userEmail} locale={locale} />
      <div className="flex flex-1 flex-col min-w-0">
        <Topbar locale={locale} userName={userName} userEmail={userEmail} />
        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
