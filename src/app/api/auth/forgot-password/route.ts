import { NextRequest, NextResponse } from "next/server";
import { forgotPasswordSchema } from "@/lib/schemas/auth";
import { backendFetch } from "@/lib/api/backend-fetch";

// Anti-enumeration: this route NEVER reveals whether the address exists.
// The backend already answers 200 with a generic message for known and unknown
// addresses alike; we mirror that and collapse every non-rate-limit outcome to
// the same generic success so the UI cannot leak account state either.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const res = await backendFetch("/api/auth/forgot-password", {
      email: parsed.data.email,
    });

    if (res.status === 429) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    // 200 (expected) or any unexpected error → identical generic success.
    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    // Even on a transport failure we stay generic — no state leak.
    return NextResponse.json({ success: true }, { status: 200 });
  }
}
