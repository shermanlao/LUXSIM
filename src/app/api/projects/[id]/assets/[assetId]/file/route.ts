import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgContext } from "@/lib/session";
import { absolutePath } from "@/lib/storage";
import fs from "fs/promises";
import path from "path";

type Params = { params: Promise<{ id: string; assetId: string }> };

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".dxf": "application/dxf",
  ".dwg": "application/acad",
  ".ifc": "application/x-step",
};

export async function GET(_req: Request, { params }: Params) {
  try {
    const { orgId } = await requireOrgContext();
    const { id, assetId } = await params;
    const project = await prisma.project.findFirst({ where: { id, orgId } });
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const asset = await prisma.projectAsset.findFirst({
      where: { id: assetId, projectId: id },
    });
    if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const full = absolutePath(asset.fileKey);
    const data = await fs.readFile(full);
    const ext = path.extname(asset.fileName).toLowerCase();
    return new NextResponse(data, {
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Content-Disposition": `inline; filename="${asset.fileName}"`,
      },
    });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
