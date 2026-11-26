import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import {
  dxfBounds,
  officialMetersPerUnitFromInsUnits,
  parseDxfEntities,
  parseDxfInsUnits,
  parseDxfLayers,
  type DxfEntity,
  type OfficialDxfLayer,
} from "@luxsim/project-io";

/** Official error when a DWG cannot be converted or parsed into linework. */
export class DwgConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DwgConversionError";
  }
}

type LibreDwgApi = {
  dwg_write_dxf: (fileContent: string | ArrayBuffer) => Uint8Array | null;
};

let libredwgPromise: Promise<LibreDwgApi> | null = null;

function officialLibreDwgWasmDir(): string {
  const require = createRequire(import.meta.url);
  const candidates: string[] = [];
  try {
    const main = require.resolve("@mlightcad/libredwg-web");
    candidates.push(path.join(path.dirname(main), "..", "wasm"));
  } catch {
    // Fall through to the cwd install path used on the box and VPS.
  }
  candidates.push(
    path.join(process.cwd(), "node_modules", "@mlightcad", "libredwg-web", "wasm")
  );
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "libredwg-web.wasm"))) {
      return dir.endsWith(path.sep) ? dir : dir + path.sep;
    }
  }
  throw new DwgConversionError(
    "DWG converter files are missing. Run npm install and try again."
  );
}

async function officialLibreDwg(): Promise<LibreDwgApi> {
  if (!libredwgPromise) {
    libredwgPromise = (async () => {
      const { LibreDwg } = await import("@mlightcad/libredwg-web");
      return LibreDwg.create(officialLibreDwgWasmDir());
    })();
  }
  try {
    return await libredwgPromise;
  } catch (error) {
    libredwgPromise = null;
    if (error instanceof DwgConversionError) throw error;
    throw new DwgConversionError(
      "Could not start the DWG converter. Run npm install and try again."
    );
  }
}

function officialDwgArrayBuffer(data: Buffer | Uint8Array): ArrayBuffer {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

/**
 * Server-only: convert a DWG binary to ASCII DXF text with LibreDWG WASM.
 * Does not run in the browser bundle.
 */
export async function convertDwgToDxfText(
  data: Buffer | Uint8Array
): Promise<string> {
  if (!data || data.byteLength === 0) {
    throw new DwgConversionError("The DWG file is empty.");
  }
  const libredwg = await officialLibreDwg();
  let dxfBytes: Uint8Array | null;
  try {
    dxfBytes = libredwg.dwg_write_dxf(officialDwgArrayBuffer(data));
  } catch {
    throw new DwgConversionError(
      "Could not convert this DWG to a plan. The file may be an unsupported DWG version or damaged."
    );
  }
  if (!dxfBytes || dxfBytes.byteLength === 0) {
    throw new DwgConversionError(
      "Could not convert this DWG to a plan. The file may be an unsupported DWG version or damaged."
    );
  }
  const text = new TextDecoder("utf-8").decode(dxfBytes);
  if (!text.includes("SECTION") || !text.includes("ENTITIES")) {
    throw new DwgConversionError(
      "DWG conversion did not produce a usable DXF plan."
    );
  }
  return text;
}

export type OfficialParsedDwgPlan = {
  dxfText: string;
  entities: DxfEntity[];
  bounds: ReturnType<typeof dxfBounds>;
  insunits: number | null;
  metersPerUnit: number;
  layers: OfficialDxfLayer[];
};

/**
 * Convert a DWG and parse it with the official DXF entity pipeline.
 * Fails if conversion or parse yields no linework.
 */
export async function officialParseDwgPlan(
  data: Buffer | Uint8Array
): Promise<OfficialParsedDwgPlan> {
  const dxfText = await convertDwgToDxfText(data);
  const entities = parseDxfEntities(dxfText);
  if (entities.length === 0) {
    throw new DwgConversionError("Could not read any linework from this DWG.");
  }
  const insunits = parseDxfInsUnits(dxfText);
  return {
    dxfText,
    entities,
    bounds: dxfBounds(entities),
    insunits,
    metersPerUnit: officialMetersPerUnitFromInsUnits(insunits),
    layers: parseDxfLayers(dxfText),
  };
}
