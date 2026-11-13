import { describe, expect, it } from "vitest";
import {
  assertNotLastOwner,
  assertNotLastSiteAdmin,
  assertRegistrationOpen,
  assertSiteAdmin,
  canListOrgProjects,
  canManageWorkspaceMembers,
  canOpenProject,
  canSeeWorkspaceMembersPage,
  credentialsAccess,
  isWorkspaceRole,
  siteAdminDecision,
  wouldViolateLastOwner,
  wouldViolateLastSiteAdmin,
} from "./access-control";

describe("requireSiteAdmin / siteAdminDecision", () => {
  const admin = { id: "u1", isSiteAdmin: true, disabled: false };
  const designer = { id: "u2", isSiteAdmin: false, disabled: false };

  it("allows an active site admin", () => {
    expect(siteAdminDecision(admin)).toBe("ok");
    expect(assertSiteAdmin(admin)).toEqual(admin);
  });

  it("returns unauthorized when unsigned or disabled", () => {
    expect(siteAdminDecision(null)).toBe("unauthorized");
    expect(siteAdminDecision(undefined)).toBe("unauthorized");
    expect(siteAdminDecision({ id: "", isSiteAdmin: true, disabled: false })).toBe("unauthorized");
    expect(siteAdminDecision({ ...admin, disabled: true })).toBe("unauthorized");
    expect(() => assertSiteAdmin(null)).toThrow("UNAUTHORIZED");
    expect(() => assertSiteAdmin({ ...admin, disabled: true })).toThrow("UNAUTHORIZED");
  });

  it("returns forbidden for a signed-in non-admin", () => {
    expect(siteAdminDecision(designer)).toBe("forbidden");
    expect(() => assertSiteAdmin(designer)).toThrow("FORBIDDEN");
  });
});

describe("last-admin protection", () => {
  const last = {
    currentlyAdmin: true,
    currentlyDisabled: false,
    activeAdminCount: 1,
  };

  it("blocks demoting, disabling, or deleting the last active site admin", () => {
    expect(wouldViolateLastSiteAdmin({ ...last, nextAdmin: false })).toBe(true);
    expect(wouldViolateLastSiteAdmin({ ...last, disabling: true })).toBe(true);
    expect(wouldViolateLastSiteAdmin({ ...last, deleting: true })).toBe(true);
    expect(() => assertNotLastSiteAdmin({ ...last, nextAdmin: false })).toThrow("LAST_SITE_ADMIN");
  });

  it("allows changes when another active admin remains", () => {
    const two = { ...last, activeAdminCount: 2 };
    expect(wouldViolateLastSiteAdmin({ ...two, nextAdmin: false })).toBe(false);
    expect(wouldViolateLastSiteAdmin({ ...two, disabling: true })).toBe(false);
  });

  it("does not count a disabled admin as the last admin, and ignores non-admins", () => {
    expect(
      wouldViolateLastSiteAdmin({
        currentlyAdmin: true,
        currentlyDisabled: true,
        activeAdminCount: 0,
        nextAdmin: false,
      })
    ).toBe(false);
    expect(
      wouldViolateLastSiteAdmin({
        currentlyAdmin: false,
        currentlyDisabled: false,
        activeAdminCount: 1,
        disabling: true,
      })
    ).toBe(false);
  });

  it("allows leaving the last admin as an admin", () => {
    expect(wouldViolateLastSiteAdmin({ ...last, nextAdmin: true })).toBe(false);
    expect(wouldViolateLastSiteAdmin({ ...last, disabling: false })).toBe(false);
  });
});

describe("last-owner protection", () => {
  it("blocks removing or demoting the last workspace owner", () => {
    expect(wouldViolateLastOwner({ currentlyOwner: true, ownerCount: 1, removing: true })).toBe(true);
    expect(wouldViolateLastOwner({ currentlyOwner: true, ownerCount: 1, nextRole: "member" })).toBe(true);
    expect(() =>
      assertNotLastOwner({ currentlyOwner: true, ownerCount: 1, removing: true })
    ).toThrow("LAST_OWNER");
  });

  it("allows removing or demoting when another owner remains", () => {
    expect(wouldViolateLastOwner({ currentlyOwner: true, ownerCount: 2, removing: true })).toBe(false);
    expect(wouldViolateLastOwner({ currentlyOwner: true, ownerCount: 2, nextRole: "member" })).toBe(false);
  });

  it("ignores members and allows keeping owner", () => {
    expect(wouldViolateLastOwner({ currentlyOwner: false, ownerCount: 1, removing: true })).toBe(false);
    expect(wouldViolateLastOwner({ currentlyOwner: true, ownerCount: 1, nextRole: "owner" })).toBe(false);
  });
});

describe("closed registration", () => {
  it("allows public registration when open and rejects when closed", () => {
    expect(() => assertRegistrationOpen(true)).not.toThrow();
    expect(() => assertRegistrationOpen(false)).toThrow("REGISTRATION_CLOSED");
  });
});

describe("disabled login", () => {
  it("rejects a disabled user even with a matching password", () => {
    expect(credentialsAccess({ disabled: true }, true)).toBe(false);
  });

  it("rejects a bad password and a missing user", () => {
    expect(credentialsAccess({ disabled: false }, false)).toBe(false);
    expect(credentialsAccess(null, true)).toBe(false);
  });

  it("allows an active user with a matching password", () => {
    expect(credentialsAccess({ disabled: false }, true)).toBe(true);
  });
});

describe("member vs owner permissions", () => {
  it("lets an owner or site admin manage workspace members, but not a member", () => {
    expect(canManageWorkspaceMembers("owner", false)).toBe(true);
    expect(canManageWorkspaceMembers("member", false)).toBe(false);
    expect(canManageWorkspaceMembers("member", true)).toBe(true);
    expect(canManageWorkspaceMembers(null, false)).toBe(false);
    expect(canManageWorkspaceMembers(null, true)).toBe(true);
  });

  it("shows the workspace members page only to owners", () => {
    expect(canSeeWorkspaceMembersPage(true)).toBe(true);
    expect(canSeeWorkspaceMembersPage(false)).toBe(false);
  });

  it("accepts only owner or member as a workspace role", () => {
    expect(isWorkspaceRole("owner")).toBe(true);
    expect(isWorkspaceRole("member")).toBe(true);
    expect(isWorkspaceRole("admin")).toBe(false);
    expect(isWorkspaceRole("write")).toBe(false);
  });
});

describe("project access for workspace members only", () => {
  it("lists projects only for members of that workspace, not for a non-member site admin", () => {
    expect(canListOrgProjects(true)).toBe(true);
    expect(canListOrgProjects(false)).toBe(false);
  });

  it("lets any workspace member open a project, and a site admin for support access", () => {
    expect(canOpenProject(true, false)).toBe(true);
    expect(canOpenProject(false, false)).toBe(false);
    expect(canOpenProject(false, true)).toBe(true);
  });
});
