"use client";

import { Table2, BarChart3, GanttChartSquare, Ruler, BarChart2, Calculator } from "lucide-react";
import { useWorkspace } from "@/lib/context/WorkspaceContext";

export type TabId = "budget" | "gantt" | "takeoff" | "apu" | "reports" | "costs";

interface TabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  counts?: Partial<Record<TabId, number>>;
}

const TABS: { id: TabId; icon: React.ElementType; label: { es: string; en: string } }[] = [
  { id: "budget",  icon: BarChart3,        label: { es: "Presupuesto",       en: "Budget"         } },
  { id: "gantt",   icon: GanttChartSquare, label: { es: "Cronograma",        en: "Schedule"       } },
  { id: "takeoff", icon: Ruler,            label: { es: "Generadores",       en: "Takeoff"        } },
  { id: "apu",     icon: Table2,           label: { es: "APU",               en: "APU"            } },
  { id: "reports", icon: BarChart2,        label: { es: "Reportes",          en: "Reports"        } },
  { id: "costs",   icon: Calculator,       label: { es: "Costos Indirectos", en: "Indirect Costs" } },
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
      <div className="flex items-end gap-0 px-2 md:px-4 overflow-x-auto scrollbar-none">
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
              data-tab={id}
              className="flex items-center gap-1.5 md:gap-2 px-2.5 md:px-4 py-2.5 md:py-3 text-xs md:text-sm font-medium font-dm-sans transition-all duration-150 relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cs-accent)] focus-visible:ring-inset rounded-t-lg shrink-0"
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: active ? "var(--cs-accent)" : "var(--cs-muted)",
                borderBottom: active
                  ? "2px solid var(--cs-accent)"
                  : "2px solid transparent",
                marginBottom: -1,
                minHeight: 44,
              }}
              onMouseEnter={(e) => {
                if (!active) (e.currentTarget as HTMLButtonElement).style.color = "var(--cs-text)";
              }}
              onMouseLeave={(e) => {
                if (!active) (e.currentTarget as HTMLButtonElement).style.color = "var(--cs-muted)";
              }}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className="whitespace-nowrap">{language === "es" ? label.es : label.en}</span>
              {count != null && count > 0 && (
                <span
                  className="hidden md:inline-flex items-center justify-center rounded-full font-dm-sans"
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
