/** Paths that count as a document / page navigation for site traffic. */

export function shouldCountPath(pathname: string): boolean {
  if (typeof pathname !== "string") return false;
  let path = pathname.trim();
  const cut = path.search(/[?#]/);
  if (cut >= 0) path = path.slice(0, cut);
  if (!path.startsWith("/")) return false;

  if (path === "/api" || path.startsWith("/api/")) return false;
  if (path === "/_next" || path.startsWith("/_next/")) return false;

  const last = path.split("/").filter(Boolean).pop() ?? "";
  if (last.includes(".")) return false;

  return true;
}
