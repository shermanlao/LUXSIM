import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserOrgId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { parseProjectScene } from "@/lib/project-scene";
import { buildDialuxEvo, defaultEvoFixtureRoot } from "@luxsim/project-io";

type Props = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Props) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const orgId = await getUserOrgId(session.user.id);
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, orgId },
    select: { name: true, sceneJson: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const scene = parseProjectScene(project.sceneJson);
  try {
    const { blob, warnings } = await buildDialuxEvo({
      projectName: project.name,
      scene: scene as never,
      fixtureRoot: defaultEvoFixtureRoot(),
      description: `${project.name} exported from LUXSIM (evo 12.1 geometry pack; luminaire IES encoding not yet implemented).`,
    });
    const buf = Buffer.from(await blob.arrayBuffer());
    const filename = `${project.name.replace(/[^\w\-]+/g, "_")}.evo`;
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Luxsim-Evo-Warnings": warnings.join(" | "),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Export failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
