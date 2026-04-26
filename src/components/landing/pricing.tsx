import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AnimatedSection } from "@/components/landing/animated-section";

type PlanKey = "free" | "pro" | "selfHosted";

const planMeta: Record<
  PlanKey,
  { href: string; popular: boolean; external: boolean; variant: "outline" | "default" }
> = {
  free: { href: "/auth/register", popular: false, external: false, variant: "outline" },
  pro: { href: "/auth/register", popular: true, external: false, variant: "default" },
  selfHosted: {
    href: "https://github.com/Pr0degie/invoiceflow",
    popular: false,
    external: true,
    variant: "outline",
  },
};

export async function Pricing() {
  const t = await getTranslations("landing.pricing");

  const plans = (Object.keys(planMeta) as PlanKey[]).map((key) => ({
    key,
    name: t(`plans.${key}.name`),
    description: t(`plans.${key}.description`),
    price: t(`plans.${key}.price`),
    period: key !== "selfHosted" ? t(`plans.${key}.period`) : null,
    features: t.raw(`plans.${key}.features`) as string[],
    cta: t(`plans.${key}.cta`),
    ...planMeta[key],
  }));

  return (
    <section id="pricing" className="py-20 md:py-28">
      <div className="container mx-auto max-w-6xl px-4">
        {/* Section header */}
        <AnimatedSection className="mb-12 md:mb-16 max-w-2xl">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            {t("eyebrow")}
          </p>
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight leading-tight mb-4">
            {t("title")}
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            {t("sub")}
          </p>
        </AnimatedSection>

        {/* Cards grid */}
        <AnimatedSection delay={100} className="grid md:grid-cols-3 gap-6 md:gap-8">
          {plans.map((plan) => (
            <div
              key={plan.key}
              className={cn(
                "relative flex flex-col rounded-xl p-6 md:p-8",
                plan.popular
                  ? "border-2 border-primary bg-primary/[0.03] dark:bg-primary/[0.06] shadow-xl shadow-primary/10"
                  : "border border-border/60 bg-card"
              )}
            >
              {/* Most Popular badge */}
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <Badge className="px-3 py-0.5 text-xs shadow-sm">
                    {t("mostPopular")}
                  </Badge>
                </div>
              )}

              {/* Plan header */}
              <div className="mb-6">
                <h3 className="font-semibold text-lg mb-1">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mb-5">
                  {plan.description}
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-muted-foreground text-sm">
                      {plan.period}
                    </span>
                  )}
                </div>
              </div>

              {/* Feature list */}
              <ul className="flex-1 space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2.5">
                    <Check className="size-4 text-primary shrink-0" />
                    <span className="text-sm text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link
                href={plan.href}
                className="w-full"
                {...(plan.external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                <Button variant={plan.variant} className="w-full" size="lg">
                  {plan.cta}
                </Button>
              </Link>
            </div>
          ))}
        </AnimatedSection>
      </div>
    </section>
  );
}
