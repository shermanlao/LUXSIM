import { promises as fs } from "fs";
import { NextResponse } from "next/server";
import { LuxsimImportError } from "@luxsim/project-io";
import { apiErrorResponse } from "@/lib/api-error";
import {
  importLuxsimToWorkspace,
  type ImportLuxsimDeps,
} from "@/lib/import-luxsim";
import { prisma } from "@/lib/prisma";
import { requireOrgContext } from "@/lib/session";
import { absolutePath, saveTextFile } from "@/lib/storage";

async function readImportRequest(req: Request): Promise<{ text: string; orgId?: string }> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as {
      text?: unknown;
      orgId?: unknown;
    };
    return {
      text: typeof body.text === "string" ? body.text : "",
      orgId: typeof body.orgId === "string" ? body.orgId : undefined,
    };
  }

  const form = await req.formData();
  const file = form.get("file");
  const orgRaw = form.get("orgId");
  const text =
    file instanceof File
      ? await file.text()
      : typeof file === "string"
        ? file
        : "";
  return {
    text,
    orgId: typeof orgRaw === "string" && orgRaw ? orgRaw : undefined,
  };
}

function prismaImportDeps(): ImportLuxsimDeps {
  return {
    findLuminaire: async (id) =>
      prisma.luminaire.findUnique({
        where: { id },
        select: { id: true, orgId: true },
      }),
    createLuminaire: async (row) =>
      prisma.luminaire.create({
        data: row,
        select: { id: true },
      }),
    deleteLuminaire: async (id) => {
      await prisma.luminaire.delete({ where: { id } });
    },
    createProject: async (row) =>
      prisma.project.create({
        data: row,
        select: { id: true, name: true, orgId: true },
      }),
    saveTextFile,
    removeFile: async (fileKey) => {
      await fs.unlink(absolutePath(fileKey)).catch(() => undefined);
    },
  };
}

export async function POST(req: Request) {
  try {
    const body = await readImportRequest(req);
    if (!body.text.trim()) {
      return NextResponse.json(
        { error: "A LUXSIM .lux or .luxsim file is required" },
        { status: 400 }
      );
    }
    const { orgId } = await requireOrgContext(body.orgId);
    const imported = await importLuxsimToWorkspace({
      orgId,
      text: body.text,
      deps: prismaImportDeps(),
    });
    return NextResponse.json({
      id: imported.project.id,
      name: imported.project.name,
      orgId: imported.project.orgId,
      warnings: imported.warnings,
    });
  } catch (e) {
    if (e instanceof LuxsimImportError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    if (e instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Not a LUXSIM project file: invalid JSON" },
        { status: 400 }
      );
    }
    return apiErrorResponse(e, "Import failed");
  }
}
