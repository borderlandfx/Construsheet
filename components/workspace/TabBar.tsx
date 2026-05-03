"use client";

import { Table2, BarChart3, GanttChartSquare, Ruler, BarChart2 } from "lucide-react";
import { useWorkspace } from "@/lib/context/WorkspaceContext";

export type TabId = "apu" | "budget" | "gantt" | "takeoff" | "reports";

interface TabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  counts?: Partial<Record<TabId, number>>;
}

const TABS: { id: TabId; icon: React.ElementType; label: { es: string; en: string } }[] = [
  { id: "apu",     icon: Table2,           label: { es: "APU",          en: "APU"      } },
  { id: "budget",  icon: BarChart3,        label: { es: "Presupuesto",  en: "Budget"   } },
  { id: "gantt",   icon: GanttChartSquare, label: { es: "Cronograma",   en: "Schedule" } },
  { id: "takeoff", icon: Ruler,            label: { es: "Generadores",  en: "Takeoff"  } },
  { id: "reports", icon: BarChart2,        label: { es: "Reportes",     en: "Reports"  } },
];

export default function TabBar({ activeTab, onTabChange, counts }: TabBarProps) {
  const { language } = useWorkspace();

  return (
    <div
      className="shrink-0"
      style={{
        borderBottom: "1px solid var(--cs-border)",
        background: "var(--cs-surface)",
      }}
    >
      {/* ── Mobile: dropdown select (<640px) ─────────────────── */}
      <div className="sm:hidden px-4 py-2">
        <select
          value={activeTab}
          onChange={(e) => onTabChange(e.target.value as TabId)}
          aria-label="Select tab"
          className="w-full rounded-lg px-3 py-2 text-sm font-medium font-dm-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cs-accent)]"
          style={{
            background: "var(--cs-bg2)",
            border: "1px solid var(--cs-border)",
            color: "var(--cs-text)",
            cursor: "pointer",
          }}
        >
          {TABS.map(({ id, label }) => {
            const n = counts?.[id];
            return (
              <option key={id} value={id}>
                {language === "es" ? label.es : label.en}{n ? ` (${n})` : ""}
              </option>
            );
          })}
        </select>
      </div>

      {/* ── Desktop: tab buttons (≥640px) ────────────────────── */}
      <div className="hidden sm:flex items-end gap-0 px-4">
        {TABS.map(({ id, icon: Icon, label }) => {
          const active = activeTab === id;
          const count = counts?.[id];
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`tabpanel-${id}`}
              onClick={() => onTabChange(id)}
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium font-dm-sans transition-all duration-150 relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cs-accent)] focus-visible:ring-inset rounded-t-lg"
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: active ? "var(--cs-accent)" : "var(--cs-muted)",
                borderBottom: active
                  ? "2px solid var(--cs-accent)"
                  : "2px solid transparent",
                marginBottom: -1,
              }}
              onMouseEnter={(e) => {
                if (!active) (e.currentTarget as HTMLButtonElement).style.color = "var(--cs-text)";
              }}
              onMouseLeave={(e) => {
                if (!active) (e.currentTarget as HTMLButtonElement).style.color = "var(--cs-muted)";
              }}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {language === "es" ? label.es : label.en}
              {count != null && count > 0 && (
                <span
                  className="inline-flex items-center justify-center rounded-full font-dm-sans"
                  style={{
                    minWidth: 18, height: 18, padding: "0 5px",
                    fontSize: "0.65rem", fontWeight: 600,
                    background: active ? "rgba(249,115,22,0.18)" : "rgba(255,255,255,0.07)",
                    color: active ? "var(--cs-accent)" : "var(--cs-muted)",
                  }}
                  aria-label={`${count} items`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
