"use client";

import { useState } from "react";
import { PLANS } from "@/lib/stripe";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function BillingPage() {
  const [loading, setLoading] = useState<string | null>(null);

  async function handleUpgrade(priceId: string) {
    setLoading("upgrade");
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId }),
    });
    const data = await res.json();
    setLoading(null);
    if (data.url) window.location.href = data.url;
  }

  async function handleCancel() {
    if (!confirm("Cancel your subscription at the end of the billing period?")) return;
    setLoading("cancel");
    await fetch("/api/stripe/cancel", { method: "POST" });
    setLoading(null);
    window.location.reload();
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
        <p className="text-gray-500 mt-1">Manage your plan and payment details.</p>
      </div>

      <div className="grid gap-4">
        {Object.values(PLANS).map((plan) => (
          <Card key={plan.name}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{plan.name}</CardTitle>
                {plan.price === 0 && <Badge>Current plan</Badge>}
                {plan.price > 0 && <Badge variant="success">Recommended</Badge>}
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-3xl font-bold text-gray-900">
                    {plan.price === 0 ? "Free" : `€${plan.price}`}
                    {plan.price > 0 && (
                      <span className="text-base font-normal text-gray-500">/month</span>
                    )}
                  </p>
                  <ul className="mt-3 space-y-1">
                    {plan.features.map((f) => (
                      <li key={f} className="text-sm text-gray-600 flex items-center gap-2">
                        <span className="text-brand-500 text-xs">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="shrink-0 ml-8">
                  {plan.price > 0 && plan.priceId && (
                    <Button
                      onClick={() => handleUpgrade(plan.priceId!)}
                      loading={loading === "upgrade"}
                    >
                      Upgrade
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader>
            <CardTitle>Danger zone</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Cancel subscription</p>
                <p className="text-sm text-gray-500">
                  Your plan stays active until the end of the billing period.
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={handleCancel}
                loading={loading === "cancel"}
              >
                Cancel plan
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
