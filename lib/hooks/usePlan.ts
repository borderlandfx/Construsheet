// To enable Pro limits in production: set NEXT_PUBLIC_ENABLE_PRO_LIMITS=true
// in Vercel environment variables or .env.local
// Currently disabled for development
"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

export type Plan = "free" | "pro";

const LIMITS_ENABLED = process.env.NEXT_PUBLIC_ENABLE_PRO_LIMITS === 'true';

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
    createProject: (projectCount: number) =>
      !LIMITS_ENABLED || plan === "pro" || projectCount < 1,
    createAPU: (apuCount: number) =>
      !LIMITS_ENABLED || plan === "pro" || apuCount < 10,
    useAI: () =>
      !LIMITS_ENABLED || plan === "pro",
    exportPDF: () =>
      !LIMITS_ENABLED || plan === "pro",
    exportCSV: () =>
      !LIMITS_ENABLED || plan === "pro",
    inviteTeam: () =>
      !LIMITS_ENABLED || plan === "pro",
    varianceReport: () =>
      !LIMITS_ENABLED || plan === "pro",
    versionHistory: () =>
      !LIMITS_ENABLED || plan === "pro",
    executiveSummary: () =>
      !LIMITS_ENABLED || plan === "pro",
    fullSchedule: () =>
      !LIMITS_ENABLED || plan === "pro",
  }), [plan]);

  const isPro = plan === "pro";

  return { plan, can, isPro, loading };
}

export { LIMITS_ENABLED };
