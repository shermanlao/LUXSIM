import { NextResponse } from "next/server";
import fs from "fs/promises";
import { parseDxfEntities, dxfBounds, importIfcText } from "@luxsim/project-io";
import { prisma } from "@/lib/prisma";
import { requireOrgContext } from "@/lib/session";
import { absolutePath, saveBinaryFile, saveTextFile } from "@/lib/storage";
import {
  createPdfRasterAsset,
  PdfEncryptedError,
  PdfInvalidError,
} from "@/lib/pdf-raster-ingest";

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
    const { orgId } = await requireOrgContext();
    const { id } = await params;
    const project = await prisma.project.findFirst({ where: { id, orgId } });
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const assets = await prisma.projectAsset.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(assets);
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { orgId } = await requireOrgContext();
    const { id } = await params;
    const project = await prisma.project.findFirst({ where: { id, orgId } });
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
    let rasterAsset: Awaited<ReturnType<typeof createPdfRasterAsset>>["rasterAsset"] | null =
      null;
    let rasterInfo: {
      widthPx: number;
      heightPx: number;
      rasterDpi: number;
      pageCount: number;
      pageIndex: number;
    } | null = null;
    let pdfBuffer: Buffer | null = null;
    const pageIndexRaw = form.get("pageIndex");
    const initialPdfPage = Number.isFinite(Number(pageIndexRaw))
      ? Math.max(0, Math.floor(Number(pageIndexRaw)))
      : 0;

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
      if (kind === "pdf") {
        pdfBuffer = buf;
      }
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

    if (kind === "pdf" && pdfBuffer) {
      try {
        const { rasterAsset: ra, raster } = await createPdfRasterAsset({
          projectId: id,
          pdfAssetId: asset.id,
          pdfFileName: file.name,
          pdfBuffer,
          pageIndex: initialPdfPage,
        });
        rasterAsset = ra;
        rasterInfo = {
          widthPx: raster.widthPx,
          heightPx: raster.heightPx,
          rasterDpi: raster.rasterDpi,
          pageCount: raster.pageCount,
          pageIndex: raster.pageIndex,
        };
        meta.pageCount = raster.pageCount;
        meta.lastPageIndex = raster.pageIndex;
        meta.lastRasterAssetId = ra.id;
        meta.rasterDpi = raster.rasterDpi;
        meta.widthPx = raster.widthPx;
        meta.heightPx = raster.heightPx;
        warnings = [...warnings, ...raster.warnings, "PDF rasterized for display"];
        await prisma.projectAsset.update({
          where: { id: asset.id },
          data: { metaJson: JSON.stringify(meta) },
        });
      } catch (e) {
        if (e instanceof PdfEncryptedError || e instanceof PdfInvalidError) {
          await prisma.projectAsset.delete({ where: { id: asset.id } });
          await fs.unlink(absolutePath(fileKey)).catch(() => undefined);
          return NextResponse.json({ error: e.message }, { status: 400 });
        }
        throw e;
      }
    }

    return NextResponse.json({
      asset: {
        ...asset,
        metaJson: JSON.stringify(meta),
      },
      rasterAsset,
      raster: rasterInfo,
      ifcScene,
      warnings,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
