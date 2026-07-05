import { NextRequest, NextResponse } from "next/server";
import { resetPasswordSchema } from "@/lib/schemas/auth";
import { backendFetch } from "@/lib/api/backend-fetch";

// Unlike forgot-password this DOES surface distinct outcomes — the user is
// acting on a concrete token and needs to know if it is dead.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const res = await backendFetch("/api/auth/reset-password", {
      token: parsed.data.token,
      newPassword: parsed.data.newPassword,
    });

    if (res.ok) {
      // 204 No Content on success.
      return NextResponse.json({ success: true }, { status: 200 });
    }

    if (res.status === 429) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    // 400 invalid_or_expired_token (used / expired / wrong / superseded).
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
