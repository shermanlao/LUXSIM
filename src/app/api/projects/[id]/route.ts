import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeScene, normalizeResults } from "@luxsim/project-io";
import { prisma } from "@/lib/prisma";
import { requireOrgContext } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { orgId } = await requireOrgContext();
    const { id } = await params;
    const project = await prisma.project.findFirst({
      where: { id, orgId },
      include: { assets: true },
    });
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const rawScene = JSON.parse(project.sceneJson);
    const scene = normalizeScene(rawScene);
    const results = normalizeResults(
      project.resultsJson ? JSON.parse(project.resultsJson) : null,
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
      id: project.id,
      name: project.name,
      orgId: project.orgId,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      scene,
      results,
      assets: project.assets,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  scene: z.unknown().optional(),
  results: z.unknown().nullable().optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { orgId } = await requireOrgContext();
    const { id } = await params;
    const existing = await prisma.project.findFirst({ where: { id, orgId } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { orgId } = await requireOrgContext();
    const { id } = await params;
    const existing = await prisma.project.findFirst({ where: { id, orgId } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.project.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
