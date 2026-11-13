import { auth } from "@/lib/auth";
import {
  AUTH_FORBIDDEN,
  AUTH_NOT_FOUND,
  AUTH_NO_ORG,
  AUTH_UNAUTHORIZED,
  assertSiteAdmin,
  canManageWorkspaceMembers,
  canOpenProject,
  type WorkspaceRole,
} from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

export type AuthedUser = {
  id: string;
  email: string;
  name: string | null;
  isSiteAdmin: boolean;
};

export async function requireUser(): Promise<AuthedUser> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error(AUTH_UNAUTHORIZED);
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, isSiteAdmin: true, disabled: true },
  });
  if (!user || user.disabled) {
    throw new Error(AUTH_UNAUTHORIZED);
  }
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isSiteAdmin: user.isSiteAdmin,
  };
}

export async function requireSiteAdmin(): Promise<AuthedUser> {
  const user = await requireUser();
  assertSiteAdmin({ id: user.id, isSiteAdmin: user.isSiteAdmin, disabled: false });
  return user;
}

/**
 * First membership by createdAt. A user may belong to several workspaces;
 * listing and access checks use every membership, not only this default.
 */
export async function getUserOrgId(userId: string): Promise<string | null> {
  const membership = await prisma.orgMember.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  return membership?.orgId ?? null;
}

export async function getUserOrgIds(userId: string): Promise<string[]> {
  const memberships = await prisma.orgMember.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { orgId: true },
  });
  return memberships.map((m) => m.orgId);
}

export async function getUserMemberships(userId: string) {
  return prisma.orgMember.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: { org: { select: { id: true, name: true } } },
  });
}

export async function getOrgMembership(orgId: string, userId: string) {
  return prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
  });
}

/** Default org is the first membership. Pass orgId to use a specific workspace the user belongs to. */
export async function requireOrgContext(orgId?: string) {
  const user = await requireUser();
  if (orgId) {
    const membership = await getOrgMembership(orgId, user.id);
    if (!membership) throw new Error(AUTH_FORBIDDEN);
    return { user, orgId, role: membership.role as WorkspaceRole };
  }
  const membership = await prisma.orgMember.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) throw new Error(AUTH_NO_ORG);
  return { user, orgId: membership.orgId, role: membership.role as WorkspaceRole };
}

/**
 * Open a project: any member of its workspace, or a site admin (support access).
 * Non-members who are not site admins get NOT_FOUND so project ids are not leaked.
 */
export async function requireProjectAccess(projectId: string) {
  const user = await requireUser();
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error(AUTH_NOT_FOUND);
  const membership = await getOrgMembership(project.orgId, user.id);
  const isMember = Boolean(membership);
  if (!canOpenProject(isMember, user.isSiteAdmin)) {
    throw new Error(AUTH_NOT_FOUND);
  }
  return {
    user,
    project,
    orgId: project.orgId,
    role: (membership?.role as WorkspaceRole | undefined) ?? null,
    viaSiteAdmin: !isMember && user.isSiteAdmin,
  };
}

export async function requireLuminaireAccess(luminaireId: string) {
  const user = await requireUser();
  const luminaire = await prisma.luminaire.findUnique({ where: { id: luminaireId } });
  if (!luminaire) throw new Error(AUTH_NOT_FOUND);
  const membership = await getOrgMembership(luminaire.orgId, user.id);
  if (!membership) throw new Error(AUTH_NOT_FOUND);
  return { user, luminaire, orgId: luminaire.orgId, role: membership.role as WorkspaceRole };
}

/** Owners of this workspace, or a site admin. */
export async function requireWorkspaceManager(orgId: string) {
  const user = await requireUser();
  const org = await prisma.org.findUnique({ where: { id: orgId } });
  if (!org) throw new Error(AUTH_NOT_FOUND);
  const membership = await getOrgMembership(orgId, user.id);
  if (!canManageWorkspaceMembers(membership?.role ?? null, user.isSiteAdmin)) {
    throw new Error(AUTH_FORBIDDEN);
  }
  return {
    user,
    org,
    orgId,
    role: (membership?.role as WorkspaceRole | undefined) ?? null,
    viaSiteAdmin: !membership && user.isSiteAdmin,
  };
}

export async function countActiveSiteAdmins(): Promise<number> {
  return prisma.user.count({ where: { isSiteAdmin: true, disabled: false } });
}

export async function countOrgOwners(orgId: string): Promise<number> {
  return prisma.orgMember.count({ where: { orgId, role: "owner" } });
}

/** Editor and project pages: membership or site-admin support access. */
export async function loadAccessibleProject(userId: string, projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { assets: true },
  });
  if (!project) return null;
  const membership = await getOrgMembership(project.orgId, userId);
  if (membership) return project;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSiteAdmin: true, disabled: true },
  });
  if (user?.isSiteAdmin && !user.disabled) return project;
  return null;
}
