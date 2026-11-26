import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHARE_LINKS_ENABLED,
  newShareToken,
  parseShareLinksEnabled,
  projectShareUrl,
  publicShareAllowed,
  VIEW_SHARE_PATH,
} from "@/lib/project-share";

describe("project share", () => {
  it("is on by default", () => {
    expect(DEFAULT_SHARE_LINKS_ENABLED).toBe(true);
  });

  it("allows a visitor only when the project and at least one owner leave the link on", () => {
    expect(
      publicShareAllowed({ projectShareEnabled: true, ownerShareLinksEnabled: [true] })
    ).toBe(true);
    expect(
      publicShareAllowed({ projectShareEnabled: false, ownerShareLinksEnabled: [true] })
    ).toBe(false);
    expect(
      publicShareAllowed({ projectShareEnabled: true, ownerShareLinksEnabled: [false] })
    ).toBe(false);
    expect(
      publicShareAllowed({ projectShareEnabled: true, ownerShareLinksEnabled: [false, true] })
    ).toBe(true);
  });

  it("builds a view-only URL from the site origin", () => {
    expect(projectShareUrl("https://luxsim.example", "abc")).toBe(
      `https://luxsim.example${VIEW_SHARE_PATH}/abc`
    );
  });

  it("issues a URL-safe token and parses the toggle", () => {
    const token = newShareToken();
    expect(token.length).toBeGreaterThan(20);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(parseShareLinksEnabled(true)).toBe(true);
    expect(parseShareLinksEnabled(false)).toBe(false);
    expect(parseShareLinksEnabled("yes")).toBeNull();
  });
});
