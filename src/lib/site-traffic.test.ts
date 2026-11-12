import { createHmac } from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AUTH_FORBIDDEN, AUTH_UNAUTHORIZED } from "@/lib/access-control";
import {
  addDays,
  createMemoryTrafficStore,
  getTrafficSecret,
  hashVisitorIdentity,
  hongKongDateKey,
  loadTrafficStats,
  recordPageView,
  safeRecordPageView,
  shouldCountPath,
  visitorIdentity,
} from "@/lib/site-traffic";

const SECRET = "test-auth-secret-not-for-production";
const VISITOR_A = "11111111-1111-4111-8111-111111111111";
const VISITOR_B = "22222222-2222-4222-8222-222222222222";
const SAMPLE_IP = "203.0.113.50";

const admin = { id: "admin-1", isSiteAdmin: true, disabled: false };
const designer = { id: "user-1", isSiteAdmin: false, disabled: false };

describe("shouldCountPath", () => {
  it("counts document and admin page navigations", () => {
    for (const path of [
      "/",
      "/login",
      "/register",
      "/projects",
      "/projects/abc123",
      "/admin",
      "/admin/users",
      "/admin/traffic",
      "/admin/settings",
      "/library",
      "/workspace/members",
    ]) {
      expect(shouldCountPath(path), path).toBe(true);
    }
  });

  it("does not count API routes, Next internals, or static files", () => {
    for (const path of [
      "/api/projects",
      "/api/admin/traffic",
      "/api/admin/users",
      "/api/auth/callback/credentials",
      "/api/auth/session",
      "/api/traffic/collect",
      "/_next/static/chunks/main.js",
      "/_next/image",
      "/favicon.ico",
      "/robots.txt",
      "/site.webmanifest",
    ]) {
      expect(shouldCountPath(path), path).toBe(false);
    }
  });
});

describe("hongKongDateKey", () => {
  it("uses Asia/Hong_Kong (UTC+8), not the UTC calendar date", () => {
    // 15:59 UTC on 12 Nov is still 23:59 in Hong Kong on 12 Nov.
    expect(hongKongDateKey(new Date("2026-11-12T15:59:59.000Z"))).toBe("2026-11-12");
    // 16:00 UTC on 12 Nov is 00:00 on 13 Nov in Hong Kong.
    expect(hongKongDateKey(new Date("2026-11-12T16:00:00.000Z"))).toBe("2026-11-13");
    expect(hongKongDateKey(new Date("2026-11-12T00:00:00.000Z"))).toBe("2026-11-12");
  });
});

describe("recordPageView counting", () => {
  it("counts one visitor and two page views for the same visitor on the same day", async () => {
    const store = createMemoryTrafficStore();
    const now = new Date("2026-11-12T08:00:00.000Z");
    await recordPageView({
      pathname: "/",
      visitorId: VISITOR_A,
      secret: SECRET,
      store,
      now,
    });
    await recordPageView({
      pathname: "/projects",
      visitorId: VISITOR_A,
      secret: SECRET,
      store,
      now: new Date("2026-11-12T09:00:00.000Z"),
    });
    const summary = await loadTrafficStats(admin, store, now);
    expect(summary.todayDate).toBe("2026-11-12");
    expect(summary.today).toEqual({ visitors: 1, pageViews: 2 });
    expect(summary.last7Days).toEqual({ visitors: 1, pageViews: 2 });
    expect(summary.last30Days).toEqual({ visitors: 1, pageViews: 2 });
  });

  it("counts two visitors when the cookie differs", async () => {
    const store = createMemoryTrafficStore();
    const now = new Date("2026-11-12T08:00:00.000Z");
    await recordPageView({ pathname: "/login", visitorId: VISITOR_A, secret: SECRET, store, now });
    await recordPageView({ pathname: "/login", visitorId: VISITOR_B, secret: SECRET, store, now });
    const summary = await loadTrafficStats(admin, store, now);
    expect(summary.today).toEqual({ visitors: 2, pageViews: 2 });
  });

  it("does not record /api/* or /_next/* hits", async () => {
    const store = createMemoryTrafficStore();
    const now = new Date("2026-11-12T08:00:00.000Z");
    const skipped = [
      "/api/projects/1",
      "/api/admin/users",
      "/api/auth/callback/credentials",
      "/_next/static/chunks/app.js",
    ];
    for (const pathname of skipped) {
      const result = await recordPageView({
        pathname,
        visitorId: VISITOR_A,
        secret: SECRET,
        store,
        now,
      });
      expect(result.recorded, pathname).toBe(false);
    }
    expect(store.hits).toHaveLength(0);
    const summary = await loadTrafficStats(admin, store, now);
    expect(summary.today).toEqual({ visitors: 0, pageViews: 0 });
  });

  it("treats last-7-day uniques as distinct across days, not a sum of daily uniques", async () => {
    const store = createMemoryTrafficStore();
    const day1 = new Date("2026-11-10T08:00:00.000Z");
    const day2 = new Date("2026-11-12T08:00:00.000Z");
    await recordPageView({ pathname: "/", visitorId: VISITOR_A, secret: SECRET, store, now: day1 });
    await recordPageView({ pathname: "/", visitorId: VISITOR_A, secret: SECRET, store, now: day2 });
    const summary = await loadTrafficStats(admin, store, day2);
    expect(summary.today).toEqual({ visitors: 1, pageViews: 1 });
    expect(summary.last7Days).toEqual({ visitors: 1, pageViews: 2 });
    const eleventh = summary.daily.find((row) => row.date === "2026-11-11");
    expect(eleventh).toEqual({ date: "2026-11-11", visitors: 0, pageViews: 0 });
    expect(summary.daily).toHaveLength(14);
    expect(summary.daily[0]?.date).toBe(addDays("2026-11-12", -13));
    expect(summary.daily.at(-1)?.date).toBe("2026-11-12");
  });

  it("uses the Hong Kong date for today when UTC is still the previous day", async () => {
    const store = createMemoryTrafficStore();
    // 16:30 UTC 12 Nov = 00:30 13 Nov HKT
    const now = new Date("2026-11-12T16:30:00.000Z");
    await recordPageView({ pathname: "/", visitorId: VISITOR_A, secret: SECRET, store, now });
    const summary = await loadTrafficStats(admin, store, now);
    expect(summary.timeZone).toBe("Asia/Hong_Kong");
    expect(summary.todayDate).toBe("2026-11-13");
    expect(summary.today).toEqual({ visitors: 1, pageViews: 1 });
    expect(summary.daily.at(-1)).toEqual({ date: "2026-11-13", visitors: 1, pageViews: 1 });
  });
});

describe("admin-only traffic stats", () => {
  it("allows a site admin and rejects unsigned or non-admin users", async () => {
    const store = createMemoryTrafficStore();
    const now = new Date("2026-11-12T08:00:00.000Z");
    await expect(loadTrafficStats(admin, store, now)).resolves.toMatchObject({
      todayDate: "2026-11-12",
    });
    await expect(loadTrafficStats(null, store, now)).rejects.toThrow(AUTH_UNAUTHORIZED);
    await expect(loadTrafficStats(undefined, store, now)).rejects.toThrow(AUTH_UNAUTHORIZED);
    await expect(
      loadTrafficStats({ ...admin, disabled: true }, store, now)
    ).rejects.toThrow(AUTH_UNAUTHORIZED);
    await expect(loadTrafficStats(designer, store, now)).rejects.toThrow(AUTH_FORBIDDEN);
  });
});

describe("visitor hashing", () => {
  it("stores an HMAC and never keeps a raw IP in the traffic rows", async () => {
    const store = createMemoryTrafficStore();
    const now = new Date("2026-11-12T08:00:00.000Z");
    const result = await recordPageView({
      pathname: "/",
      ip: SAMPLE_IP,
      secret: SECRET,
      store,
      now,
    });
    expect(result.recorded).toBe(true);
    expect(result.visitorHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.visitorHash).not.toBe(SAMPLE_IP);
    expect(result.visitorHash).not.toContain(SAMPLE_IP);
    expect(result.visitorHash).not.toBe(visitorIdentity({ ip: SAMPLE_IP, date: "2026-11-12" }));

    const identity = visitorIdentity({ ip: SAMPLE_IP, date: "2026-11-12" });
    expect(identity).toBe(`ip:${SAMPLE_IP}|day:2026-11-12`);
    expect(result.visitorHash).toBe(hashVisitorIdentity(identity!, SECRET));
    expect(result.visitorHash).toBe(
      createHmac("sha256", SECRET).update(`ip:${SAMPLE_IP}|day:2026-11-12`).digest("hex")
    );

    const dumped = JSON.stringify({ hits: store.hits, daily: [...store.daily.values()] });
    expect(dumped).not.toContain(SAMPLE_IP);
    expect(store.hits[0]?.visitorHash).toBe(result.visitorHash);
  });

  it("hashes a visitor cookie so the stored value is not the raw id", async () => {
    const store = createMemoryTrafficStore();
    const result = await recordPageView({
      pathname: "/projects/abc",
      visitorId: VISITOR_A,
      ip: SAMPLE_IP,
      secret: SECRET,
      store,
      now: new Date("2026-11-12T08:00:00.000Z"),
    });
    expect(result.visitorHash).toBe(
      createHmac("sha256", SECRET).update(`vid:${VISITOR_A}`).digest("hex")
    );
    const dumped = JSON.stringify({ hits: store.hits, daily: [...store.daily.values()] });
    expect(dumped).not.toContain(SAMPLE_IP);
    expect(dumped).not.toContain(VISITOR_A);
  });
});

describe("safeRecordPageView", () => {
  it("does not throw when the store write fails", async () => {
    const store = createMemoryTrafficStore();
    store.recordHit = async () => {
      throw new Error("disk full");
    };
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      safeRecordPageView({
        pathname: "/",
        visitorId: VISITOR_A,
        secret: SECRET,
        store,
        now: new Date("2026-11-12T08:00:00.000Z"),
      })
    ).resolves.toEqual({ recorded: false });
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("getTrafficSecret", () => {
  const saved: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const key of ["AUTH_SECRET", "NEXTAUTH_SECRET"]) {
      if (key in saved) {
        const prev = saved[key];
        if (prev === undefined) delete process.env[key];
        else process.env[key] = prev;
        delete saved[key];
      }
    }
  });

  function setEnv(key: "AUTH_SECRET" | "NEXTAUTH_SECRET", value: string | undefined) {
    if (!(key in saved)) saved[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  it("prefers AUTH_SECRET and refuses to record without a secret", async () => {
    setEnv("AUTH_SECRET", undefined);
    setEnv("NEXTAUTH_SECRET", undefined);
    expect(getTrafficSecret()).toBeNull();
    const store = createMemoryTrafficStore();
    const result = await recordPageView({
      pathname: "/",
      visitorId: VISITOR_A,
      secret: getTrafficSecret(),
      store,
      now: new Date("2026-11-12T08:00:00.000Z"),
    });
    expect(result.recorded).toBe(false);
    expect(store.hits).toHaveLength(0);

    setEnv("NEXTAUTH_SECRET", "legacy-secret");
    expect(getTrafficSecret()).toBe("legacy-secret");
    setEnv("AUTH_SECRET", SECRET);
    expect(getTrafficSecret()).toBe(SECRET);
  });
});
