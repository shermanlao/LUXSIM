import { randomInt } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import type { Mailer, SendMailInput } from "@/lib/mailer";
import {
  PASSWORD_CHANGED_SUBJECT,
  RESET_CODE_SUBJECT,
  assertNoEmailLinks,
  passwordChangedEmailText,
  resetCodeEmailText,
} from "@/lib/password-reset-email";
import {
  GENERIC_REQUEST_MESSAGE,
  INVALID_CODE_MESSAGE,
  MAX_SENDS_PER_HOUR,
  MAX_VERIFY_ATTEMPTS,
  OTP_TTL_MS,
  RATE_LIMIT_MESSAGE,
  SMTP_UNAVAILABLE_MESSAGE,
  createMemoryPasswordResetStore,
  generateOtp,
  requestPasswordReset,
  verifyPasswordReset,
} from "@/lib/password-reset";

const TEST_SECRET = "test-auth-secret-not-for-production";

type CapturingMailer = Mailer & { sent: SendMailInput[]; failNext: boolean; configured: boolean };

function createMailer(): CapturingMailer {
  const sent: SendMailInput[] = [];
  return {
    sent,
    failNext: false,
    configured: true,
    isConfigured() {
      return this.configured;
    },
    async send(input) {
      if (this.failNext) {
        this.failNext = false;
        throw new Error("SMTP_SEND_FAILED");
      }
      sent.push({ ...input });
    },
  };
}

function extractCode(text: string): string {
  const match = text.match(/\b(\d{6})\b/);
  if (!match) throw new Error("expected a 6-digit code in the message body");
  return match[1]!;
}

function hasLink(text: string): boolean {
  return /https?:\/\//i.test(text);
}

describe("password reset email text", () => {
  it("includes LUXSIM, the code, the 10-minute expiry, and no links", () => {
    const otp = "483291";
    const text = resetCodeEmailText(otp);
    expect(text).toContain("LUXSIM");
    expect(text).toContain(otp);
    expect(text).toMatch(/10 minutes/);
    expect(text).toMatch(/login or reset screen/i);
    expect(hasLink(text)).toBe(false);
    expect(text.includes("http://")).toBe(false);
    expect(text.includes("https://")).toBe(false);
    expect(() => assertNoEmailLinks(text)).not.toThrow();
    expect(RESET_CODE_SUBJECT).toContain("LUXSIM");
    expect(hasLink(RESET_CODE_SUBJECT)).toBe(false);
  });

  it("builds a password-changed notice with no links and no password", () => {
    const text = passwordChangedEmailText();
    expect(text).toContain("LUXSIM");
    expect(text.toLowerCase()).toContain("password was changed");
    expect(hasLink(text)).toBe(false);
    expect(text.includes("http://")).toBe(false);
    expect(text.includes("https://")).toBe(false);
    expect(PASSWORD_CHANGED_SUBJECT).toContain("LUXSIM");
  });

  it("rejects a body that contains a URL", () => {
    expect(() => assertNoEmailLinks("click https://example.com")).toThrow(/must not contain links/);
    expect(() => assertNoEmailLinks("see www.example.com")).toThrow(/must not contain links/);
  });
});

describe("generateOtp", () => {
  it("returns a 6-digit decimal string from crypto.randomInt", () => {
    const spy = vi.spyOn({ randomInt }, "randomInt");
    const codes = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const otp = generateOtp();
      expect(otp).toMatch(/^\d{6}$/);
      codes.add(otp);
    }
    expect(codes.size).toBeGreaterThan(1);
    spy.mockRestore();
  });
});

describe("requestPasswordReset and verifyPasswordReset", () => {
  let logs: string[];
  let logSpies: ReturnType<typeof vi.spyOn>[];

  beforeEach(() => {
    process.env.AUTH_SECRET = TEST_SECRET;
    logs = [];
    const capture = (...args: unknown[]) => {
      logs.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
    };
    logSpies = [
      vi.spyOn(console, "log").mockImplementation(capture),
      vi.spyOn(console, "info").mockImplementation(capture),
      vi.spyOn(console, "warn").mockImplementation(capture),
      vi.spyOn(console, "error").mockImplementation(capture),
      vi.spyOn(console, "debug").mockImplementation(capture),
    ];
  });

  afterEach(() => {
    for (const spy of logSpies) spy.mockRestore();
    delete process.env.AUTH_SECRET;
  });

  function setup(disabled = false) {
    const store = createMemoryPasswordResetStore([
      { id: "user_1", email: "designer@example.com", disabled },
    ]);
    store.users.get("designer@example.com")!.passwordHash = "old-hash";
    const mailer = createMailer();
    return { store, mailer };
  }

  it("sends a code for a real user, keeps it out of the JSON body, and does not log it", async () => {
    const { store, mailer } = setup();
    const result = await requestPasswordReset({
      email: "Designer@example.com",
      store,
      mailer,
    });
    expect(result.status).toBe(200);
    expect(result.body.message).toBe(GENERIC_REQUEST_MESSAGE);
    expect(result.body.ok).toBe(true);
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]!.to).toBe("designer@example.com");
    expect(mailer.sent[0]!.subject).toBe(RESET_CODE_SUBJECT);
    const otp = extractCode(mailer.sent[0]!.text);
    expect(otp).toMatch(/^\d{6}$/);
    expect(mailer.sent[0]!.text).toContain(otp);
    expect(hasLink(mailer.sent[0]!.text)).toBe(false);
    expect(JSON.stringify(result.body)).not.toContain(otp);
    expect(logs.some((line) => line.includes(otp))).toBe(false);
    expect(store.otps).toHaveLength(1);
    expect(store.otps[0]!.codeHash).not.toContain(otp);
    expect(await bcrypt.compare(otp, store.otps[0]!.codeHash)).toBe(true);
  });

  it("returns the same generic success and sends nothing for an unknown email", async () => {
    const { store, mailer } = setup();
    const result = await requestPasswordReset({
      email: "missing@example.com",
      store,
      mailer,
    });
    expect(result.status).toBe(200);
    expect(result.body.message).toBe(GENERIC_REQUEST_MESSAGE);
    expect(mailer.sent).toHaveLength(0);
    expect(store.otps).toHaveLength(0);
  });

  it("returns the same generic success and sends nothing for a disabled user", async () => {
    const { store, mailer } = setup(true);
    const result = await requestPasswordReset({
      email: "designer@example.com",
      store,
      mailer,
    });
    expect(result.status).toBe(200);
    expect(result.body.message).toBe(GENERIC_REQUEST_MESSAGE);
    expect(mailer.sent).toHaveLength(0);
    expect(store.otps).toHaveLength(0);
  });

  it("returns a 503-style error when SMTP is not configured, without creating a code", async () => {
    const { store, mailer } = setup();
    mailer.configured = false;
    const result = await requestPasswordReset({
      email: "designer@example.com",
      store,
      mailer,
    });
    expect(result.status).toBe(503);
    expect(result.body.error).toBe(SMTP_UNAVAILABLE_MESSAGE);
    expect(mailer.sent).toHaveLength(0);
    expect(store.otps).toHaveLength(0);
  });

  it("returns 503 when sending fails, does not include a code in the response, and invalidates the stored OTP", async () => {
    const { store, mailer } = setup();
    mailer.failNext = true;
    const result = await requestPasswordReset({
      email: "designer@example.com",
      store,
      mailer,
      generateOtp: () => "483291",
    });
    expect(result.status).toBe(503);
    expect(result.body.error).toBe(SMTP_UNAVAILABLE_MESSAGE);
    expect(JSON.stringify(result.body)).not.toContain("483291");
    expect(mailer.sent).toHaveLength(0);
    expect(store.otps.every((o) => o.consumedAt != null)).toBe(true);
  });

  it("rate-limits resends for both known and unknown emails", async () => {
    const { store, mailer } = setup();
    const first = await requestPasswordReset({
      email: "designer@example.com",
      store,
      mailer,
      now: new Date("2026-11-12T08:00:00.000Z"),
    });
    expect(first.status).toBe(200);
    const second = await requestPasswordReset({
      email: "designer@example.com",
      store,
      mailer,
      now: new Date("2026-11-12T08:00:30.000Z"),
    });
    expect(second.status).toBe(429);
    expect(second.body.error).toBe(RATE_LIMIT_MESSAGE);
    expect(mailer.sent).toHaveLength(1);

    const unknownA = await requestPasswordReset({
      email: "missing@example.com",
      store,
      mailer,
      now: new Date("2026-11-12T08:00:00.000Z"),
    });
    expect(unknownA.status).toBe(200);
    const unknownB = await requestPasswordReset({
      email: "missing@example.com",
      store,
      mailer,
      now: new Date("2026-11-12T08:00:30.000Z"),
    });
    expect(unknownB.status).toBe(429);
    expect(unknownB.body.error).toBe(RATE_LIMIT_MESSAGE);

    const later = await requestPasswordReset({
      email: "designer@example.com",
      store,
      mailer,
      now: new Date("2026-11-12T08:01:00.000Z"),
    });
    expect(later.status).toBe(200);
    expect(mailer.sent).toHaveLength(2);
    expect(store.otps.filter((o) => o.consumedAt == null)).toHaveLength(1);
  });

  it("caps requests per email per hour", async () => {
    const { store, mailer } = setup();
    const start = Date.parse("2026-11-12T08:00:00.000Z");
    for (let i = 0; i < MAX_SENDS_PER_HOUR; i++) {
      const result = await requestPasswordReset({
        email: "missing@example.com",
        store,
        mailer,
        now: new Date(start + i * 61_000),
      });
      expect(result.status).toBe(200);
    }
    const blocked = await requestPasswordReset({
      email: "missing@example.com",
      store,
      mailer,
      now: new Date(start + MAX_SENDS_PER_HOUR * 61_000),
    });
    expect(blocked.status).toBe(429);
  });

  it("changes the password hash, consumes the code, and does not return or log the OTP on success", async () => {
    const { store, mailer } = setup();
    const t0 = new Date("2026-11-12T08:00:00.000Z");
    const requested = await requestPasswordReset({
      email: "designer@example.com",
      store,
      mailer,
      now: t0,
    });
    const otp = extractCode(mailer.sent[0]!.text);
    const previousHash = store.users.get("designer@example.com")!.passwordHash;
    const verified = await verifyPasswordReset({
      email: "designer@example.com",
      otp,
      password: "new-pass-word",
      store,
      mailer,
      now: new Date(t0.getTime() + 1_000),
    });
    expect(requested.status).toBe(200);
    expect(verified.status).toBe(200);
    expect(verified.body.ok).toBe(true);
    expect(verified.body.message).toMatch(/sign in/i);
    const nextHash = store.users.get("designer@example.com")!.passwordHash;
    expect(nextHash).not.toBe(previousHash);
    expect(await bcrypt.compare("new-pass-word", nextHash)).toBe(true);
    expect(store.otps.every((o) => o.consumedAt != null)).toBe(true);
    expect(JSON.stringify(verified.body)).not.toContain(otp);
    expect(logs.some((line) => line.includes(otp))).toBe(false);
    expect(mailer.sent.some((m) => m.subject === PASSWORD_CHANGED_SUBJECT)).toBe(true);
    const notice = mailer.sent.find((m) => m.subject === PASSWORD_CHANGED_SUBJECT)!;
    expect(hasLink(notice.text)).toBe(false);
    expect(notice.text).not.toContain("new-pass-word");

    const reused = await verifyPasswordReset({
      email: "designer@example.com",
      otp,
      password: "another-pass",
      store,
      mailer,
      now: new Date(t0.getTime() + 2_000),
    });
    expect(reused.status).toBe(400);
    expect(reused.body.error).toBe(INVALID_CODE_MESSAGE);
    expect(await bcrypt.compare("new-pass-word", store.users.get("designer@example.com")!.passwordHash)).toBe(
      true
    );
  });

  it("rejects an expired or wrong OTP", async () => {
    const { store, mailer } = setup();
    const t0 = new Date("2026-11-12T08:00:00.000Z");
    await requestPasswordReset({
      email: "designer@example.com",
      store,
      mailer,
      now: t0,
      generateOtp: () => "483291",
    });
    const expired = await verifyPasswordReset({
      email: "designer@example.com",
      otp: "483291",
      password: "new-pass-word",
      store,
      mailer,
      now: new Date(t0.getTime() + OTP_TTL_MS + 1),
    });
    expect(expired.status).toBe(400);
    expect(expired.body.error).toBe(INVALID_CODE_MESSAGE);
    expect(store.users.get("designer@example.com")!.passwordHash).toBe("old-hash");

    const { store: store2, mailer: mailer2 } = setup();
    await requestPasswordReset({
      email: "designer@example.com",
      store: store2,
      mailer: mailer2,
      now: t0,
      generateOtp: () => "483291",
    });
    const wrong = await verifyPasswordReset({
      email: "designer@example.com",
      otp: "000000",
      password: "new-pass-word",
      store: store2,
      mailer: mailer2,
      now: new Date(t0.getTime() + 1_000),
    });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error).toBe(INVALID_CODE_MESSAGE);
    expect(store2.users.get("designer@example.com")!.passwordHash).toBe("old-hash");
  });

  it("invalidates the code after too many failed attempts", async () => {
    const { store, mailer } = setup();
    const t0 = new Date("2026-11-12T08:00:00.000Z");
    await requestPasswordReset({
      email: "designer@example.com",
      store,
      mailer,
      now: t0,
      generateOtp: () => "483291",
    });
    for (let i = 0; i < MAX_VERIFY_ATTEMPTS; i++) {
      const result = await verifyPasswordReset({
        email: "designer@example.com",
        otp: "000000",
        password: "new-pass-word",
        store,
        mailer,
        now: new Date(t0.getTime() + (i + 1) * 1_000),
      });
      expect(result.status).toBe(400);
      expect(result.body.error).toBe(INVALID_CODE_MESSAGE);
    }
    const afterCap = await verifyPasswordReset({
      email: "designer@example.com",
      otp: "483291",
      password: "new-pass-word",
      store,
      mailer,
      now: new Date(t0.getTime() + 20_000),
    });
    expect(afterCap.status).toBe(400);
    expect(afterCap.body.error).toBe(INVALID_CODE_MESSAGE);
    expect(store.users.get("designer@example.com")!.passwordHash).toBe("old-hash");
    expect(store.otps.every((o) => o.consumedAt != null)).toBe(true);
  });

  it("returns the same verify error for an unknown email", async () => {
    const { store, mailer } = setup();
    const result = await verifyPasswordReset({
      email: "missing@example.com",
      otp: "483291",
      password: "new-pass-word",
      store,
      mailer,
    });
    expect(result.status).toBe(400);
    expect(result.body.error).toBe(INVALID_CODE_MESSAGE);
  });
});
