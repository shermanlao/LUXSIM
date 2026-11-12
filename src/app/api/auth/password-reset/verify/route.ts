import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse } from "@/lib/api-error";
import { envMailer } from "@/lib/mailer";
import { verifyPasswordReset } from "@/lib/password-reset";
import { prismaPasswordResetStore } from "@/lib/password-reset-store";

const schema = z.object({
  email: z.string().email(),
  otp: z.string().regex(/^\d{6}$/),
  password: z.string().min(6),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const result = await verifyPasswordReset({
      email: body.email,
      otp: body.otp,
      password: body.password,
      mailer: envMailer,
      store: prismaPasswordResetStore,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return apiErrorResponse(e, "Could not reset the password just now. Please try again later.");
  }
}
