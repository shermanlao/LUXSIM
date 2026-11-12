"use client";

import { useCallback, useEffect, useState } from "react";
import { AUTOSAVE_INTERVALS } from "@/lib/account-settings";

type Settings = { publicRegistration: boolean; defaultAutosaveMs: number; reportWebsite: string };
type Tip = { helpKey: string; title: string; body: string; updatedAt: string | null };

async function readError(res: Response, fallback: string) {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return data.error || fallback;
}

export function SettingsAdminClient() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [websiteDraft, setWebsiteDraft] = useState("");
  const [tips, setTips] = useState<Tip[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setError(null);
    const [settingsRes, tipsRes] = await Promise.all([
      fetch("/api/admin/settings"),
      fetch("/api/admin/tips"),
    ]);
    if (!settingsRes.ok) {
      setError(await readError(settingsRes, "Failed to load settings"));
      setLoading(false);
      return;
    }
    const next = (await settingsRes.json()) as Settings;
    setSettings(next);
    setWebsiteDraft(next.reportWebsite ?? "");
    if (tipsRes.ok) setTips((await tipsRes.json()) as Tip[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function saveSettings(patch: Partial<Settings>) {
    setError(null);
    setSaved(null);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      setError(await readError(res, "Failed to save settings"));
      return;
    }
    const next = (await res.json()) as Settings;
    setSettings(next);
    if (patch.reportWebsite !== undefined) setWebsiteDraft(next.reportWebsite ?? "");
    setSaved("Site settings saved.");
  }

  async function saveTip(tip: Tip) {
    setError(null);
    setSaved(null);
    const res = await fetch(`/api/admin/tips/${encodeURIComponent(tip.helpKey)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: tip.title, body: tip.body }),
    });
    if (!res.ok) {
      setError(await readError(res, "Failed to save tip"));
      return;
    }
    setSaved(`Saved tip “${tip.helpKey}”.`);
    await refresh();
  }

  if (loading || !settings) {
    return <p className="text-[var(--muted)]">Loading…</p>;
  }

  return (
    <div>
      <h1 className="display text-4xl mb-2">Site settings</h1>
      <p className="text-[var(--muted)] mb-6">
        Public registration, the default autosave for new accounts, the website shown on lighting
        report PDFs, and in-app help tips.
      </p>
      {error && <p className="text-sm text-red-700 mb-4">{error}</p>}
      {saved && <p className="text-sm text-[var(--ok)] mb-4">{saved}</p>}

      <section className="panel p-5 mb-6 space-y-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.publicRegistration}
            onChange={(e) => void saveSettings({ publicRegistration: e.target.checked })}
          />
          Public registration is open
        </label>
        <p className="text-sm text-[var(--muted)]">
          When closed, new accounts can still be created from the Users page. Existing sign-in is unchanged.
        </p>
        <div className="max-w-xs">
          <label className="label" htmlFor="default-autosave">
            Default autosave for new users
          </label>
          <select
            id="default-autosave"
            className="select"
            value={settings.defaultAutosaveMs}
            onChange={(e) => void saveSettings({ defaultAutosaveMs: Number(e.target.value) })}
          >
            {AUTOSAVE_INTERVALS.map((opt) => (
              <option key={opt.ms} value={opt.ms}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <form
          className="max-w-md space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void saveSettings({ reportWebsite: websiteDraft });
          }}
        >
          <label className="label" htmlFor="report-website">
            Lighting report website
          </label>
          <input
            id="report-website"
            className="input"
            type="text"
            inputMode="url"
            autoComplete="off"
            placeholder="http://187.7.21.12:8088"
            value={websiteDraft}
            onChange={(e) => setWebsiteDraft(e.target.value)}
          />
          <p className="text-sm text-[var(--muted)]">
            Printed as plain text in the footer of lighting report PDFs. Use an http(s) URL or a
            host[:port]. Leave blank to hide it. When this has never been set, the server address
            (AUTH_URL) is used.
          </p>
          <button className="btn btn-accent !py-1.5 !px-3 !text-xs">Save website</button>
        </form>
      </section>

      <h2 className="display text-2xl mb-3">Help tips</h2>
      <div className="space-y-4">
        {tips.map((tip, index) => (
          <form
            key={tip.helpKey}
            className="panel p-5 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void saveTip(tips[index]!);
            }}
          >
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{tip.helpKey}</p>
            <div>
              <label className="label" htmlFor={`tip-title-${tip.helpKey}`}>
                Title
              </label>
              <input
                id={`tip-title-${tip.helpKey}`}
                className="input"
                value={tip.title}
                onChange={(e) =>
                  setTips((all) => all.map((t, i) => (i === index ? { ...t, title: e.target.value } : t)))
                }
              />
            </div>
            <div>
              <label className="label" htmlFor={`tip-body-${tip.helpKey}`}>
                Body
              </label>
              <textarea
                id={`tip-body-${tip.helpKey}`}
                className="input min-h-28"
                value={tip.body}
                onChange={(e) =>
                  setTips((all) => all.map((t, i) => (i === index ? { ...t, body: e.target.value } : t)))
                }
              />
            </div>
            <button className="btn btn-accent !py-1.5 !px-3 !text-xs">Save tip</button>
          </form>
        ))}
      </div>
    </div>
  );
}
