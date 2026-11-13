import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import { requireProjectAccess } from "@/lib/session";
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
    const { id, assetId } = await params;
    const { project } = await requireProjectAccess(id);
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
    const authRes = apiErrorResponse(e);
    if (authRes.status !== 500) return authRes;
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
