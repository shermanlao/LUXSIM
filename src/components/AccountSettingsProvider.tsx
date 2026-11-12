"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { DEFAULT_AUTOSAVE_MS, parseAutosaveMs } from "@/lib/account-settings";

type AccountSettingsValue = {
  email: string | null;
  name: string | null;
  autosaveMs: number;
  loaded: boolean;
  saveAutosaveMs: (ms: number) => Promise<boolean>;
  refresh: () => Promise<void>;
};

const AccountSettingsContext = createContext<AccountSettingsValue | null>(null);

export function AccountSettingsProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [autosaveMs, setAutosaveMs] = useState(DEFAULT_AUTOSAVE_MS);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (status !== "authenticated") {
      setLoaded(status !== "loading");
      return;
    }
    const res = await fetch("/api/account");
    if (!res.ok) {
      setLoaded(true);
      return;
    }
    const data = (await res.json()) as {
      email?: string | null;
      name?: string | null;
      autosaveMs?: unknown;
    };
    setEmail(data.email ?? null);
    setName(data.name ?? null);
    setAutosaveMs(parseAutosaveMs(data.autosaveMs) ?? DEFAULT_AUTOSAVE_MS);
    setLoaded(true);
  }, [status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveAutosaveMs = useCallback(async (ms: number) => {
    const parsed = parseAutosaveMs(ms);
    if (parsed == null) return false;
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autosaveMs: parsed }),
    });
    if (!res.ok) return false;
    setAutosaveMs(parsed);
    return true;
  }, []);

  const value = useMemo(
    () => ({ email, name, autosaveMs, loaded, saveAutosaveMs, refresh }),
    [email, name, autosaveMs, loaded, saveAutosaveMs, refresh]
  );

  return (
    <AccountSettingsContext.Provider value={value}>{children}</AccountSettingsContext.Provider>
  );
}

export function useAccountSettings(): AccountSettingsValue {
  const ctx = useContext(AccountSettingsContext);
  if (!ctx) {
    return {
      email: null,
      name: null,
      autosaveMs: DEFAULT_AUTOSAVE_MS,
      loaded: false,
      saveAutosaveMs: async () => false,
      refresh: async () => {},
    };
  }
  return ctx;
}
