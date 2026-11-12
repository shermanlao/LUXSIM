import { createHmac, randomUUID } from "crypto";
import { assertSiteAdmin, type SessionUserLike } from "@/lib/access-control";
import { shouldCountPath } from "@/lib/site-traffic-path";

export { shouldCountPath };

export const VISITOR_COOKIE = "luxsim_vid";
export const TRAFFIC_TIME_ZONE = "Asia/Hong_Kong" as const;
export const DAILY_HISTORY_DAYS = 14;
export const WEEK_DAYS = 7;
export const MONTH_DAYS = 30;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PeriodCounts = { visitors: number; pageViews: number };
export type DailyCounts = { date: string; visitors: number; pageViews: number };

export type TrafficSummary = {
  timeZone: typeof TRAFFIC_TIME_ZONE;
  todayDate: string;
  today: PeriodCounts;
  last7Days: PeriodCounts;
  last30Days: PeriodCounts;
  daily: DailyCounts[];
};

export type TrafficHit = {
  date: string;
  visitorHash: string;
};

export type TrafficStore = {
  recordHit(hit: TrafficHit): Promise<void>;
  getDailyRange(fromDate: string, toDate: string): Promise<DailyCounts[]>;
  countDistinctVisitors(fromDate: string, toDate: string): Promise<number>;
};

export function getTrafficSecret(): string | null {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
  return secret.trim() ? secret.trim() : null;
}

export function newVisitorId(): string {
  return randomUUID();
}

export function isValidVisitorId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * Civil date (YYYY-MM-DD) in Asia/Hong_Kong (UTC+8, no DST).
 * Uses a fixed offset so "today" does not follow the server's UTC date.
 */
export function hongKongDateKey(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

export function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return utc.toISOString().slice(0, 10);
}

export function dateRangeInclusive(fromDate: string, toDate: string): string[] {
  const dates: string[] = [];
  let cursor = fromDate;
  while (cursor <= toDate) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

export function hashVisitorIdentity(identity: string, secret: string): string {
  return createHmac("sha256", secret).update(identity).digest("hex");
}

/**
 * Build the string that is HMAC'd. A first-party visitor cookie is preferred.
 * IP is only used as a same-day fallback and is never the stored value.
 */
export function visitorIdentity(input: {
  visitorId?: string | null;
  ip?: string | null;
  date: string;
}): string | null {
  if (isValidVisitorId(input.visitorId)) return `vid:${input.visitorId}`;
  const ip = typeof input.ip === "string" ? input.ip.trim() : "";
  if (ip) return `ip:${ip}|day:${input.date}`;
  return null;
}

export function clientIpFromHeaders(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip")?.trim();
  return real || null;
}

export type RecordPageViewInput = {
  pathname: string;
  visitorId?: string | null;
  ip?: string | null;
  secret: string | null;
  store: TrafficStore;
  now?: Date;
};

export type RecordPageViewResult = {
  recorded: boolean;
  visitorHash?: string;
  date?: string;
};

export async function recordPageView(input: RecordPageViewInput): Promise<RecordPageViewResult> {
  if (!shouldCountPath(input.pathname)) return { recorded: false };
  if (!input.secret) return { recorded: false };
  const date = hongKongDateKey(input.now);
  const identity = visitorIdentity({ visitorId: input.visitorId, ip: input.ip, date });
  if (!identity) return { recorded: false };
  const visitorHash = hashVisitorIdentity(identity, input.secret);
  await input.store.recordHit({ date, visitorHash });
  return { recorded: true, visitorHash, date };
}

/** Recording must never throw: a failed write is logged and ignored. */
export async function safeRecordPageView(input: RecordPageViewInput): Promise<RecordPageViewResult> {
  try {
    return await recordPageView(input);
  } catch (error) {
    console.error("[traffic] failed to record visit");
    return { recorded: false };
  }
}

export type MemoryTrafficStore = TrafficStore & {
  hits: TrafficHit[];
  daily: Map<string, DailyCounts>;
};

export function createMemoryTrafficStore(): MemoryTrafficStore {
  const visitorDay = new Set<string>();
  const hits: TrafficHit[] = [];
  const daily = new Map<string, DailyCounts>();

  return {
    hits,
    daily,
    async recordHit(hit) {
      const key = `${hit.date}\0${hit.visitorHash}`;
      const isNew = !visitorDay.has(key);
      if (isNew) {
        visitorDay.add(key);
        hits.push({ date: hit.date, visitorHash: hit.visitorHash });
      }
      const row = daily.get(hit.date) ?? { date: hit.date, pageViews: 0, visitors: 0 };
      row.pageViews += 1;
      if (isNew) row.visitors += 1;
      daily.set(hit.date, row);
    },
    async getDailyRange(fromDate, toDate) {
      return [...daily.values()]
        .filter((row) => row.date >= fromDate && row.date <= toDate)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((row) => ({ ...row }));
    },
    async countDistinctVisitors(fromDate, toDate) {
      const ids = new Set<string>();
      for (const hit of hits) {
        if (hit.date >= fromDate && hit.date <= toDate) ids.add(hit.visitorHash);
      }
      return ids.size;
    },
  };
}

export function fillDailyRange(
  rows: DailyCounts[],
  fromDate: string,
  toDate: string
): DailyCounts[] {
  const byDate = new Map(rows.map((row) => [row.date, row]));
  return dateRangeInclusive(fromDate, toDate).map((date) => {
    const row = byDate.get(date);
    return { date, visitors: row?.visitors ?? 0, pageViews: row?.pageViews ?? 0 };
  });
}

export function sumPageViews(rows: DailyCounts[]): number {
  return rows.reduce((total, row) => total + row.pageViews, 0);
}

export async function summarizeTrafficFromStore(
  store: TrafficStore,
  now: Date = new Date()
): Promise<TrafficSummary> {
  const todayDate = hongKongDateKey(now);
  const from7 = addDays(todayDate, -(WEEK_DAYS - 1));
  const from30 = addDays(todayDate, -(MONTH_DAYS - 1));
  const from14 = addDays(todayDate, -(DAILY_HISTORY_DAYS - 1));

  const [dailyRaw, todayVisitors, visitors7, visitors30, daily30] = await Promise.all([
    store.getDailyRange(from14, todayDate),
    store.countDistinctVisitors(todayDate, todayDate),
    store.countDistinctVisitors(from7, todayDate),
    store.countDistinctVisitors(from30, todayDate),
    store.getDailyRange(from30, todayDate),
  ]);

  const daily = fillDailyRange(dailyRaw, from14, todayDate);
  const todayRow = daily.find((row) => row.date === todayDate);
  const weekRows = fillDailyRange(daily30, from7, todayDate);
  const monthRows = fillDailyRange(daily30, from30, todayDate);

  return {
    timeZone: TRAFFIC_TIME_ZONE,
    todayDate,
    today: { visitors: todayVisitors, pageViews: todayRow?.pageViews ?? 0 },
    last7Days: { visitors: visitors7, pageViews: sumPageViews(weekRows) },
    last30Days: { visitors: visitors30, pageViews: sumPageViews(monthRows) },
    daily,
  };
}

export async function loadTrafficStats(
  user: SessionUserLike | null | undefined,
  store: TrafficStore,
  now: Date = new Date()
): Promise<TrafficSummary> {
  assertSiteAdmin(user);
  return summarizeTrafficFromStore(store, now);
}
