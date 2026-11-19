import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { credentialsAccess } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Credentials + JWT: no Prisma adapter required (adapter reserved for future OAuth)
  session: { strategy: "jwt" },
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });
        if (!user?.passwordHash) return null;
        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!credentialsAccess(user, ok)) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          isSiteAdmin: user.isSiteAdmin,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      const id = (user?.id as string | undefined) ?? (token.sub as string | undefined);
      if (!id) {
        token.isSiteAdmin = false;
        token.isWorkspaceOwner = false;
        return token;
      }
      const dbUser = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          disabled: true,
          isSiteAdmin: true,
          memberships: { select: { role: true } },
        },
      });
      if (!dbUser || dbUser.disabled) {
        token.sub = undefined;
        token.disabled = true;
        token.isSiteAdmin = false;
        token.isWorkspaceOwner = false;
        return token;
      }
      token.sub = dbUser.id;
      token.disabled = false;
      token.isSiteAdmin = dbUser.isSiteAdmin;
      token.isWorkspaceOwner = dbUser.memberships.some((m) => m.role === "owner");
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.disabled || !token.sub) {
          session.user.id = "";
          session.user.isSiteAdmin = false;
          session.user.isWorkspaceOwner = false;
        } else {
          session.user.id = token.sub;
          session.user.isSiteAdmin = Boolean(token.isSiteAdmin);
          session.user.isWorkspaceOwner = Boolean(token.isWorkspaceOwner);
        }
      }
      return session;
    },
  },
});
