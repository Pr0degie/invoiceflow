"use client";

import { useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { useInvoices } from "@/lib/api/hooks/useInvoices";
import { useStats } from "@/lib/api/hooks/useStats";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function DebugApiClient() {
  const { data: session, status } = useSession();
  const [email, setEmail] = useState("demo@invoiceflow.app");
  const [password, setPassword] = useState("Demo1234!");
  const [loginError, setLoginError] = useState("");

  const invoicesQuery = useInvoices();
  const statsQuery = useStats();

  async function handleLogin() {
    setLoginError("");
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (res?.error) setLoginError("Login failed: " + res.error);
  }

  const token = (session as { accessToken?: string } | null)?.accessToken;

  return (
    <div className="space-y-6">
      {/* Session state */}
      <Card className="p-4 space-y-2">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Session</p>
        <p className="text-sm">Status: <strong>{status}</strong></p>
        {session?.user && (
          <p className="text-sm">User: {session.user.email}</p>
        )}
        {token && (
          <p className="text-xs font-mono break-all text-green-600 dark:text-green-400">
            Token: {token.slice(0, 40)}…
          </p>
        )}
        {(session as { error?: string } | null)?.error && (
          <p className="text-sm text-red-500">
            ⚠ {(session as { error?: string }).error}
          </p>
        )}
      </Card>

      {/* Login */}
      {status !== "authenticated" && (
        <Card className="p-4 space-y-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Login</p>
          <input
            className="w-full text-sm border rounded px-3 py-2 bg-background"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
          />
          <input
            className="w-full text-sm border rounded px-3 py-2 bg-background"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
          />
          <Button size="sm" onClick={handleLogin}>Sign in</Button>
          {loginError && <p className="text-xs text-red-500">{loginError}</p>}
        </Card>
      )}

      {status === "authenticated" && (
        <Button size="sm" variant="outline" onClick={() => signOut()}>
          Sign out
        </Button>
      )}

      {/* Invoices */}
      <Card className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Invoices ({invoicesQuery.data?.length ?? "—"})
          </p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => invoicesQuery.refetch()}
            disabled={invoicesQuery.isFetching}
          >
            {invoicesQuery.isFetching ? "Fetching…" : "Refetch"}
          </Button>
        </div>
        {invoicesQuery.error && (
          <p className="text-xs text-red-500">{String(invoicesQuery.error)}</p>
        )}
        <pre className="text-xs bg-muted/50 rounded p-3 overflow-auto max-h-48">
          {JSON.stringify(invoicesQuery.data?.slice(0, 3), null, 2) ?? "—"}
        </pre>
      </Card>

      {/* Stats */}
      <Card className="p-4 space-y-2">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Stats</p>
        {statsQuery.error && (
          <p className="text-xs text-red-500">{String(statsQuery.error)}</p>
        )}
        <pre className="text-xs bg-muted/50 rounded p-3 overflow-auto max-h-48">
          {JSON.stringify(statsQuery.data, null, 2) ?? "—"}
        </pre>
      </Card>
    </div>
  );
}
