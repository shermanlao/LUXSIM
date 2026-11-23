import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadAccessibleProjectMeta } from "@/lib/session";
import { CadEditorRoot } from "@/components/editor/CadEditorRoot";
import { OfficialProjectEditorLoader } from "@/components/OfficialProjectEditorLoader";

type Props = { params: Promise<{ id: string }> };

export default async function ProjectPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  const project = await loadAccessibleProjectMeta(session.user.id, id);
  if (!project) notFound();

  return (
    <CadEditorRoot>
      <OfficialProjectEditorLoader projectId={project.id} userId={session.user.id} />
    </CadEditorRoot>
  );
}
