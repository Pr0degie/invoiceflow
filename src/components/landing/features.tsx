import { Zap, FileCheck, TrendingUp, Download } from "lucide-react";
import { AnimatedSection } from "@/components/landing/animated-section";

const features = [
  {
    icon: Zap,
    title: "Invoices in seconds",
    description:
      "From recipient to ready-to-send PDF — the fastest way to create an invoice. No setup, no templates to configure.",
  },
  {
    icon: FileCheck,
    title: "GoBD compliant",
    description:
      "Immutable invoice numbers, audit-proof storage, and GDPR-secure infrastructure hosted in the EU.",
  },
  {
    icon: TrendingUp,
    title: "Real-time overview",
    description:
      "Outstanding amounts, overdue invoices, and monthly revenue — visible at a glance on your dashboard.",
  },
  {
    icon: Download,
    title: "PDF export",
    description:
      "Professionally formatted PDFs, ready to send. No design work, no external tools, no extra cost.",
  },
];

export function Features() {
  return (
    <section id="features" className="py-20 md:py-28 bg-muted/30">
      <div className="container mx-auto max-w-6xl px-4">
        {/* Section header */}
        <AnimatedSection className="mb-12 md:mb-16 max-w-2xl">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            What&apos;s included
          </p>
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight leading-tight mb-4">
            Everything a freelancer actually needs
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            No bloat. Just the tools that save you time on every invoice you send.
          </p>
        </AnimatedSection>

        {/* 2×2 grid */}
        <AnimatedSection delay={100} className="grid md:grid-cols-2 gap-6 md:gap-8">
          {features.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="group rounded-xl border border-border/60 bg-card p-6 md:p-8 transition-colors hover:border-primary/40"
            >
              <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-5 transition-colors group-hover:bg-primary/15">
                <Icon className="size-5" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{title}</h3>
              <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
                {description}
              </p>
            </div>
          ))}
        </AnimatedSection>
      </div>
    </section>
  );
}
