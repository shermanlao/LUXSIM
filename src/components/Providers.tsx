"use client";

import { SessionProvider } from "next-auth/react";
import { AccountSettingsProvider } from "@/components/AccountSettingsProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AccountSettingsProvider>{children}</AccountSettingsProvider>
    </SessionProvider>
  );
}
