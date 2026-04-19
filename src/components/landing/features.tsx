import { ShieldCheck, CreditCard, Users, Database } from "lucide-react";
import { AnimatedSection } from "@/components/landing/animated-section";

const features = [
  {
    icon: ShieldCheck,
    title: "Authentication",
    description:
      "Email/password and GitHub OAuth out of the box. Session management, protected routes, and role checks — all wired up via NextAuth.",
  },
  {
    icon: CreditCard,
    title: "Subscription Billing",
    description:
      "Stripe checkout, webhooks, and subscription lifecycle handled for you. Free and Pro plans ready to go — just swap in your price IDs.",
  },
  {
    icon: Users,
    title: "Role-Based Access",
    description:
      "Admin and user roles enforced at the middleware level. Lock down routes and UI without touching every page manually.",
  },
  {
    icon: Database,
    title: "Database & ORM",
    description:
      "Prisma with a clean schema covering users, accounts, and subscriptions. One command to migrate, one to seed.",
  },
];

export function Features() {
  return (
    <section id="features" className="py-20 md:py-28 bg-muted/30">
      <div className="container mx-auto max-w-6xl px-4">
        {/* Section header — left-aligned */}
        <AnimatedSection className="mb-12 md:mb-16 max-w-2xl">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            What's included
          </p>
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight leading-tight mb-4">
            Everything you need to ship
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Skip the boilerplate. Auth, billing, and access control are already
            built — so your first commit can be product code.
          </p>
        </AnimatedSection>

        {/* 2×2 grid */}
        <AnimatedSection delay={100} className="grid md:grid-cols-2 gap-6 md:gap-8">
          {features.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="group rounded-xl border border-border/60 bg-card p-6 md:p-8 transition-colors hover:border-primary/40"
            >
              {/* Icon container */}
              <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-5 transition-colors group-hover:bg-primary/15">
                <Icon className="size-5" />
              </div>

              <h3 className="font-semibold text-lg mb-2">{title}</h3>
              <p className="text-muted-foreground text-sm md:text-base leading-relaxed" spellCheck={false}>
                {description}
              </p>
            </div>
          ))}
        </AnimatedSection>
      </div>
    </section>
  );
}
