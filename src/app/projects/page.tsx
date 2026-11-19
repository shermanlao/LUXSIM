import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserMemberships } from "@/lib/session";
import { ProjectsListActions } from "@/components/CreateProjectButton";
import { ProjectListCard } from "@/components/ProjectListCard";

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const memberships = await getUserMemberships(session.user.id);
  const orgIds = memberships.map((m) => m.orgId);

  const projects = orgIds.length
    ? await prisma.project.findMany({
        where: { orgId: { in: orgIds } },
        orderBy: { updatedAt: "desc" },
      })
    : [];

  const workspaces = memberships.map((m) => ({
    id: m.org.id,
    name: m.org.name,
    projects: projects.filter((p) => p.orgId === m.orgId),
  }));

  return (
    <div className="projects-list-shell mx-auto max-w-7xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="display text-4xl mb-2">Projects</h1>
          <p className="text-[var(--muted)]">Single-room lighting designs with client-side calculation</p>
        </div>
        {workspaces.length > 0 && <ProjectsListActions workspaces={workspaces.map((w) => ({ id: w.id, name: w.name }))} />}
      </div>

      {workspaces.length === 0 && (
        <div className="panel p-8 text-[var(--muted)]">
          You are not in a workspace yet. Ask a workspace owner or a site administrator to add you.
        </div>
      )}

      {workspaces.map((ws) => (
        <section key={ws.id} className={workspaces.length > 1 ? "mb-10" : undefined}>
          {workspaces.length > 1 && (
            <h2 className="display text-2xl mb-4">{ws.name}</h2>
          )}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ws.projects.map((p) => (
              <ProjectListCard
                key={p.id}
                href={`/projects/${p.id}`}
                name={p.name}
                updatedLabel={new Date(p.updatedAt).toLocaleString()}
                hasResults={Boolean(p.resultsJson)}
              />
            ))}
            {ws.projects.length === 0 && (
              <div className="panel p-8 text-[var(--muted)] col-span-full">
                No projects yet. Create one to start placing luminaires.
              </div>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
