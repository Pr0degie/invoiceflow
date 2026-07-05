import { NextRequest, NextResponse } from "next/server";
import { resendVerificationSchema } from "@/lib/schemas/auth";
import { apiClient } from "@/lib/api/client";

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

    const { response } = await apiClient.POST("/api/auth/resend-verification", {
      body: { email: parsed.data.email, locale: parsed.data.locale },
    });

    if (response.status === 429) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json({ success: true }, { status: 200 });
  }
}
