import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeScene, normalizeResults } from "@luxsim/project-io";
import { apiErrorResponse } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { project } = await requireProjectAccess(id);
    const withAssets = await prisma.project.findFirst({
      where: { id: project.id },
      include: { assets: true },
    });
    if (!withAssets) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const rawScene = JSON.parse(withAssets.sceneJson);
    const scene = normalizeScene(rawScene);
    const results = normalizeResults(
      withAssets.resultsJson ? JSON.parse(withAssets.resultsJson) : null,
      scene
    );

    // Persist migration if needed
    if (rawScene?.version !== 2) {
      await prisma.project.update({
        where: { id },
        data: {
          sceneJson: JSON.stringify(scene),
          resultsJson: JSON.stringify(results),
        },
      });
    }

    return NextResponse.json({
      id: withAssets.id,
      name: withAssets.name,
      orgId: withAssets.orgId,
      createdAt: withAssets.createdAt,
      updatedAt: withAssets.updatedAt,
      scene,
      results,
      assets: withAssets.assets,
    });
  } catch (e) {
    return apiErrorResponse(e);
  }
}

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  scene: z.unknown().optional(),
  results: z.unknown().nullable().optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { project: existing } = await requireProjectAccess(id);

    const body = patchSchema.parse(await req.json());
    const scene =
      body.scene !== undefined ? normalizeScene(body.scene) : undefined;
    const results =
      body.results === undefined
        ? undefined
        : body.results === null
          ? { version: 2 as const, byRoomId: {} }
          : normalizeResults(body.results, scene ?? normalizeScene(JSON.parse(existing.sceneJson)));

    const project = await prisma.project.update({
      where: { id },
      data: {
        name: body.name,
        sceneJson: scene !== undefined ? JSON.stringify(scene) : undefined,
        resultsJson: results !== undefined ? JSON.stringify(results) : undefined,
      },
    });

    return NextResponse.json({
      ok: true,
      updatedAt: project.updatedAt,
    });
  } catch (e) {
    return apiErrorResponse(e);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { project: existing } = await requireProjectAccess(id);
    await prisma.project.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
