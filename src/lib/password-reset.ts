import { createHmac, randomInt, randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import type { Mailer } from "@/lib/mailer";
import { envMailer } from "@/lib/mailer";
import {
  PASSWORD_CHANGED_SUBJECT,
  RESET_CODE_SUBJECT,
  passwordChangedEmailText,
  resetCodeEmailText,
} from "@/lib/password-reset-email";

export const OTP_TTL_MS = 10 * 60 * 1000;
export const RESEND_INTERVAL_MS = 60 * 1000;
export const MAX_SENDS_PER_HOUR = 5;
export const MAX_VERIFY_ATTEMPTS = 5;
export const BCRYPT_ROUNDS = 10;

export const GENERIC_REQUEST_MESSAGE =
  "If that email is registered, a reset code has been sent. Enter the code on the login or reset screen. It expires in 10 minutes.";

export const SMTP_UNAVAILABLE_MESSAGE =
  "Could not send a reset code just now. Please try again later.";

export const RATE_LIMIT_MESSAGE = "Please wait before requesting another code.";

export const INVALID_CODE_MESSAGE = "Invalid or expired code.";

export const REQUEST_THROTTLE_KIND = "password_reset_request";
export const VERIFY_THROTTLE_KIND = "password_reset_verify";

export type PasswordResetUser = {
  id: string;
  email: string;
  disabled: boolean;
};

export type PasswordResetOtpRecord = {
  id: string;
  userId: string;
  codeHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  attemptCount: number;
  createdAt: Date;
};

export type PasswordResetStore = {
  findUserByEmail(email: string): Promise<PasswordResetUser | null>;
  updatePasswordHash(userId: string, passwordHash: string): Promise<void>;
  invalidateUnusedOtps(userId: string, now: Date): Promise<void>;
  createOtp(input: {
    userId: string;
    codeHash: string;
    expiresAt: Date;
    now: Date;
  }): Promise<PasswordResetOtpRecord>;
  findActiveOtp(userId: string, now: Date): Promise<PasswordResetOtpRecord | null>;
  incrementOtpAttempts(id: string): Promise<number>;
  consumeOtp(id: string, now: Date): Promise<void>;
  countThrottles(emailHash: string, kind: string, since: Date): Promise<number>;
  addThrottle(emailHash: string, kind: string, now: Date): Promise<void>;
};

export type JsonResult = {
  status: number;
  body: { message?: string; error?: string; ok?: boolean };
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashEmail(email: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is required");
  }
  return createHmac("sha256", secret).update(normalizeEmail(email)).digest("hex");
}

/** Cryptographically random 6-digit code. Callers must not log the return value. */
export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export async function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, BCRYPT_ROUNDS);
}

export async function otpMatches(otp: string, codeHash: string): Promise<boolean> {
  return bcrypt.compare(otp, codeHash);
}

let dummyHashPromise: Promise<string> | undefined;

function dummyOtpHash(): Promise<string> {
  dummyHashPromise ??= bcrypt.hash("000000", BCRYPT_ROUNDS);
  return dummyHashPromise;
}

async function dummyCompare(otp: string): Promise<void> {
  await bcrypt.compare(otp, await dummyOtpHash());
}

export function createMemoryPasswordResetStore(
  users: PasswordResetUser[] = []
): PasswordResetStore & {
  users: Map<string, PasswordResetUser & { passwordHash: string }>;
  otps: PasswordResetOtpRecord[];
  throttles: { id: string; emailHash: string; kind: string; createdAt: Date }[];
} {
  const userMap = new Map<string, PasswordResetUser & { passwordHash: string }>();
  for (const user of users) {
    userMap.set(user.email, { ...user, passwordHash: "" });
  }
  const otps: PasswordResetOtpRecord[] = [];
  const throttles: { id: string; emailHash: string; kind: string; createdAt: Date }[] = [];

  return {
    users: userMap,
    otps,
    throttles,
    async findUserByEmail(email) {
      const row = userMap.get(email);
      if (!row) return null;
      return { id: row.id, email: row.email, disabled: row.disabled };
    },
    async updatePasswordHash(userId, passwordHash) {
      for (const row of userMap.values()) {
        if (row.id === userId) {
          row.passwordHash = passwordHash;
          return;
        }
      }
    },
    async invalidateUnusedOtps(userId, now) {
      for (const otp of otps) {
        if (otp.userId === userId && otp.consumedAt == null) {
          otp.consumedAt = now;
        }
      }
    },
    async createOtp(input) {
      const row: PasswordResetOtpRecord = {
        id: randomUUID(),
        userId: input.userId,
        codeHash: input.codeHash,
        expiresAt: input.expiresAt,
        consumedAt: null,
        attemptCount: 0,
        createdAt: input.now,
      };
      otps.push(row);
      return row;
    },
    async findActiveOtp(userId, now) {
      const matches = otps
        .filter((o) => o.userId === userId && o.consumedAt == null && o.expiresAt > now)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return matches[0] ?? null;
    },
    async incrementOtpAttempts(id) {
      const row = otps.find((o) => o.id === id);
      if (!row) return 0;
      row.attemptCount += 1;
      return row.attemptCount;
    },
    async consumeOtp(id, now) {
      const row = otps.find((o) => o.id === id);
      if (row) row.consumedAt = now;
    },
    async countThrottles(emailHash, kind, since) {
      return throttles.filter(
        (t) => t.emailHash === emailHash && t.kind === kind && t.createdAt > since
      ).length;
    },
    async addThrottle(emailHash, kind, now) {
      throttles.push({ id: randomUUID(), emailHash, kind, createdAt: now });
    },
  };
}

export async function requestPasswordReset(opts: {
  email: string;
  store: PasswordResetStore;
  mailer?: Mailer;
  now?: Date;
  generateOtp?: () => string;
}): Promise<JsonResult> {
  const mailer = opts.mailer ?? envMailer;
  const store = opts.store;
  const now = opts.now ?? new Date();
  const email = normalizeEmail(opts.email);

  if (!mailer.isConfigured()) {
    return { status: 503, body: { error: SMTP_UNAVAILABLE_MESSAGE } };
  }

  const emailHash = hashEmail(email);
  const recent = await store.countThrottles(
    emailHash,
    REQUEST_THROTTLE_KIND,
    new Date(now.getTime() - RESEND_INTERVAL_MS)
  );
  const hourly = await store.countThrottles(
    emailHash,
    REQUEST_THROTTLE_KIND,
    new Date(now.getTime() - 60 * 60 * 1000)
  );
  if (recent >= 1 || hourly >= MAX_SENDS_PER_HOUR) {
    return { status: 429, body: { error: RATE_LIMIT_MESSAGE } };
  }

  await store.addThrottle(emailHash, REQUEST_THROTTLE_KIND, now);

  const user = await store.findUserByEmail(email);
  if (!user || user.disabled) {
    await dummyCompare("000000");
    return { status: 200, body: { ok: true, message: GENERIC_REQUEST_MESSAGE } };
  }

  const otp = (opts.generateOtp ?? generateOtp)();
  const codeHash = await hashOtp(otp);
  await store.invalidateUnusedOtps(user.id, now);
  await store.createOtp({
    userId: user.id,
    codeHash,
    expiresAt: new Date(now.getTime() + OTP_TTL_MS),
    now,
  });

  const text = resetCodeEmailText(otp);
  try {
    await mailer.send({
      to: user.email,
      subject: RESET_CODE_SUBJECT,
      text,
    });
  } catch {
    await store.invalidateUnusedOtps(user.id, now);
    return { status: 503, body: { error: SMTP_UNAVAILABLE_MESSAGE } };
  }

  return { status: 200, body: { ok: true, message: GENERIC_REQUEST_MESSAGE } };
}

export async function verifyPasswordReset(opts: {
  email: string;
  otp: string;
  password: string;
  store: PasswordResetStore;
  mailer?: Mailer;
  now?: Date;
}): Promise<JsonResult> {
  const mailer = opts.mailer ?? envMailer;
  const store = opts.store;
  const now = opts.now ?? new Date();
  const email = normalizeEmail(opts.email);
  const otp = opts.otp.trim();
  const emailHash = hashEmail(email);

  await store.addThrottle(emailHash, VERIFY_THROTTLE_KIND, now);

  const user = await store.findUserByEmail(email);
  const active = user && !user.disabled ? await store.findActiveOtp(user.id, now) : null;
  const matches = active ? await otpMatches(otp, active.codeHash) : false;
  if (!active) {
    await dummyCompare(otp);
  }

  const recentVerify = await store.countThrottles(
    emailHash,
    VERIFY_THROTTLE_KIND,
    new Date(now.getTime() - OTP_TTL_MS)
  );

  if (!user || user.disabled || !active || !matches || recentVerify > MAX_VERIFY_ATTEMPTS) {
    if (active) {
      const attempts = await store.incrementOtpAttempts(active.id);
      if (attempts >= MAX_VERIFY_ATTEMPTS || recentVerify >= MAX_VERIFY_ATTEMPTS) {
        await store.consumeOtp(active.id, now);
      }
    }
    return { status: 400, body: { error: INVALID_CODE_MESSAGE } };
  }

  const passwordHash = await bcrypt.hash(opts.password, BCRYPT_ROUNDS);
  await store.updatePasswordHash(user.id, passwordHash);
  await store.consumeOtp(active.id, now);

  if (mailer.isConfigured()) {
    try {
      await mailer.send({
        to: user.email,
        subject: PASSWORD_CHANGED_SUBJECT,
        text: passwordChangedEmailText(),
      });
    } catch {
      // Password is already changed; a notification failure must not fail the reset.
    }
  }

  return {
    status: 200,
    body: { ok: true, message: "Your password has been changed. Sign in with your new password." },
  };
}
