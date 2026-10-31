import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { defaultScene } from "@/lib/scene";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).max(80).optional(),
  orgName: z.string().min(1).max(80).optional(),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const email = body.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        name: body.name ?? email.split("@")[0],
        passwordHash,
      },
    });

    const org = await prisma.org.create({
      data: {
        name: body.orgName ?? `${user.name}'s workspace`,
        members: { create: { userId: user.id, role: "owner" } },
        projects: {
          create: {
            name: "Sample office",
            sceneJson: JSON.stringify(defaultScene()),
          },
        },
      },
    });

    return NextResponse.json({ id: user.id, orgId: org.id });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
