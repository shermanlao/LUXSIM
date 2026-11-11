import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserOrgId } from "@/lib/session";
import { parseProjectResults, parseProjectScene } from "@/lib/project-scene";
import { BuildingEditor } from "@/components/editor/BuildingEditor";

type Props = { params: Promise<{ id: string }> };

export default async function ProjectPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const orgId = await getUserOrgId(session.user.id);
  if (!orgId) redirect("/login");

  const { id } = await params;
  const [project, org] = await Promise.all([
    prisma.project.findFirst({
      where: { id, orgId },
      include: { assets: true },
    }),
    prisma.org.findUnique({ where: { id: orgId }, select: { name: true } }),
  ]);
  if (!project) notFound();

  const scene = parseProjectScene(project.sceneJson);
  const results = parseProjectResults(project.resultsJson, scene);

  // Persist migration if still v1 on disk
  if (!project.sceneJson.includes('"version":2')) {
    await prisma.project.update({
      where: { id },
      data: {
        sceneJson: JSON.stringify(scene),
        resultsJson: JSON.stringify(results),
      },
    });
  }

  return (
    <BuildingEditor
      projectId={project.id}
      initialName={project.name}
      initialOrgName={org?.name ?? null}
      initialScene={scene}
      initialResults={results}
      initialAssets={project.assets.map((a) => ({
        id: a.id,
        kind: a.kind,
        fileName: a.fileName,
        metaJson: a.metaJson,
      }))}
    />
  );
}
