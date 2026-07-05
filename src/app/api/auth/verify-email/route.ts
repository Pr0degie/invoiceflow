import { NextRequest, NextResponse } from "next/server";
import { verifyEmailSchema } from "@/lib/schemas/auth";
import { apiClient } from "@/lib/api/client";

// Consumes the verification token. Distinct outcomes are intentional here —
// the token is opaque, so success/failure reveals nothing about which address
// it belonged to.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = verifyEmailSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { response } = await apiClient.POST("/api/auth/verify-email", {
      body: { token: parsed.data.token },
    });

    if (response.ok) {
      // 204 No Content on success.
      return NextResponse.json({ success: true }, { status: 200 });
    }

    if (response.status === 429) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    // 400 invalid_or_expired_token.
    return NextResponse.json(
      { error: "invalid_or_expired_token" },
      { status: 400 }
    );
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
