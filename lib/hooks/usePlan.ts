"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

export type Plan = "free" | "pro";

export interface PlanGate {
  createProject: (projectCount: number) => boolean;
  createAPU: (apuCount: number) => boolean;
  useAI: () => boolean;
  exportPDF: () => boolean;
  exportCSV: () => boolean;
  inviteTeam: () => boolean;
  varianceReport: () => boolean;
  versionHistory: () => boolean;
  executiveSummary: () => boolean;
  fullSchedule: () => boolean;
}

export function usePlan(userId: string) {
  const [plan, setPlan] = useState<Plan>("free");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("plan, plan_expires_at")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = data as any;
        if (
          d?.plan === "pro" &&
          (!d.plan_expires_at || d.plan_expires_at > new Date().toISOString())
        ) {
          setPlan("pro");
        } else {
          setPlan("free");
        }
        setLoading(false);
      });
  }, [userId]);

  const can: PlanGate = useMemo(() => ({
    createProject: (projectCount: number) => plan === "pro" || projectCount < 1,
    createAPU: (apuCount: number) => plan === "pro" || apuCount < 10,
    useAI: () => plan === "pro",
    exportPDF: () => plan === "pro",
    exportCSV: () => plan === "pro",
    inviteTeam: () => plan === "pro",
    varianceReport: () => plan === "pro",
    versionHistory: () => plan === "pro",
    executiveSummary: () => plan === "pro",
    fullSchedule: () => plan === "pro",
  }), [plan]);

  const isPro = plan === "pro";

  return { plan, can, isPro, loading };
}
