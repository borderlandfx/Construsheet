"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { fmt as fmtCurrency, type Currency } from "@/lib/utils/currency";
import type { Locale } from "@/lib/utils/i18n";

export interface WorkspaceCtx {
  currency: Currency;
  unitSys: "m" | "ft";
  language: Locale;
  projectId: string;
  userId: string;
  setCurrency: (c: Currency) => void;
  setUnitSys: (u: "m" | "ft") => void;
  setLanguage: (l: Locale) => void;
  /** Format a number using the current currency */
  fmt: (value: number) => string;
}

const WorkspaceContext = createContext<WorkspaceCtx | null>(null);

export function WorkspaceProvider({
  children,
  projectId,
  userId,
  initialCurrency,
  initialLanguage,
}: {
  children: React.ReactNode;
  projectId: string;
  userId: string;
  initialCurrency: Currency;
  initialLanguage: Locale;
}) {
  const supabase = createClient();

  const [currency, setCurrencyState] = useState<Currency>(initialCurrency);
  const [unitSys, setUnitSysState] = useState<"m" | "ft">("m");
  const [language, setLanguageState] = useState<Locale>(initialLanguage);

  const setCurrency = useCallback((c: Currency) => setCurrencyState(c), []);
  const setUnitSys = useCallback((u: "m" | "ft") => setUnitSysState(u), []);

  const setLanguage = useCallback(
    (l: Locale) => {
      setLanguageState(l);
      // Persist to profile — fire-and-forget
      supabase.from("profiles").update({ language: l }).eq("id", userId);
    },
    [supabase, userId]
  );

  const fmt = useCallback(
    (value: number) => fmtCurrency(value, currency),
    [currency]
  );

  return (
    <WorkspaceContext.Provider
      value={{
        currency,
        unitSys,
        language,
        projectId,
        userId,
        setCurrency,
        setUnitSys,
        setLanguage,
        fmt,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceCtx {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
