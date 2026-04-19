"use client";

import { Table2, BarChart3, GanttChartSquare } from "lucide-react";
import { useWorkspace } from "@/lib/context/WorkspaceContext";
import { t } from "@/lib/utils/i18n";

export type TabId = "apu" | "budget" | "gantt";

interface TabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const TABS: { id: TabId; icon: React.ElementType; labelKey: "apu" | "budget" | "gantt" }[] = [
  { id: "apu",    icon: Table2,           labelKey: "apu"    },
  { id: "budget", icon: BarChart3,        labelKey: "budget" },
  { id: "gantt",  icon: GanttChartSquare, labelKey: "gantt"  },
];

export default function TabBar({ activeTab, onTabChange }: TabBarProps) {
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
          {TABS.map(({ id, labelKey }) => (
            <option key={id} value={id}>
              {t(labelKey, language)}
            </option>
          ))}
        </select>
      </div>

      {/* ── Desktop: tab buttons (≥640px) ────────────────────── */}
      <div className="hidden sm:flex items-end gap-0 px-4">
        {TABS.map(({ id, icon: Icon, labelKey }) => {
          const active = activeTab === id;
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
              {t(labelKey, language)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
