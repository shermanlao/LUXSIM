"use client";

import { useCallback, useEffect, useState } from "react";

type PeriodCounts = { visitors: number; pageViews: number };
type DailyCounts = { date: string; visitors: number; pageViews: number };
type TrafficSummary = {
  timeZone: string;
  todayDate: string;
  today: PeriodCounts;
  last7Days: PeriodCounts;
  last30Days: PeriodCounts;
  daily: DailyCounts[];
};

async function readError(res: Response, fallback: string) {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return data.error || fallback;
}

function formatCount(value: number) {
  return value.toLocaleString("en-HK");
}

function formatDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

export function TrafficAdminClient() {
  const [data, setData] = useState<TrafficSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/admin/traffic");
    if (!res.ok) {
      setError(await readError(res, "Failed to load traffic"));
      setLoading(false);
      return;
    }
    setData((await res.json()) as TrafficSummary);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading && !data) {
    return <p className="text-[var(--muted)]">Loading…</p>;
  }

  const maxViews = Math.max(1, ...(data?.daily.map((row) => row.pageViews) ?? [1]));
  const periods = data
    ? [
        { key: "today", title: "Today", note: formatDate(data.todayDate), counts: data.today },
        { key: "7d", title: "Last 7 days", note: "Including today", counts: data.last7Days },
        { key: "30d", title: "Last 30 days", note: "Including today", counts: data.last30Days },
      ]
    : [];

  return (
    <div>
      <h1 className="display text-4xl mb-2">Traffic</h1>
      <p className="text-[var(--muted)] mb-6">
        Visitors and page views for this LUXSIM site. Dates use Hong Kong time (UTC+8). Background
        API calls, autosave, and static files are not counted.
      </p>
      {error && <p className="text-sm text-red-700 mb-4">{error}</p>}

      {data && (
        <>
          <section className="traffic-period-grid mb-6">
            {periods.map((period) => (
              <article key={period.key} className="panel p-5">
                <h2 className="traffic-period__title">{period.title}</h2>
                <p className="traffic-period__note">{period.note}</p>
                <div className="traffic-metric">
                  <p className="traffic-metric__value">{formatCount(period.counts.visitors)}</p>
                  <p className="traffic-metric__label">Visitors</p>
                </div>
                <div className="traffic-metric">
                  <p className="traffic-metric__value">{formatCount(period.counts.pageViews)}</p>
                  <p className="traffic-metric__label">Page views</p>
                </div>
              </article>
            ))}
          </section>

          <section className="panel p-5">
            <h2 className="traffic-period__title">Last 14 days</h2>
            <p className="text-sm text-[var(--muted)] mb-4">
              Daily unique visitors and page views, Hong Kong time.
            </p>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Visitors</th>
                    <th>Page views</th>
                    <th>Views</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.daily].reverse().map((row) => (
                    <tr key={row.date}>
                      <td>{formatDate(row.date)}</td>
                      <td>{formatCount(row.visitors)}</td>
                      <td>{formatCount(row.pageViews)}</td>
                      <td>
                        <span
                          className="traffic-bar"
                          style={{ width: `${Math.round((row.pageViews / maxViews) * 100)}%` }}
                          title={`${formatCount(row.pageViews)} page views`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
