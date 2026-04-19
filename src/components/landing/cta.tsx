import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AnimatedSection } from "@/components/landing/animated-section";

export function CTA() {
  return (
    <section className="relative py-20 md:py-28 overflow-hidden bg-primary">
      {/* Subtle dot grid on primary bg */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      {/* Radial vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 50%, transparent 30%, oklch(0.511 0.262 276.9 / 0.9) 90%)",
        }}
      />

      <AnimatedSection className="relative container mx-auto max-w-3xl px-4 text-center">
        <h2 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight text-white mb-4">
          Start shipping today.
        </h2>
        <p className="text-lg text-white/70 mb-8">
          Your SaaS foundation is one command away. Auth, billing, and admin —
          ready to go.
        </p>
        <Link href="/auth/register">
          <button className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-6 py-3 text-base font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20">
            Get Started Free
            <ArrowRight className="size-4" />
          </button>
        </Link>
      </AnimatedSection>
    </section>
  );
}
