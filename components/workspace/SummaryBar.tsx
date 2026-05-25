"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/context/WorkspaceContext";

export default function SummaryBar() {
  const { projectId, language, budgetRows, fmt } = useWorkspace();
  const isEs = language === "es";
  const supabase = createClient();

  const [apuCount, setApuCount] = useState<number | null>(null);
  const [weekCount, setWeekCount] = useState<number | null>(null);

  // Fetch APU count and gantt chapter (weeks) count
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [apuRes, ganttRes] = await Promise.all([
        supabase
          .from("apu_items")
          .select("id", { count: "exact", head: true })
          .eq("project_id", projectId),
        supabase
          .from("gantt_tasks")
          .select("id", { count: "exact", head: true })
          .eq("project_id", projectId)
          .eq("is_chapter", true),
      ]);
      if (cancelled) return;
      setApuCount(apuRes.count ?? 0);
      setWeekCount(ganttRes.count ?? 0);
    }
    load();
    return () => { cancelled = true; };
  }, [projectId, supabase]);

  // Derive budget stats from context
  const stats = useMemo(() => {
    const itemRows = budgetRows.filter((r) => !r.is_chapter);
    const total = itemRows.reduce((s, r) => s + (r.quantity * r.unit_price), 0);
    const approved = itemRows
      .filter((r) => r.status === "approved")
      .reduce((s, r) => s + (r.quantity * r.unit_price), 0);
    const pct = total > 0 ? Math.round((approved / total) * 100) : 0;
    return { total, approved, itemCount: itemRows.length, pct };
  }, [budgetRows]);

  const loaded = apuCount !== null && weekCount !== null;

  return (
    <div
      className="flex items-center shrink-0 overflow-x-auto scrollbar-none px-2 md:px-0"
      style={{
        height: 36,
        background: "var(--cs-bg2, var(--cs-surface))",
        borderBottom: "0.5px solid var(--cs-border)",
        gap: 0,
      }}
    >
      {/* Total Budget — always visible */}
      <Stat
        label={isEs ? "PRESUPUESTO" : "BUDGET"}
        value={loaded ? fmt(stats.total) : null}
        valueColor="#f97316"
      />
      <Divider />

      {/* Approved — always visible */}
      <Stat
        label={isEs ? "APROBADO" : "APPROVED"}
        value={loaded ? fmt(stats.approved) : null}
        valueColor="#22c55e"
      />
      <Divider className="hidden md:block" />

      {/* APU count — hidden on mobile */}
      <Stat
        label="APUs"
        value={apuCount !== null ? String(apuCount) : null}
        className="hidden md:flex"
      />
      <Divider className="hidden md:block" />

      {/* Item count — hidden on mobile */}
      <Stat
        label={isEs ? "PARTIDAS" : "ITEMS"}
        value={loaded ? String(stats.itemCount) : null}
        className="hidden md:flex"
      />
      <Divider className="hidden md:block" />

      {/* Weeks — hidden on mobile */}
      <Stat
        label={isEs ? "SEMANAS" : "WEEKS"}
        value={weekCount !== null ? String(weekCount) : null}
        className="hidden md:flex"
      />
      <Divider />

      {/* Progress bar — always visible */}
      <div className="flex items-center gap-2 shrink-0" style={{ padding: "0 12px" }}>
        <span
          className="font-dm-sans uppercase hidden md:inline"
          style={{ fontSize: 10, color: "var(--cs-muted)", letterSpacing: "0.04em" }}
        >
          {isEs ? "% APROBADO" : "% APPROVED"}
        </span>
        {loaded ? (
          <div className="flex items-center gap-2">
            <div
              style={{
                width: 60,
                height: 6,
                borderRadius: 3,
                background: "var(--cs-border)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${stats.pct}%`,
                  height: "100%",
                  borderRadius: 3,
                  background: "#22c55e",
                  transition: "width 300ms ease",
                }}
              />
            </div>
            <span
              className="font-dm-sans"
              style={{ fontSize: 13, fontWeight: 500, color: "#22c55e" }}
            >
              {stats.pct}%
            </span>
          </div>
        ) : (
          <Skeleton width={80} />
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  valueColor,
  className = "",
}: {
  label: string;
  value: string | null;
  valueColor?: string;
  className?: string;
}) {
  return (
    <div className={`items-center gap-1.5 shrink-0 flex ${className}`} style={{ padding: "0 10px" }}>
      <span
        className="font-dm-sans uppercase"
        style={{ fontSize: 10, color: "var(--cs-muted)", letterSpacing: "0.04em", whiteSpace: "nowrap" }}
      >
        {label}
      </span>
      {value !== null ? (
        <span
          className="font-dm-sans"
          style={{ fontSize: 13, fontWeight: 500, color: valueColor ?? "var(--cs-text)", whiteSpace: "nowrap" }}
        >
          {value}
        </span>
      ) : (
        <Skeleton width={48} />
      )}
    </div>
  );
}

function Divider({ className = "" }: { className?: string }) {
  return (
    <div
      className={`shrink-0 ${className}`}
      style={{ width: 0.5, height: 20, background: "var(--cs-border)" }}
    />
  );
}

function Skeleton({ width }: { width: number }) {
  return (
    <>
      <style>{`@keyframes cs-pulse{0%,100%{opacity:.4}50%{opacity:1}}`}</style>
      <div
        style={{
          width,
          height: 12,
          borderRadius: 3,
          background: "var(--cs-border)",
          animation: "cs-pulse 1.5s ease-in-out infinite",
        }}
      />
    </>
  );
}
