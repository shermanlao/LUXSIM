import { NextResponse } from "next/server";
import { parseDxfEntities, dxfBounds, importIfcText } from "@luxsim/project-io";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import { requireProjectAccess } from "@/lib/session";
import { saveBinaryFile, saveTextFile } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

const KIND_EXT: Record<string, string[]> = {
  image: [".png", ".jpg", ".jpeg", ".webp"],
  pdf: [".pdf"],
  dxf: [".dxf"],
  dwg: [".dwg"],
  ifc: [".ifc"],
};

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { project } = await requireProjectAccess(id);
    const assets = await prisma.projectAsset.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(assets);
  } catch (e) {
    const authRes = apiErrorResponse(e);
    if (authRes.status !== 500) return authRes;
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { project } = await requireProjectAccess(id);

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }
    if (file.size > 80_000_000) {
      return NextResponse.json({ error: "File too large (max 80MB)" }, { status: 400 });
    }

    const lower = file.name.toLowerCase();
    let kind = String(form.get("kind") || "");
    if (!kind) {
      if (lower.endsWith(".pdf")) kind = "pdf";
      else if (lower.endsWith(".dxf")) kind = "dxf";
      else if (lower.endsWith(".dwg")) kind = "dwg";
      else if (lower.endsWith(".ifc")) kind = "ifc";
      else kind = "image";
    }

    const allowed = KIND_EXT[kind];
    if (!allowed || !allowed.some((ext) => lower.endsWith(ext))) {
      return NextResponse.json(
        { error: `Unexpected extension for kind ${kind}` },
        { status: 400 }
      );
    }

    const meta: Record<string, unknown> = {};
    let fileKey: string;
    let ifcScene = null;
    let warnings: string[] = [];

    if (kind === "dxf" || kind === "ifc") {
      const text = await file.text();
      if (kind === "dxf") {
        const entities = parseDxfEntities(text);
        meta.entities = entities;
        meta.bounds = dxfBounds(entities);
        fileKey = await saveTextFile("assets", file.name, text);
      } else {
        const imported = importIfcText(text, project.name);
        ifcScene = imported.scene;
        warnings = imported.warnings;
        meta.storeyCount = imported.scene.storeys.length;
        meta.roomCount = imported.scene.rooms.length;
        fileKey = await saveTextFile("assets", file.name, text);
      }
    } else if (kind === "dwg") {
      const buf = Buffer.from(await file.arrayBuffer());
      fileKey = await saveBinaryFile("assets", file.name, buf);
      meta.conversion = "unsupported";
      warnings = [
        "DWG binary conversion is not available in this build. Please export DXF from your CAD software and re-upload.",
      ];
    } else {
      const buf = Buffer.from(await file.arrayBuffer());
      fileKey = await saveBinaryFile("assets", file.name, buf);
    }

    const asset = await prisma.projectAsset.create({
      data: {
        projectId: id,
        kind,
        fileKey,
        fileName: file.name,
        metaJson: JSON.stringify(meta),
      },
    });

    return NextResponse.json({ asset, ifcScene, warnings });
  } catch (e) {
    const authRes = apiErrorResponse(e);
    if (authRes.status !== 500) return authRes;
    console.error(e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
