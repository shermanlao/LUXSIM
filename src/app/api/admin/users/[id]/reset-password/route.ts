import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { loadAdminUser, serializeUser } from "@/lib/admin-users";
import { apiErrorResponse } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { requireSiteAdmin } from "@/lib/session";
import { generateTemporaryPassword } from "@/lib/temporary-password";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  try {
    await requireSiteAdmin();
    const { id } = await params;
    const user = await loadAdminUser(id);
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    await prisma.user.update({ where: { id }, data: { passwordHash } });

    return NextResponse.json({
      ...serializeUser(user),
      temporaryPassword,
    });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
