import { afterEach, describe, expect, it } from "vitest";
import {
  defaultReportWebsite,
  parseReportWebsite,
  publicSiteInfo,
  settingsFromRows,
} from "./site-settings";

const ENV_KEYS = ["AUTH_URL", "NEXTAUTH_URL"] as const;
const saved: Record<string, string | undefined> = {};

function setEnv(key: (typeof ENV_KEYS)[number], value: string | undefined) {
  if (!(key in saved)) saved[key] = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (key in saved) {
      const prev = saved[key];
      if (prev === undefined) delete process.env[key];
      else process.env[key] = prev;
      delete saved[key];
    }
  }
});

describe("parseReportWebsite", () => {
  it("accepts http(s) URLs and strips a trailing slash", () => {
    expect(parseReportWebsite("http://187.7.21.12:8088/")).toBe("http://187.7.21.12:8088");
    expect(parseReportWebsite("  https://luxsim.example.com/path/  ")).toBe(
      "https://luxsim.example.com/path"
    );
    expect(parseReportWebsite("")).toBe("");
    expect(parseReportWebsite("   ")).toBe("");
  });

  it("accepts a bare host or host:port", () => {
    expect(parseReportWebsite("187.7.21.12:8088")).toBe("187.7.21.12:8088");
    expect(parseReportWebsite("luxsim.example.com")).toBe("luxsim.example.com");
  });

  it("rejects javascript: and other non-http schemes", () => {
    expect(parseReportWebsite("javascript:alert(1)")).toBeNull();
    expect(parseReportWebsite("data:text/html,hi")).toBeNull();
    expect(parseReportWebsite("ftp://example.com")).toBeNull();
    expect(parseReportWebsite("not a url")).toBeNull();
    expect(parseReportWebsite(123)).toBeNull();
    expect(parseReportWebsite(undefined)).toBeNull();
  });
});

describe("settingsFromRows reportWebsite", () => {
  it("defaults to AUTH_URL, then NEXTAUTH_URL, when the key is unset", () => {
    setEnv("AUTH_URL", "http://187.7.21.12:8088/");
    setEnv("NEXTAUTH_URL", "http://localhost:3000");
    expect(defaultReportWebsite()).toBe("http://187.7.21.12:8088");
    expect(settingsFromRows([]).reportWebsite).toBe("http://187.7.21.12:8088");

    setEnv("AUTH_URL", undefined);
    expect(defaultReportWebsite()).toBe("http://localhost:3000");
    expect(settingsFromRows([]).reportWebsite).toBe("http://localhost:3000");
  });

  it("keeps a stored empty value so the PDF line can be hidden", () => {
    setEnv("AUTH_URL", "http://187.7.21.12:8088");
    expect(settingsFromRows([{ key: "reportWebsite", value: "" }]).reportWebsite).toBe("");
  });

  it("uses a stored custom address", () => {
    setEnv("AUTH_URL", "http://187.7.21.12:8088");
    expect(
      settingsFromRows([{ key: "reportWebsite", value: "https://luxsim.example.com/" }]).reportWebsite
    ).toBe("https://luxsim.example.com");
  });

  it("exposes only the website on the public site info payload", () => {
    const info = publicSiteInfo({
      publicRegistration: false,
      defaultAutosaveMs: 300_000,
      reportWebsite: "http://187.7.21.12:8088",
    });
    expect(info).toEqual({ reportWebsite: "http://187.7.21.12:8088" });
    expect(info).not.toHaveProperty("publicRegistration");
    expect(info).not.toHaveProperty("defaultAutosaveMs");
  });
});
