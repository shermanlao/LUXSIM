"use client";

import { useCallback, useEffect, useState } from "react";
import { AUTOSAVE_INTERVALS } from "@/lib/account-settings";

type Settings = {
  publicRegistration: boolean;
  defaultAutosaveMs: number;
  reportWebsite: string;
  roomAnalysisAiEnabled: boolean;
  roomAnalysisAiProvider: "xai" | "openai";
  roomAnalysisAiModel: string;
  roomAnalysisAiKeyConfigured: boolean;
  roomAnalysisAiKeyMasked: string;
};
type Tip = { helpKey: string; title: string; body: string; updatedAt: string | null };

async function readError(res: Response, fallback: string) {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return data.error || fallback;
}

export function SettingsAdminClient() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [websiteDraft, setWebsiteDraft] = useState("");
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiProvider, setAiProvider] = useState<"xai" | "openai">("xai");
  const [aiModel, setAiModel] = useState("");
  const [aiKeyDraft, setAiKeyDraft] = useState("");
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
    setAiEnabled(Boolean(next.roomAnalysisAiEnabled));
    setAiProvider(next.roomAnalysisAiProvider === "openai" ? "openai" : "xai");
    setAiModel(next.roomAnalysisAiModel ?? "");
    setAiKeyDraft("");
    if (tipsRes.ok) setTips((await tipsRes.json()) as Tip[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function saveSettings(
    patch: Partial<Settings> & { roomAnalysisAiKey?: string; clearRoomAnalysisAiKey?: boolean }
  ) {
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
    setAiEnabled(Boolean(next.roomAnalysisAiEnabled));
    setAiProvider(next.roomAnalysisAiProvider === "openai" ? "openai" : "xai");
    setAiModel(next.roomAnalysisAiModel ?? "");
    if ("roomAnalysisAiKey" in patch || "clearRoomAnalysisAiKey" in patch) setAiKeyDraft("");
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
        Public registration, the default save reminder for new accounts, the website shown on lighting
        report PDFs, room-analysis AI, and in-app help tips.
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
          <label className="label" htmlFor="default-save-reminder">
            Default save reminder for new users
          </label>
          <select
            id="default-save-reminder"
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

      <section className="panel p-5 mb-6 space-y-4">
        <h2 className="text-lg font-semibold">Room-analysis AI</h2>
        <p className="text-sm text-[var(--muted)]">
          When <strong>Create rooms from DXF</strong> or <strong>Create from plan</strong> cannot
          find a room layout in the drawing, the editor can send a compact plan image to this
          service to identify rooms. Only site administrators can see or change this setting.
          Regular project users never see the key. The saved key is never shown again.
        </p>
        <form
          className="max-w-md space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const patch: Partial<Settings> & { roomAnalysisAiKey?: string } = {
              roomAnalysisAiEnabled: aiEnabled,
              roomAnalysisAiProvider: aiProvider,
              roomAnalysisAiModel: aiModel,
            };
            if (aiKeyDraft.trim()) patch.roomAnalysisAiKey = aiKeyDraft.trim();
            void saveSettings(patch);
          }}
        >
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={aiEnabled}
              onChange={(e) => setAiEnabled(e.target.checked)}
            />
            Enable room-analysis AI
          </label>
          <div>
            <label className="label" htmlFor="room-analysis-ai-provider">
              Provider
            </label>
            <select
              id="room-analysis-ai-provider"
              className="select"
              value={aiProvider}
              onChange={(e) => {
                const next = e.target.value === "openai" ? "openai" : "xai";
                setAiProvider(next);
                if (
                  aiModel === "grok-2-vision-latest" ||
                  aiModel === "gpt-4o" ||
                  aiModel.trim() === ""
                ) {
                  setAiModel(next === "openai" ? "gpt-4o" : "grok-2-vision-latest");
                }
              }}
            >
              <option value="xai">xAI</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="room-analysis-ai-model">
              Model
            </label>
            <input
              id="room-analysis-ai-model"
              className="input"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="room-analysis-ai-key">
              API key
            </label>
            <input
              id="room-analysis-ai-key"
              className="input"
              type="password"
              autoComplete="new-password"
              spellCheck={false}
              placeholder={
                settings.roomAnalysisAiKeyConfigured
                  ? settings.roomAnalysisAiKeyMasked || "••••"
                  : "Not set"
              }
              value={aiKeyDraft}
              onChange={(e) => setAiKeyDraft(e.target.value)}
            />
            <p className="text-sm text-[var(--muted)] mt-1">
              {settings.roomAnalysisAiKeyConfigured
                ? `A key is saved (${settings.roomAnalysisAiKeyMasked || "••••"}). Leave this field blank to keep it, or enter a new key to replace it.`
                : "No key is saved yet. Paste a key here to store it."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-accent !py-1.5 !px-3 !text-xs" type="submit">
              Save AI settings
            </button>
            {settings.roomAnalysisAiKeyConfigured && (
              <button
                type="button"
                className="btn !py-1.5 !px-3 !text-xs"
                onClick={() => void saveSettings({ clearRoomAnalysisAiKey: true })}
              >
                Remove key
              </button>
            )}
          </div>
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
