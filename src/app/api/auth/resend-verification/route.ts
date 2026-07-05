import { NextRequest, NextResponse } from "next/server";
import { resendVerificationSchema } from "@/lib/schemas/auth";
import { backendFetch } from "@/lib/api/backend-fetch";

// Anti-enumeration mirror (same reasoning as forgot-password): the backend
// always answers 200 with a generic message whether or not the address exists
// or is already verified. We surface only the rate-limit case distinctly.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = resendVerificationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const res = await backendFetch("/api/auth/resend-verification", {
      email: parsed.data.email,
    });

    if (res.status === 429) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json({ success: true }, { status: 200 });
  }
}
