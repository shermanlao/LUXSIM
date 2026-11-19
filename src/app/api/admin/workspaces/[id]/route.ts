import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { requireSiteAdmin } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  try {
    await requireSiteAdmin();
    const { id } = await params;
    const org = await prisma.org.findUnique({ where: { id } });
    if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.org.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
