import type { LuxsimProjectFile } from "./types";

export function serializeLuxsim(project: LuxsimProjectFile): string {
  return JSON.stringify(project, null, 2);
}

export function parseLuxsim(text: string): LuxsimProjectFile {
  const data = JSON.parse(text) as LuxsimProjectFile;
  if (data.format !== "luxsim") {
    throw new Error("Not a LUXSIM project file");
  }
  return data;
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
