import { NextResponse } from "next/server";
import fs from "fs/promises";
import { parseProjectScene } from "@/lib/project-scene";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import { requireProjectAccess } from "@/lib/session";
import { absolutePath } from "@/lib/storage";
import { detectRcpFromImageBuffer } from "@/lib/rcp-ocr";
import type { ProjectSceneV2, Underlay } from "@luxsim/project-io";

type Params = { params: Promise<{ id: string }> };

function findUnderlay(scene: ProjectSceneV2, underlayId?: string): Underlay | null {
  if (underlayId) {
    return scene.underlays.find((u) => u.id === underlayId) ?? null;
  }
  return scene.underlays.find((u) => u.storeyId === scene.ui.activeStoreyId) ?? null;
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { id: projectId } = await params;
    const { project } = await requireProjectAccess(projectId);

    const body = (await req.json().catch(() => ({}))) as {
      underlayId?: string;
      confidenceMin?: number;
      allowCloud?: boolean;
    };

    const scene = parseProjectScene(project.sceneJson);
    const underlay = findUnderlay(scene, body.underlayId);
    if (!underlay) {
      return NextResponse.json({ error: "No plan underlay on this storey" }, { status: 400 });
    }
    const rasterId =
      underlay.pageRasterAssetId ?? (underlay.kind === "image" ? underlay.assetId : null);
    if (!rasterId) {
      return NextResponse.json(
        { error: "Underlay has no raster image — re-import PDF or use PNG/JPG plan" },
        { status: 400 }
      );
    }

    const asset = await prisma.projectAsset.findFirst({
      where: { id: rasterId, projectId },
    });
    if (!asset) {
      return NextResponse.json({ error: "Raster asset missing" }, { status: 404 });
    }

    const image = await fs.readFile(absolutePath(asset.fileKey));
    const { proposals, warnings } = await detectRcpFromImageBuffer(image, {
      underlay,
      underlayId: underlay.id,
      confidenceMin: body.confidenceMin,
      allowCloud: body.allowCloud,
    });

    return NextResponse.json({
      proposals,
      warnings,
      privacyMode: "local",
    });
  } catch (e) {
    const authRes = apiErrorResponse(e);
    if (authRes.status !== 500) return authRes;
    if (e instanceof Error && e.message.includes("Cloud vision")) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "RCP detect failed" }, { status: 500 });
  }
}
