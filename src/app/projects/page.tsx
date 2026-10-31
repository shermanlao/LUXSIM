import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserOrgId } from "@/lib/session";
import { CreateProjectButton } from "@/components/CreateProjectButton";

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const orgId = await getUserOrgId(session.user.id);
  if (!orgId) redirect("/login");

  const projects = await prisma.project.findMany({
    where: { orgId },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="display text-4xl mb-2">Projects</h1>
          <p className="text-[var(--muted)]">Single-room lighting designs with client-side calculation</p>
        </div>
        <CreateProjectButton />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((p) => (
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
        {projects.length === 0 && (
          <div className="panel p-8 text-[var(--muted)] col-span-full">
            No projects yet. Create one to start placing luminaires.
          </div>
        )}
      </div>
    </div>
  );
}
