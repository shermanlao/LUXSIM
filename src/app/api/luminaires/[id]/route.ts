import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgContext } from "@/lib/session";
import { readTextFile } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { orgId } = await requireOrgContext();
    const { id } = await params;
    const luminaire = await prisma.luminaire.findFirst({
      where: { id, orgId },
    });
    if (!luminaire) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const photometric = JSON.parse(luminaire.photometricJson);
    let sourceText: string | null = null;
    try {
      sourceText = await readTextFile(luminaire.fileKey);
    } catch {
      sourceText = null;
    }
    return NextResponse.json({ ...luminaire, photometric, sourceText });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { orgId } = await requireOrgContext();
    const { id } = await params;
    const existing = await prisma.luminaire.findFirst({ where: { id, orgId } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await prisma.luminaire.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
