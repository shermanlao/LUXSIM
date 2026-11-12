import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canSeeWorkspaceMembersPage } from "@/lib/access-control";
import { getUserMemberships } from "@/lib/session";
import { WorkspaceMembersClient } from "@/components/WorkspaceMembersClient";

export default async function WorkspaceMembersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/workspace/members");
  const memberships = await getUserMemberships(session.user.id);
  const owned = memberships.filter((m) => m.role === "owner").map((m) => ({ id: m.org.id, name: m.org.name }));
  if (!canSeeWorkspaceMembersPage(owned.length > 0)) redirect("/projects");
  return <WorkspaceMembersClient initialWorkspaces={owned} />;
}
