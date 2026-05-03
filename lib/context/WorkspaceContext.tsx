"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { fmt as fmtCurrency, type Currency } from "@/lib/utils/currency";
import type { Locale } from "@/lib/utils/i18n";
import type { TabId } from "@/components/workspace/TabBar";
import {
  type ProjectIndirectCosts,
  DEFAULT_INDIRECT_COSTS,
} from "@/lib/types/database.types";

export type { ProjectIndirectCosts };

export interface WorkspaceCtx {
  currency: Currency;
  unitSys: "m" | "ft";
  language: Locale;
  projectId: string;
  userId: string;
  projectSettings: ProjectIndirectCosts;
  activeTab: TabId;
  setCurrency: (c: Currency) => void;
  setUnitSys: (u: "m" | "ft") => void;
  setLanguage: (l: Locale) => void;
  setProjectSettings: (s: ProjectIndirectCosts) => void;
  saveProjectSettings: (s: ProjectIndirectCosts) => Promise<void>;
  saveDefaultSettings: (s: ProjectIndirectCosts) => Promise<void>;
  setActiveTab: (t: TabId) => void;
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
  initialSettings,
  initialTab,
}: {
  children: React.ReactNode;
  projectId: string;
  userId: string;
  initialCurrency: Currency;
  initialLanguage: Locale;
  initialSettings?: ProjectIndirectCosts;
  initialTab?: TabId;
}) {
  const supabase = createClient();

  const [currency, setCurrencyState] = useState<Currency>(initialCurrency);
  const [unitSys, setUnitSysState] = useState<"m" | "ft">("m");
  const [language, setLanguageState] = useState<Locale>(initialLanguage);
  const [projectSettings, setProjectSettingsState] = useState<ProjectIndirectCosts>(
    initialSettings ?? DEFAULT_INDIRECT_COSTS
  );
  const [activeTab, setActiveTabState] = useState<TabId>(initialTab ?? "apu");

  // Restore saved tab from localStorage after hydration to avoid SSR mismatch
  React.useEffect(() => {
    const saved = localStorage.getItem(`cs-active-tab-${projectId}`);
    if (saved && (["apu", "budget", "gantt", "takeoff", "reports"] as string[]).includes(saved)) {
      setActiveTabState(saved as TabId);
    }
  }, [projectId]);

  const setCurrency = useCallback(
    (c: Currency) => {
      setCurrencyState(c);
      supabase.from("projects").update({ currency: c }).eq("id", projectId);
    },
    [supabase, projectId]
  );
  const setUnitSys = useCallback((u: "m" | "ft") => setUnitSysState(u), []);
  const setActiveTab = useCallback((t: TabId) => {
    setActiveTabState(t);
    if (typeof window !== "undefined") {
      localStorage.setItem(`cs-active-tab-${projectId}`, t);
    }
  }, [projectId]);

  const setLanguage = useCallback(
    (l: Locale) => {
      setLanguageState(l);
      supabase.from("profiles").update({ language: l }).eq("id", userId);
    },
    [supabase, userId]
  );

  const setProjectSettings = useCallback(
    (s: ProjectIndirectCosts) => setProjectSettingsState(s),
    []
  );

  const saveProjectSettings = useCallback(
    async (s: ProjectIndirectCosts) => {
      setProjectSettingsState(s);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabase.from("projects").update({ project_settings: s as any }).eq("id", projectId);
    },
    [supabase, projectId]
  );

  const saveDefaultSettings = useCallback(
    async (s: ProjectIndirectCosts) => {
      setProjectSettingsState(s);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabase.from("projects").update({ project_settings: s as any }).eq("id", projectId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabase.from("profiles").update({ default_indirect_costs: s as any }).eq("id", userId);
    },
    [supabase, projectId, userId]
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
        projectSettings,
        activeTab,
        setCurrency,
        setUnitSys,
        setLanguage,
        setProjectSettings,
        saveProjectSettings,
        saveDefaultSettings,
        setActiveTab,
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
