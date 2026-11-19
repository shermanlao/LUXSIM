/** Official display zone for plan upload date and time on Import plan. */
export const OFFICIAL_PLAN_UPLOAD_TIME_ZONE = "Asia/Hong_Kong";

/**
 * Format an upload timestamp for the Import plan panel
 * (e.g. "19 Nov 2026, 16:27") in Asia/Hong_Kong, 24-hour clock.
 * Returns an empty string when the value is not a valid date.
 */
export function officialFormatPlanUploadAt(
  createdAt: string | Date | null | undefined
): string {
  if (createdAt == null || createdAt === "") return "";
  const date = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-HK", {
    timeZone: OFFICIAL_PLAN_UPLOAD_TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
