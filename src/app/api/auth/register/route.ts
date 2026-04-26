import { NextRequest, NextResponse } from "next/server";
import { registerSchema } from "@/lib/validations";
import { apiClient } from "@/lib/api/client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;

    const { error, response } = await apiClient.POST("/api/auth/register", {
      body: { name, email, password },
    });

    if (error) {
      const status = response.status;
      if (status === 409) {
        return NextResponse.json(
          { error: "An account with this email already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Registration failed. Please try again." },
        { status: status >= 400 ? status : 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
