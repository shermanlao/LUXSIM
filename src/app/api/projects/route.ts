import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { defaultScene } from "@/lib/scene";
import { getUserOrgIds, requireOrgContext, requireUser } from "@/lib/session";

export async function GET() {
  try {
    const user = await requireUser();
    const orgIds = await getUserOrgIds(user.id);
    const projects = await prisma.project.findMany({
      where: { orgId: { in: orgIds } },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        orgId: true,
        createdAt: true,
        updatedAt: true,
        resultsJson: true,
        org: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(
      projects.map((p) => ({
        id: p.id,
        name: p.name,
        orgId: p.orgId,
        orgName: p.org.name,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        hasResults: Boolean(p.resultsJson),
      }))
    );
  } catch (e) {
    return apiErrorResponse(e);
  }
}

const createSchema = z.object({
  name: z.string().min(1).max(120).default("Untitled project"),
  orgId: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  try {
    const body = createSchema.parse(await req.json().catch(() => ({})));
    const { orgId } = await requireOrgContext(body.orgId);
    const project = await prisma.project.create({
      data: {
        orgId,
        name: body.name,
        sceneJson: JSON.stringify(defaultScene()),
      },
    });
    return NextResponse.json(project);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return apiErrorResponse(e);
  }
}
