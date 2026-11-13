import { prisma } from "@/lib/prisma";

export function serializeUser(user: {
  id: string;
  email: string;
  name: string | null;
  isSiteAdmin: boolean;
  disabled: boolean;
  autosaveMs: number;
  createdAt: Date;
  memberships: {
    role: string;
    org: { id: string; name: string };
  }[];
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isSiteAdmin: user.isSiteAdmin,
    disabled: user.disabled,
    autosaveMs: user.autosaveMs,
    createdAt: user.createdAt,
    workspaces: user.memberships.map((m) => ({
      orgId: m.org.id,
      name: m.org.name,
      role: m.role,
    })),
  };
}

export const userAdminInclude = {
  memberships: {
    orderBy: { createdAt: "asc" as const },
    include: { org: { select: { id: true, name: true } } },
  },
} as const;

export async function loadAdminUser(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: userAdminInclude,
  });
}
