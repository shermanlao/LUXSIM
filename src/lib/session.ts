import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("UNAUTHORIZED");
  }
  return session.user;
}

export async function getUserOrgId(userId: string): Promise<string | null> {
  const membership = await prisma.orgMember.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  return membership?.orgId ?? null;
}

export async function requireOrgContext() {
  const user = await requireUser();
  const orgId = await getUserOrgId(user.id!);
  if (!orgId) throw new Error("NO_ORG");
  return { user, orgId };
}
