import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { defaultScene } from "@/lib/scene";
import { requireOrgContext } from "@/lib/session";

export async function GET() {
  try {
    const { orgId } = await requireOrgContext();
    const projects = await prisma.project.findMany({
      where: { orgId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        resultsJson: true,
      },
    });
    return NextResponse.json(
      projects.map((p) => ({
        ...p,
        hasResults: Boolean(p.resultsJson),
        resultsJson: undefined,
      }))
    );
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

const createSchema = z.object({
  name: z.string().min(1).max(120).default("Untitled project"),
});

export async function POST(req: Request) {
  try {
    const { orgId } = await requireOrgContext();
    const body = createSchema.parse(await req.json().catch(() => ({})));
    const project = await prisma.project.create({
      data: {
        orgId,
        name: body.name,
        sceneJson: JSON.stringify(defaultScene()),
      },
    });
    return NextResponse.json(project);
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
