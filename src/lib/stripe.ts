import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not set");
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-02-24.acacia",
      typescript: true,
    });
  }
  return _stripe;
}

export const stripe = new Proxy({} as Stripe, {
  get(_t, prop) {
    return (getStripe() as never)[prop as keyof Stripe];
  },
});

// price is display-only (euros). Stripe uses priceId for the actual charge.
export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    priceId: null,
    features: ["Up to 3 projects", "Basic analytics", "Community support"],
  },
  pro: {
    name: "Pro",
    price: 19,
    priceId: process.env.STRIPE_PRO_PRICE_ID!,
    features: [
      "Unlimited projects",
      "Advanced analytics",
      "Priority support",
      "Custom domains",
      "API access",
    ],
  },
} as const;

export type Plan = keyof typeof PLANS;

// Returns an existing Stripe customer ID or creates one and links it to the DB subscription row.
export async function getOrCreateCustomer(userId: string, email: string) {
  // Dynamic import avoids a circular dependency with db.ts at module load time.
  const { db } = await import("@/lib/db");

  let subscription = await db.subscription.findUnique({
    where: { userId },
  });

  if (subscription?.stripeCustomerId) {
    return subscription.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  });

  await db.subscription.upsert({
    where: { userId },
    update: { stripeCustomerId: customer.id },
    create: {
      userId,
      stripeCustomerId: customer.id,
    },
  });

  return customer.id;
}