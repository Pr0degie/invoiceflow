import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";

const avatars = [
  { initial: "T", bg: "bg-indigo-500" },
  { initial: "A", bg: "bg-violet-500" },
  { initial: "M", bg: "bg-sky-500" },
  { initial: "J", bg: "bg-emerald-500" },
];

export function Hero() {
  return (
    <section className="relative flex flex-col items-center justify-center text-center px-4 pt-24 pb-16 md:pt-32 md:pb-20 lg:pt-40 lg:pb-24 overflow-hidden">
      {/* Dot grid — light mode */}
      <div
        className="absolute inset-0 -z-10 dark:hidden"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(0,0,0,0.07) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      {/* Dot grid — dark mode */}
      <div
        className="absolute inset-0 -z-10 hidden dark:block"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      {/* Radial vignette: fades dot grid into bg at edges */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 50%, transparent 30%, var(--color-background) 90%)",
        }}
      />

      {/* Eyebrow badge */}
      <Badge
        variant="outline"
        className="h-7 px-3 text-xs rounded-full gap-2 mb-8"
      >
        <span className="size-1.5 rounded-full bg-green-500" />
        Open Source SaaS Starter
      </Badge>

      {/* Headline */}
      <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] max-w-3xl mb-6">
        Ship your SaaS{" "}
        <span
          style={{
            backgroundImage:
              "linear-gradient(135deg, var(--color-primary) 0%, #8b5cf6 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          faster
        </span>
      </h1>

      {/* Sub-headline */}
      <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10">
        A production-ready Next.js starter with auth, billing, and admin —{" "}
        so you can focus on your product.
      </p>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-3 mb-10">
        <Link href="/auth/register">
          <Button
            size="lg"
            className="h-11 px-6 text-base gap-2"
          >
            Get Started
            <ArrowRight className="size-4" />
          </Button>
        </Link>
        <Link href="/auth/login">
          <Button
            variant="outline"
            size="lg"
            className="h-11 px-6 text-base"
          >
            Sign In
          </Button>
        </Link>
      </div>

      {/* Social proof */}
      <div className="flex items-center gap-2.5 text-sm text-muted-foreground mb-14">
        <div className="flex -space-x-2">
          {avatars.map(({ initial, bg }) => (
            <div
              key={initial}
              className={`size-7 rounded-full ${bg} border-2 border-background flex items-center justify-center text-xs font-semibold text-white`}
            >
              {initial}
            </div>
          ))}
        </div>
        <span>Used by developers worldwide</span>
      </div>

      {/* Terminal mockup */}
      <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl overflow-hidden text-left">
        {/* Window chrome */}
        <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border bg-muted/40">
          <div className="size-3 rounded-full bg-red-400/80" />
          <div className="size-3 rounded-full bg-yellow-400/80" />
          <div className="size-3 rounded-full bg-green-400/80" />
          <span className="ml-2 text-xs text-muted-foreground font-mono select-none">
            ~/projects
          </span>
        </div>
        {/* Terminal body */}
        <div className="px-5 py-5 font-mono text-sm space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-primary select-none">$</span>
            <span className="text-foreground">npx create-next-app</span>
            <span className="text-muted-foreground">-e</span>
            <span className="text-emerald-500 dark:text-emerald-400 break-all">
              github.com/Pr0degie/saas-starter
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="text-emerald-500 dark:text-emerald-400">✓</span>
            <span>Fetching template...</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="text-emerald-500 dark:text-emerald-400">✓</span>
            <span>Installing dependencies</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="text-emerald-500 dark:text-emerald-400">✓</span>
            <span>Ready in 3.2s</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm mt-1">
            <span className="text-primary select-none">$</span>
            <span
              className="inline-block w-[7px] h-[1em] bg-primary"
              style={{ animation: "blink 1.2s step-end infinite" }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
