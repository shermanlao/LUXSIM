import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { loadPublicShareByToken } from "@/lib/load-public-share";
import { absolutePath } from "@/lib/storage";
import {
  officialAssetFileDownloadRequested,
  officialContentDisposition,
} from "@/lib/official-content-disposition";

type Params = { params: Promise<{ token: string; assetId: string }> };

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".dxf": "application/dxf",
  ".dwg": "application/acad",
  ".ifc": "application/x-step",
};

export async function GET(req: Request, { params }: Params) {
  try {
    const { token, assetId } = await params;
    const project = await loadPublicShareByToken(token);
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const asset = project.assets.find((a) => a.id === assetId);
    if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const full = absolutePath(asset.fileKey);
    const data = await fs.readFile(full);
    const ext = path.extname(asset.fileName).toLowerCase();
    const download = officialAssetFileDownloadRequested(
      new URL(req.url).searchParams.get("download")
    );
    return new NextResponse(data, {
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Content-Disposition": officialContentDisposition(
          download ? "attachment" : "inline",
          asset.fileName
        ),
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
