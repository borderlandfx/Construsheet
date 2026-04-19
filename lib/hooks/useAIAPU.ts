"use client";

import { useState, useCallback } from "react";
import type { Locale } from "@/lib/utils/i18n";
import type { Currency } from "@/lib/utils/currency";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AIAPULineItem {
  name: string;
  unit: string;
  qty: number;
  unit_price: number;
}

export interface AIAPUResult {
  code: string;
  description: string;
  unit: string;
  overhead_pct: number;
  profit_pct: number;
  materials: AIAPULineItem[];
  labor: AIAPULineItem[];
  equipment: AIAPULineItem[];
  direct_cost: number;
  selling_price: number;
}

export interface AIAPUParams {
  prompt: string;
  language: Locale;
  currency: Currency;
  unitSys: "m" | "ft";
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAIAPU() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AIAPUResult | null>(null);

  const generate = useCallback(
    async (params: AIAPUParams): Promise<AIAPUResult | null> => {
      setIsLoading(true);
      setError(null);
      setResult(null);

      try {
        const res = await fetch("/api/ai-apu", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });

        const data = await res.json() as { error?: string } & Partial<AIAPUResult>;

        if (!res.ok) {
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }

        const apu = data as AIAPUResult;
        setResult(apu);
        return apu;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setError(msg);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /** Reset state — useful before opening the modal again */
  const reset = useCallback(() => {
    setError(null);
    setResult(null);
  }, []);

  return { generate, isLoading, error, result, reset };
}
