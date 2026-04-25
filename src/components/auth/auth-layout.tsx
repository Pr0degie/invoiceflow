import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/brand/logo";

interface Props {
  children: React.ReactNode;
  heading: string;
  subheading: string;
}

export function AuthLayout({ children, heading, subheading }: Props) {
  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-16 bg-background overflow-hidden">
      {/* Dot grid — light */}
      <div
        className="absolute inset-0 dark:hidden"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      {/* Dot grid — dark */}
      <div
        className="absolute inset-0 hidden dark:block"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      {/* Radial fade */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 70% at 50% 50%, transparent 20%, var(--color-background) 80%)",
        }}
      />

      {/* Theme toggle — top right */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      {/* Back to home — top left */}
      <div className="absolute top-4 left-4">
        <Link href="/">
          <Logo size="default" />
        </Link>
      </div>

      {/* Card */}
      <div className="relative w-full max-w-[400px]">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
          <p className="text-sm text-muted-foreground mt-1">{subheading}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-6 md:p-8 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
