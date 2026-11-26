import type { PasswordResetStore } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";

export const prismaPasswordResetStore: PasswordResetStore = {
  async findUserByEmail(email) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, disabled: true },
    });
    return user;
  },
  async updatePasswordHash(userId, passwordHash) {
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  },
  async invalidateUnusedOtps(userId, now) {
    await prisma.passwordResetOtp.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: now },
    });
  },
  async createOtp(input) {
    return prisma.passwordResetOtp.create({
      data: {
        userId: input.userId,
        codeHash: input.codeHash,
        expiresAt: input.expiresAt,
        createdAt: input.now,
      },
    });
  },
  async findActiveOtp(userId, now) {
    return prisma.passwordResetOtp.findFirst({
      where: { userId, consumedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
    });
  },
  async incrementOtpAttempts(id) {
    const row = await prisma.passwordResetOtp.update({
      where: { id },
      data: { attemptCount: { increment: 1 } },
      select: { attemptCount: true },
    });
    return row.attemptCount;
  },
  async consumeOtp(id, now) {
    await prisma.passwordResetOtp.update({
      where: { id },
      data: { consumedAt: now },
    });
  },
  async countThrottles(emailHash, kind, since) {
    return prisma.authEmailThrottle.count({
      where: { emailHash, kind, createdAt: { gt: since } },
    });
  },
  async addThrottle(emailHash, kind, now) {
    await prisma.authEmailThrottle.create({
      data: { emailHash, kind, createdAt: now },
    });
  },
};
