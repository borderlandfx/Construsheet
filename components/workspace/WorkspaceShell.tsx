"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { WorkspaceProvider, useWorkspace } from "@/lib/context/WorkspaceContext";
import TabBar, { type TabId } from "@/components/workspace/TabBar";
import ControlBar from "@/components/workspace/ControlBar";
import APUTab from "@/components/workspace/APUTab";
import BudgetTab from "@/components/workspace/BudgetTab";
import GanttTab from "@/components/workspace/GanttTab";
import type { Project, ApuItem, BudgetRow, GanttTask } from "@/lib/types/database.types";
import type { Currency } from "@/lib/utils/currency";
import type { Locale } from "@/lib/utils/i18n";

// ─── Inline editable project name ────────────────────────────────────────────

function ProjectNameEditor({ initialName, projectId }: { initialName: string; projectId: string }) {
  const supabase = createClient();
  const [name, setName] = useState(initialName);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setDraft(name);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function commit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== name) {
      setName(trimmed);
      await supabase.from("projects").update({ name: trimmed }).eq("id", projectId);
    }
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className="font-syne font-bold text-lg bg-transparent outline-none border-b-2"
          style={{
            color: "var(--cs-text)",
            borderColor: "var(--cs-accent)",
            minWidth: 120,
            maxWidth: 320,
          }}
        />
        <button
          type="button"
          onClick={commit}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--cs-accent)" }}
        >
          <Check className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      className="group flex items-center gap-2 bg-transparent border-none cursor-pointer"
    >
      <span className="font-syne font-bold text-lg" style={{ color: "var(--cs-text)" }}>
        {name}
      </span>
      <Pencil
        className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: "var(--cs-muted)" }}
      />
    </button>
  );
}

// ─── Status pill for project ──────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  active:    { bg: "rgba(34,197,94,0.1)",   color: "#22c55e" },
  completed: { bg: "rgba(20,184,166,0.1)",  color: "#14b8a6" },
  archived:  { bg: "rgba(107,114,128,0.1)", color: "#6b7280" },
};

function StatusPill({ status, language }: { status: string; language: Locale }) {
  const cfg = STATUS_COLORS[status] ?? STATUS_COLORS.active;
  const labels: Record<string, Record<Locale, string>> = {
    active:    { es: "Activo",    en: "Active"    },
    completed: { es: "Completado", en: "Completed" },
    archived:  { es: "Archivado", en: "Archived"  },
  };
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium font-dm-sans"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      <span className="rounded-full" style={{ width: 5, height: 5, background: cfg.color, display: "inline-block" }} />
      {labels[status]?.[language] ?? status}
    </span>
  );
}

// ─── Inner workspace (has access to context) ──────────────────────────────────

function WorkspaceInner({
  project,
  apuItems,
  budgetRows,
  ganttTasks,
  userEmail,
}: {
  project: Project;
  apuItems: ApuItem[];
  budgetRows: BudgetRow[];
  ganttTasks: GanttTask[];
  userEmail: string;
}) {
  const { language, projectId } = useWorkspace();
  const [activeTab, setActiveTab] = useState<TabId>("apu");
  const userInitial = userEmail.charAt(0);

  return (
    // Escape layout padding with negative margin; fill remaining viewport below fixed navbar
    <div
      style={{
        margin: "-2rem",
        marginTop: "-2rem",
        height: "calc(100vh - 56px)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "var(--cs-bg)",
      }}
    >
      {/* ── Top bar ─────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-5 shrink-0 flex-wrap"
        style={{
          height: 60,
          borderBottom: "1px solid var(--cs-border)",
          background: "var(--cs-surface)",
        }}
      >
        {/* Back */}
        <Link
          href="/dashboard"
          className="flex items-center justify-center rounded-lg transition-colors shrink-0"
          style={{
            width: 32,
            height: 32,
            border: "1px solid var(--cs-border)",
            color: "var(--cs-muted)",
            textDecoration: "none",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--cs-text)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--cs-muted)")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        {/* Divider */}
        <div className="h-5 w-px shrink-0" style={{ background: "var(--cs-border)" }} />

        {/* Project name + status */}
        <div className="flex items-center gap-2 min-w-0">
          <ProjectNameEditor initialName={project.name} projectId={projectId} />
          <StatusPill status={project.status} language={language} />
          {project.location && (
            <span className="text-xs font-dm-sans hidden sm:block" style={{ color: "var(--cs-muted)" }}>
              · {project.location}
            </span>
          )}
        </div>

        {/* Push controls to the right */}
        <div className="flex-1" />

        {/* Control bar */}
        <ControlBar userEmail={userEmail} userInitial={userInitial} />
      </div>

      {/* ── Tab bar ─────────────────────────────────── */}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* ── Tab content (scrollable) ─────────────────── */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ background: "var(--cs-bg)" }}
      >
        <div style={{ padding: "1.5rem", maxWidth: 1100, margin: "0 auto" }}>
          {activeTab === "apu" && <APUTab initialItems={apuItems} />}
          {activeTab === "budget" && <BudgetTab initialRows={budgetRows} />}
          {activeTab === "gantt" && <GanttTab initialTasks={ganttTasks} />}
        </div>
      </div>
    </div>
  );
}

// ─── Shell — sets up context ──────────────────────────────────────────────────

export interface WorkspaceShellProps {
  project: Project;
  apuItems: ApuItem[];
  budgetRows: BudgetRow[];
  ganttTasks: GanttTask[];
  userId: string;
  userEmail: string;
  initialCurrency: Currency;
  initialLanguage: Locale;
}

export default function WorkspaceShell({
  project,
  apuItems,
  budgetRows,
  ganttTasks,
  userId,
  userEmail,
  initialCurrency,
  initialLanguage,
}: WorkspaceShellProps) {
  return (
    <WorkspaceProvider
      projectId={project.id}
      userId={userId}
      initialCurrency={initialCurrency}
      initialLanguage={initialLanguage}
    >
      <WorkspaceInner
        project={project}
        apuItems={apuItems}
        budgetRows={budgetRows}
        ganttTasks={ganttTasks}
        userEmail={userEmail}
      />
    </WorkspaceProvider>
  );
}
