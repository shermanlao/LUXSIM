/**
 * Content-Disposition for a stored plan (or other asset) file.
 * ASCII filename is a conservative fallback; filename* carries the real UTF-8 name.
 */
export function officialContentDisposition(
  disposition: "inline" | "attachment",
  fileName: string
): string {
  const raw = (fileName || "").replace(/[\r\n]+/g, " ").trim() || "file";
  const ascii =
    raw
      .replace(/[^\x20-\x7E]/g, "_")
      .replace(/["\\;]/g, "_")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "") || "file";
  const encoded = encodeURIComponent(raw).replace(/['()*]/g, (ch) => {
    return `%${ch.charCodeAt(0).toString(16).toUpperCase()}`;
  });
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

/** Treat ?download=1 (or true) as an attachment download. */
export function officialAssetFileDownloadRequested(
  download: string | null | undefined
): boolean {
  if (!download) return false;
  const value = download.trim().toLowerCase();
  return value === "1" || value === "true";
}

export function officialPlanAssetFileUrl(
  assetApiBase: string,
  assetId: string,
  opts?: { download?: boolean }
): string {
  const url = `${assetApiBase}/assets/${assetId}/file`;
  return opts?.download ? `${url}?download=1` : url;
}
