import { prisma } from "@/lib/prisma";
import { publicShareAllowed } from "@/lib/project-share";

export async function loadPublicShareByToken(token: string) {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const project = await prisma.project.findFirst({
    where: { shareToken: trimmed },
    include: {
      assets: true,
      org: {
        include: {
          members: {
            where: { role: "owner" },
            include: { user: { select: { shareLinksEnabled: true } } },
          },
        },
      },
    },
  });
  if (!project) return null;
  const allowed = publicShareAllowed({
    projectShareEnabled: project.shareEnabled,
    ownerShareLinksEnabled: project.org.members.map((m) => m.user.shareLinksEnabled),
  });
  if (!allowed) return null;
  return project;
}

export async function ensureProjectShareToken(projectId: string): Promise<string> {
  const { newShareToken } = await import("@/lib/project-share");
  const existing = await prisma.project.findUnique({
    where: { id: projectId },
    select: { shareToken: true },
  });
  if (existing?.shareToken) return existing.shareToken;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = newShareToken();
    try {
      const updated = await prisma.project.update({
        where: { id: projectId },
        data: { shareToken: token },
        select: { shareToken: true },
      });
      if (updated.shareToken) return updated.shareToken;
    } catch {
      /* unique collision — retry */
    }
  }
  throw new Error("Could not allocate a share token");
}
