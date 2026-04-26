import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await auth();
  const subscription = await db.subscription.findUnique({
    where: { userId: session!.user.id },
  });

  const isActive =
    subscription?.status === "ACTIVE" || subscription?.status === "TRIALING";

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Good to see you, {session!.user.name?.split(" ")[0] ?? "there"} 👋
        </h1>
        <p className="text-gray-500 mt-1">
          Here&apos;s what&apos;s going on with your account.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Subscription</CardTitle>
            <Badge variant={isActive ? "success" : "default"}>
              {isActive ? "Active" : "Free tier"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isActive ? (
            <div className="space-y-1 text-sm text-gray-600">
              <p>
                You&apos;re on the{" "}
                <span className="font-medium text-gray-900">Pro plan</span>.
              </p>
              {subscription?.cancelAtPeriodEnd && (
                <p className="text-yellow-700">
                  Your subscription will cancel on{" "}
                  {formatDate(subscription.currentPeriodEnd!)}.
                </p>
              )}
              <p className="pt-2">
                Manage your billing in the{" "}
                <a href="/dashboard/billing" className="text-brand-600 hover:underline">
                  Billing
                </a>{" "}
                section.
              </p>
            </div>
          ) : (
            <div className="text-sm text-gray-600 space-y-3">
              <p>You&apos;re on the free tier. Upgrade to unlock all features.</p>
              <a
                href="/dashboard/billing"
                className="inline-flex items-center px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
              >
                Upgrade to Pro
              </a>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
