import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserMemberships } from "@/lib/session";
import { CreateProjectButton } from "@/components/CreateProjectButton";

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
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="display text-4xl mb-2">Projects</h1>
          <p className="text-[var(--muted)]">Single-room lighting designs with client-side calculation</p>
        </div>
        {workspaces.length > 0 && <CreateProjectButton workspaces={workspaces.map((w) => ({ id: w.id, name: w.name }))} />}
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
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="panel p-5 hover:border-[var(--accent-2)] transition-colors"
              >
                <h2 className="display text-2xl mb-2">{p.name}</h2>
                <p className="text-sm text-[var(--muted)]">
                  Updated {new Date(p.updatedAt).toLocaleString()}
                </p>
                <p className="text-xs mt-3 text-[var(--accent-2)]">
                  {p.resultsJson ? "Has calculation results" : "Not calculated yet"}
                </p>
              </Link>
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
