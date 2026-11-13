import { describe, expect, it } from "vitest";
import { SITE_CONTACT, siteCopyrightYear } from "./site-contact";

describe("SITE_CONTACT", () => {
  it("uses the published LightX contact details", () => {
    expect(SITE_CONTACT.company).toBe("LightX Co., Ltd");
    expect(SITE_CONTACT.email).toBe("info@lightx.hk");
    expect(SITE_CONTACT.phone).toBe("+852 3114 5311");
    expect(SITE_CONTACT.fax).toBe("+852 3007 5908");
    expect(SITE_CONTACT.address).toContain("32 Tai Yau Street");
    expect(SITE_CONTACT.websiteUrl).toBe("https://www.lightx.hk");
  });
});

describe("siteCopyrightYear", () => {
  it("returns the calendar year of the given date", () => {
    expect(siteCopyrightYear(new Date("2026-11-13T00:00:00+08:00"))).toBe(2026);
  });
});
