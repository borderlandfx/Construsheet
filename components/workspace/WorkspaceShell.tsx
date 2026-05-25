"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, Check, Settings2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { WorkspaceProvider, useWorkspace } from "@/lib/context/WorkspaceContext";
import TabBar from "@/components/workspace/TabBar";
import { ContextualToolbar } from "@/components/workspace/ContextualToolbar";
import ControlBar from "@/components/workspace/ControlBar";
import APUTab from "@/components/workspace/APUTab";
import BudgetTab from "@/components/workspace/BudgetTab";
import GanttTab from "@/components/workspace/GanttTab";
import TakeoffTab from "@/components/workspace/TakeoffTab";
import ReportsTab from "@/components/workspace/ReportsTab";
import SummaryBar from "@/components/workspace/SummaryBar";
import IndirectCostsPanel from "@/components/workspace/IndirectCostsPanel";
import type { Project, ApuItem, BudgetRow, GanttTask, TakeoffItem, ProjectIndirectCosts } from "@/lib/types/database.types";
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

// ─── Status changer for project ──────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  active:    { bg: "rgba(34,197,94,0.1)",   color: "#22c55e" },
  completed: { bg: "rgba(20,184,166,0.1)",  color: "#14b8a6" },
  archived:  { bg: "rgba(107,114,128,0.1)", color: "#6b7280" },
};

const STATUS_LABELS: Record<string, Record<Locale, string>> = {
  active:    { es: "Activo",     en: "Active"    },
  completed: { es: "Completado", en: "Completed" },
  archived:  { es: "Archivado",  en: "Archived"  },
};

function StatusChanger({ projectId, status: initialStatus, language }: { projectId: string; status: string; language: Locale }) {
  const supabase = createClient();
  const [status, setStatus] = useState(initialStatus);
  const [open, setOpen] = useState(false);
  const cfg = STATUS_COLORS[status] ?? STATUS_COLORS.active;

  async function handleChange(next: string) {
    setStatus(next);
    setOpen(false);
    await supabase.from("projects").update({ status: next as "active" | "archived" | "completed" }).eq("id", projectId);
  }

  return (
    <div className="relative" style={{ zIndex: 10 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium font-dm-sans cursor-pointer transition-opacity hover:opacity-80"
        style={{ background: cfg.bg, color: cfg.color, border: "none" }}
        title={language === "es" ? "Cambiar estado" : "Change status"}
      >
        <span className="rounded-full" style={{ width: 5, height: 5, background: cfg.color, display: "inline-block" }} />
        {STATUS_LABELS[status]?.[language] ?? status}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div
            className="absolute top-full mt-1 left-0 z-30 rounded-xl py-1 overflow-hidden"
            style={{
              background: "var(--cs-surface)",
              border: "1px solid var(--cs-border)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              minWidth: 140,
            }}
          >
            {["active", "completed", "archived"].map((s) => {
              const c = STATUS_COLORS[s];
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleChange(s)}
                  className="flex items-center gap-2 px-4 py-2 w-full text-xs font-medium font-dm-sans"
                  style={{
                    background: s === status ? "rgba(255,255,255,0.06)" : "none",
                    border: "none",
                    cursor: "pointer",
                    color: s === status ? c.color : "var(--cs-text)",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"; }}
                  onMouseLeave={(e) => { if (s !== status) (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                >
                  <span className="rounded-full shrink-0" style={{ width: 7, height: 7, background: c.color, display: "inline-block" }} />
                  {STATUS_LABELS[s]?.[language] ?? s}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Inner workspace (has access to context) ──────────────────────────────────

function WorkspaceInner({
  project,
  apuItems,
  budgetRows,
  ganttTasks,
  takeoffItems,
  userEmail,
}: {
  project: Project;
  apuItems: ApuItem[];
  budgetRows: BudgetRow[];
  ganttTasks: GanttTask[];
  takeoffItems: TakeoffItem[];
  userEmail: string;
}) {
  const { language, projectId, activeTab, setActiveTab } = useWorkspace();
  const isEs = language === "es";
  const [showCosts, setShowCosts] = useState(false);
  const userInitial = userEmail.charAt(0);

  // Live tab counts — updated by each tab's realtime subscription
  const [counts, setCounts] = useState({
    apu:     apuItems.length,
    budget:  budgetRows.length,
    gantt:   ganttTasks.length,
    takeoff: takeoffItems.length,
  });
  const setTabCount = useCallback((tab: "apu" | "budget" | "gantt" | "takeoff", n: number) => {
    setCounts((prev) => prev[tab] === n ? prev : { ...prev, [tab]: n });
  }, []);

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
          <StatusChanger projectId={projectId} status={project.status} language={language} />
          {project.location && (
            <span className="text-xs font-dm-sans hidden sm:block" style={{ color: "var(--cs-muted)" }}>
              · {project.location}
            </span>
          )}
        </div>

        {/* Push controls to the right */}
        <div className="flex-1" />

        {/* Indirect costs settings button */}
        <button
          type="button"
          onClick={() => setShowCosts(true)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium font-dm-sans transition-colors shrink-0"
          style={{
            border: "1px solid var(--cs-border)",
            background: "transparent",
            color: "var(--cs-muted)",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--cs-text)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--cs-accent)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--cs-muted)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--cs-border)";
          }}
        >
          <Settings2 className="h-3.5 w-3.5" />
          {isEs ? "Costos" : "Costs"}
        </button>

        {/* Control bar */}
        <ControlBar userEmail={userEmail} userInitial={userInitial} />
      </div>

      {/* ── Summary bar ──────────────────────────────── */}
      <SummaryBar />

      {/* ── Tab bar ─────────────────────────────────── */}
      <TabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={counts}
      />

      {/* ── Contextual toolbar ────────────────────────── */}
      <ContextualToolbar />

      {/* ── Tab content (scrollable) ─────────────────── */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ background: "var(--cs-bg)" }}
      >
        <div style={{ padding: "1.5rem", maxWidth: 1100, margin: "0 auto" }}>
          {activeTab === "apu"     && <APUTab initialItems={apuItems} onCountChange={(n) => setTabCount("apu", n)} />}
          {activeTab === "budget"  && <BudgetTab initialRows={budgetRows} apuItems={apuItems} onCountChange={(n) => setTabCount("budget", n)} />}
          {activeTab === "gantt"   && <GanttTab initialTasks={ganttTasks} projectCreatedAt={project.created_at} onCountChange={(n) => setTabCount("gantt", n)} />}
          {activeTab === "takeoff" && <TakeoffTab initialItems={takeoffItems} onCountChange={(n) => setTabCount("takeoff", n)} />}
          {activeTab === "reports" && <ReportsTab />}
        </div>
      </div>

      {/* ── Indirect costs panel ─────────────────────── */}
      {showCosts && (
        <IndirectCostsPanel onClose={() => setShowCosts(false)} />
      )}
    </div>
  );
}

// ─── Shell — sets up context ──────────────────────────────────────────────────

export interface WorkspaceShellProps {
  project: Project;
  apuItems: ApuItem[];
  budgetRows: BudgetRow[];
  ganttTasks: GanttTask[];
  takeoffItems: TakeoffItem[];
  userId: string;
  userEmail: string;
  initialCurrency: Currency;
  initialLanguage: Locale;
  initialSettings?: ProjectIndirectCosts;
}

export default function WorkspaceShell({
  project,
  apuItems,
  budgetRows,
  ganttTasks,
  takeoffItems,
  userId,
  userEmail,
  initialCurrency,
  initialLanguage,
  initialSettings,
}: WorkspaceShellProps) {
  return (
    <WorkspaceProvider
      projectId={project.id}
      userId={userId}
      initialCurrency={initialCurrency}
      initialLanguage={initialLanguage}
      initialSettings={initialSettings}
      initialBudgetRows={budgetRows.filter((r) => {
        const desc = r.description.trim();
        return !(
          (desc === "(empty)" || desc === "(vacío)" || desc === "") &&
          (r.code === "—" || r.code === null || r.code === undefined || r.code === "") &&
          r.quantity === 0 && r.unit_price === 0
        );
      }).map((r) => ({ ...r, section: r.section.trim() }))}
    >
      <WorkspaceInner
        project={project}
        apuItems={apuItems}
        budgetRows={budgetRows}
        ganttTasks={ganttTasks}
        takeoffItems={takeoffItems}
        userEmail={userEmail}
      />
    </WorkspaceProvider>
  );
}
