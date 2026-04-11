import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const features = [
  {
    title: "Authentication",
    description:
      "Email/password and GitHub OAuth out of the box, powered by NextAuth.",
  },
  {
    title: "Subscription Billing",
    description:
      "Stripe integration with checkout, webhooks, and subscription management.",
  },
  {
    title: "Role-Based Access",
    description:
      "Admin and user roles with protected routes via Next.js middleware.",
  },
  {
    title: "Database & ORM",
    description:
      "Prisma with a clean schema for users, accounts, and subscriptions.",
  },
];

const plans = [
  {
    name: "Free",
    price: "$0",
    description: "For side projects and experiments.",
    features: ["1 project", "Community support", "Basic analytics"],
    cta: "Get Started",
    href: "/auth/register",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$12",
    description: "For professionals who need more.",
    features: [
      "Unlimited projects",
      "Priority support",
      "Advanced analytics",
      "Custom domain",
    ],
    cta: "Start Free Trial",
    href: "/auth/register",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "For teams with specific needs.",
    features: [
      "Everything in Pro",
      "SSO",
      "SLA",
      "Dedicated support",
    ],
    cta: "Contact Us",
    href: "mailto:hello@example.com",
    highlight: false,
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center px-4 py-32 gap-6">
        <Badge variant="default">Open Source SaaS Starter</Badge>
        <h1 className="text-5xl font-extrabold tracking-tight max-w-2xl">
          Ship your SaaS faster
        </h1>
        <p className="text-muted-foreground text-lg max-w-xl">
          A production-ready Next.js starter with auth, billing, and admin —
          so you can focus on your product.
        </p>
        <div className="flex gap-3">
          <Link href="/auth/register">
            <Button>Get Started</Button>
          </Link>
          <Link href="/auth/login">
            <Button variant="secondary">Sign In</Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Everything you need</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {features.map((f) => (
            <Card key={f.title} className="p-6">
              <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-muted-foreground text-sm">{f.description}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-5xl mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Simple pricing</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`p-6 flex flex-col gap-4 ${plan.highlight ? "border-primary ring-1 ring-primary" : ""
                }`}
            >
              <div>
                {plan.highlight && (
                  <Badge className="mb-2">Most Popular</Badge>
                )}
                <h3 className="font-bold text-xl">{plan.name}</h3>
                <p className="text-3xl font-extrabold mt-1">
                  {plan.price}
                  {plan.price !== "Custom" && (
                    <span className="text-sm font-normal text-muted-foreground">
                      /mo
                    </span>
                  )}
                </p>
                <p className="text-muted-foreground text-sm mt-1">
                  {plan.description}
                </p>
              </div>
              <ul className="text-sm space-y-1 flex-1">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-center gap-2">
                    <span className="text-primary">✓</span> {feat}
                  </li>
                ))}
              </ul>
              <Link href={plan.href}>
                <Button variant={plan.highlight ? "primary" : "secondary"}>
                  {plan.cta}
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center text-muted-foreground text-sm py-10 border-t">
        © {new Date().getFullYear()} SaaS Starter. Built with Next.js & Stripe.
      </footer>
    </main>
  );
}