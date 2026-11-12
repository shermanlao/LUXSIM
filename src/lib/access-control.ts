/** Pure access-control policy for site admin, workspaces, and projects. */

export const AUTH_UNAUTHORIZED = "UNAUTHORIZED";
export const AUTH_FORBIDDEN = "FORBIDDEN";
export const AUTH_NOT_FOUND = "NOT_FOUND";
export const AUTH_NO_ORG = "NO_ORG";
export const AUTH_LAST_SITE_ADMIN = "LAST_SITE_ADMIN";
export const AUTH_LAST_OWNER = "LAST_OWNER";
export const AUTH_REGISTRATION_CLOSED = "REGISTRATION_CLOSED";

export type WorkspaceRole = "owner" | "member";

export function isWorkspaceRole(value: unknown): value is WorkspaceRole {
  return value === "owner" || value === "member";
}

export type SessionUserLike = {
  id: string;
  isSiteAdmin: boolean;
  disabled: boolean;
};

/** Gate for /admin pages and /api/admin/* — 401 if unsigned/disabled, 403 if not a site admin. */
export function siteAdminDecision(
  user: SessionUserLike | null | undefined
): "ok" | "unauthorized" | "forbidden" {
  if (!user || !user.id || user.disabled) return "unauthorized";
  if (!user.isSiteAdmin) return "forbidden";
  return "ok";
}

export function assertSiteAdmin(user: SessionUserLike | null | undefined): SessionUserLike {
  const decision = siteAdminDecision(user);
  if (decision === "unauthorized") throw new Error(AUTH_UNAUTHORIZED);
  if (decision === "forbidden") throw new Error(AUTH_FORBIDDEN);
  return user as SessionUserLike;
}

/**
 * Last remaining *active* site admin cannot be demoted, disabled, or deleted.
 * Disabled admins do not count — otherwise the last sign-in-able admin could disappear.
 */
export function wouldViolateLastSiteAdmin(args: {
  currentlyAdmin: boolean;
  currentlyDisabled: boolean;
  activeAdminCount: number;
  nextAdmin?: boolean;
  disabling?: boolean;
  deleting?: boolean;
}): boolean {
  const isActiveAdmin = args.currentlyAdmin && !args.currentlyDisabled;
  if (!isActiveAdmin) return false;
  if (args.activeAdminCount > 1) return false;
  if (args.deleting) return true;
  if (args.disabling === true) return true;
  if (args.nextAdmin === false) return true;
  return false;
}

export function assertNotLastSiteAdmin(args: Parameters<typeof wouldViolateLastSiteAdmin>[0]): void {
  if (wouldViolateLastSiteAdmin(args)) throw new Error(AUTH_LAST_SITE_ADMIN);
}

/** The last owner of a workspace cannot be removed or demoted to member. */
export function wouldViolateLastOwner(args: {
  currentlyOwner: boolean;
  ownerCount: number;
  nextRole?: WorkspaceRole;
  removing?: boolean;
}): boolean {
  if (!args.currentlyOwner) return false;
  if (args.ownerCount > 1) return false;
  if (args.removing) return true;
  if (args.nextRole === "member") return true;
  return false;
}

export function assertNotLastOwner(args: Parameters<typeof wouldViolateLastOwner>[0]): void {
  if (wouldViolateLastOwner(args)) throw new Error(AUTH_LAST_OWNER);
}

export function assertRegistrationOpen(publicRegistration: boolean): void {
  if (!publicRegistration) throw new Error(AUTH_REGISTRATION_CLOSED);
}

/** Credentials sign-in: disabled accounts fail the same way as a bad password. */
export function credentialsAccess(
  user: { disabled: boolean } | null | undefined,
  passwordMatches: boolean
): boolean {
  return Boolean(user && passwordMatches && !user.disabled);
}

/**
 * Project list / default designer surfaces: membership only.
 * A site admin who is not a member must not appear in someone else's project list.
 */
export function canListOrgProjects(isMember: boolean): boolean {
  return isMember;
}

/** Open or edit a project: any member of its workspace, or a site admin (support access). */
export function canOpenProject(isMember: boolean, isSiteAdmin: boolean): boolean {
  return isMember || isSiteAdmin;
}

/** Workspace-members API/page: owners of that workspace, or a site admin. */
export function canManageWorkspaceMembers(role: string | null | undefined, isSiteAdmin: boolean): boolean {
  return isSiteAdmin || role === "owner";
}

/** Header + /workspace/members: owners only (not the site-wide Admin area). */
export function canSeeWorkspaceMembersPage(isOwnerOfAnyWorkspace: boolean): boolean {
  return isOwnerOfAnyWorkspace;
}
