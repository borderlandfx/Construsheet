"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  Trash2, Loader2, X,
  Download, Copy, ChevronRight, ChevronDown,
  FileText, LayoutList, CalendarDays, Lock, CalendarOff, ArrowRight,
} from "lucide-react";
import {
  ToolbarPortal, ToolbarGroup, ToolbarSep,
  TBtn, TBadge,
} from "@/components/workspace/ContextualToolbar";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/context/WorkspaceContext";
import { useToast } from "@/lib/context/ToastContext";
import { t } from "@/lib/utils/i18n";
import type { GanttTask, GanttTaskInsert } from "@/lib/types/database.types";
import type { Locale } from "@/lib/utils/i18n";
import { useMiddleClickScroll } from "@/lib/hooks/useMiddleClickScroll";
// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_WEEKS = 24;

const BAR_COLORS = [
  "#f97316", "#14b8a6", "#3b82f6", "#8b5cf6",
  "#fbbf24", "#22c55e",
] as const;

const STATUS_CFG = {
  pending:      { label: { es: "Pendiente",   en: "Pending"      }, color: "#60a5fa" },
  "in-review":  { label: { es: "En revisión", en: "Under Review" }, color: "#f59e0b" },
  approved:     { label: { es: "Aprobado",    en: "Approved"     }, color: "#10b981" },
} as const;

type StatusKey = keyof typeof STATUS_CFG;

const CS = {
  surface: "var(--cs-surface)",
  border:  "var(--cs-border)",
  accent:  "var(--cs-accent)",
  text:    "var(--cs-text)",
  muted:   "var(--cs-muted)",
  bg:      "var(--cs-bg)",
} as const;

const FIELD: React.CSSProperties = {
  width: "100%",
  padding: "0.4rem 0.625rem",
  borderRadius: 8,
  border: `1px solid ${CS.border}`,
  background: "rgba(255,255,255,0.04)",
  color: CS.text,
  fontSize: "0.8125rem",
  fontFamily: "var(--font-dm-sans)",
  outline: "none",
};

const LBL: React.CSSProperties = {
  display: "block",
  fontSize: "0.75rem",
  fontWeight: 500,
  color: CS.muted,
  fontFamily: "var(--font-dm-sans)",
  marginBottom: 4,
};

// Left panel width — must match in both header and rows
const LEFT_W = 280;
const ACTION_W = 56;

// Zoom: minimum pixels per week column (0 = auto-fit)
const ZOOM_STEPS = [0, 26, 36, 52, 72, 100] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function exportCSV(tasks: GanttTask[], totalWeeks: number, language: Locale, projectCreatedAt: string) {
  const projectStart = new Date(projectCreatedAt);
  function weekStartDate(weekNum: number): Date {
    const d = new Date(projectStart);
    d.setDate(d.getDate() + (weekNum - 1) * 7);
    return d;
  }
  const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

  const headers = [
    language === "es" ? "Nombre" : "Name",
    language === "es" ? "Estatus" : "Status",
    language === "es" ? "Avance %" : "Progress %",
    language === "es" ? "S. Inicio" : "Start Week",
    language === "es" ? "Duración (sem)" : "Duration (wks)",
    language === "es" ? "Fecha inicio" : "Start Date",
    language === "es" ? "Fecha fin" : "End Date",
    ...Array.from({ length: totalWeeks }, (_, i) => `S${i + 1}`),
  ];

  const rows = tasks.map((task) => {
    const statusLabel = STATUS_CFG[task.status as StatusKey]?.label[language] ?? task.status;
    const startDate = weekStartDate(task.start_week);
    const endDate = weekStartDate(task.start_week + task.duration_weeks - 1);
    endDate.setDate(endDate.getDate() + 6);
    const weekCols = Array.from({ length: totalWeeks }, (_, i) => {
      const w = i + 1;
      return w >= task.start_week && w < task.start_week + task.duration_weeks ? "X" : "";
    });
    return [
      task.name,
      statusLabel,
      task.progress_pct ?? 0,
      task.start_week,
      task.duration_weeks,
      fmtDate(startDate),
      fmtDate(endDate),
      ...weekCols,
    ];
  });

  const csv = [headers, ...rows]
    .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gantt-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── SortableGanttRow ─────────────────────────────────────────────────────────

const PROGRESS_STEPS = [0, 25, 50, 75, 100] as const;

interface SortableGanttRowProps {
  task: GanttTask;
  totalWeeks: number;
  todayPct: number | null;
  language: Locale;
  isResizing: boolean;
  isMoving: boolean;
  projectStart: Date;
  timelineMinPx: number;
  isParent?: boolean;
  isChild?: boolean;
  isCollapsed?: boolean;
  childCount?: number;
  onToggleCollapse?: () => void;
  onDelete: (id: string) => void;
  onDuplicate: (task: GanttTask) => void;
  onProgressCycle: (id: string) => void;
  onResizeStart: (e: React.MouseEvent, task: GanttTask) => void;
  onResizeLeftStart: (e: React.MouseEvent, task: GanttTask) => void;
  onMoveStart: (e: React.MouseEvent, task: GanttTask) => void;
  onEdit: (task: GanttTask) => void;
}

function SortableGanttRow({
  task, totalWeeks, todayPct, language, isResizing, isMoving, projectStart, timelineMinPx,
  isParent, isChild, isCollapsed, childCount, onToggleCollapse,
  onDelete, onDuplicate, onProgressCycle, onResizeStart, onResizeLeftStart, onMoveStart, onEdit,
}: SortableGanttRowProps) {

  const statusCfg = STATUS_CFG[task.status as StatusKey] ?? STATUS_CFG.pending;
  const barColor = isParent ? "#f97316" : "#3b82f6";
  const barHeight = isParent ? 20 : 14;
  const rowH = isParent ? 36 : 34;

  // Bar geometry (clamped so it can't overflow)
  const startPct = Math.min(((task.start_week - 1) / totalWeeks) * 100, 95);
  const maxWidth = 100 - startPct;
  const widthPct = Math.min((task.duration_weeks / totalWeeks) * 100, maxWidth);

  // Tooltip date range
  const barStartDate = new Date(projectStart);
  barStartDate.setDate(barStartDate.getDate() + (task.start_week - 1) * 7);
  const barEndDate = new Date(projectStart);
  barEndDate.setDate(barEndDate.getDate() + (task.start_week - 1 + task.duration_weeks) * 7 - 1);
  const dateLocale = language === "es" ? "es-MX" : "en-US";
  const fmtDate = (d: Date) => d.toLocaleDateString(dateLocale, { day: "numeric", month: "short" });
  const barDateRange = `${fmtDate(barStartDate)} – ${fmtDate(barEndDate)}`;

  return (
    <div
      style={{ borderBottom: "0.5px solid var(--color-border-tertiary)", position: "relative", background: isParent ? "var(--color-background-secondary)" : undefined }}
      className="group flex items-center hover:bg-white/[0.02]"
      data-testid={`gantt-row-${task.id}`}
    >
      {/* ── Left panel ──────────────────── */}
      <div
        className="flex items-center gap-2 shrink-0"
        style={{
          width: LEFT_W, minWidth: LEFT_W, borderRight: "0.5px solid var(--color-border-tertiary)",
          padding: "6px 8px", paddingLeft: isChild ? 32 : 8, minHeight: rowH,
        }}
      >
        {/* Collapse toggle for chapters */}
        {isParent ? (
          <button type="button" onClick={onToggleCollapse}
            className="flex items-center justify-center shrink-0"
            style={{ width: 18, height: 18, background: "none", border: "none", cursor: "pointer", color: "#f97316" }}
            aria-label={isCollapsed ? "Expand" : "Collapse"}>
            {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="shrink-0 rounded-full" style={{ width: 7, height: 7, background: statusCfg.color }} />
        )}

        {/* Task name — click to edit */}
        <button type="button" onClick={() => onEdit(task)}
          className={`font-dm-sans flex-1 truncate text-left ${isParent ? "font-bold uppercase" : ""}`}
          style={{
            color: isParent ? "#f97316" : CS.text, minWidth: 0, background: "none", border: "none",
            cursor: "pointer", padding: 0, fontSize: isParent ? 11 : 12,
            letterSpacing: isParent ? "0.04em" : undefined,
          }}
          title={language === "es" ? "Clic para editar" : "Click to edit"}>
          {task.name}
          {isParent && childCount !== undefined && childCount > 0 && (
            <span style={{ fontWeight: 400, fontSize: 10, marginLeft: 6, opacity: 0.5 }}>({childCount})</span>
          )}
        </button>

        {/* Progress badge — click cycles through 0/25/50/75/100 */}
        <button type="button" onClick={(e) => { e.stopPropagation(); onProgressCycle(task.id); }}
          className="shrink-0 font-dm-sans rounded"
          style={{ fontSize: 10, fontWeight: 600, padding: "1px 5px", background: `${barColor}22`, color: barColor, border: "none", cursor: "pointer", lineHeight: 1.5 }}
          title={language === "es" ? "Clic para cambiar avance" : "Click to cycle progress"}>
          {task.progress_pct ?? 0}%
        </button>
      </div>

      {/* ── Timeline panel ──────────────── */}
      <div className="relative flex-1" style={{ height: rowH, minWidth: timelineMinPx > 0 ? timelineMinPx : 0, overflow: "hidden" }}>
        {/* Alternating column backgrounds + grid lines */}
        {Array.from({ length: totalWeeks }).map((_, i) => (
          <div key={i} className="absolute top-0 bottom-0 pointer-events-none"
            style={{
              left: `${(i / totalWeeks) * 100}%`,
              width: `${(1 / totalWeeks) * 100}%`,
              background: i % 2 === 0 ? "var(--color-background-tertiary)" : "var(--color-background-secondary)",
              borderRight: "0.5px solid var(--color-border-tertiary)",
            }} />
        ))}

        {/* Task bar */}
        <div
          className="absolute top-1/2 -translate-y-1/2 flex items-center overflow-hidden select-none"
          title={barDateRange}
          onMouseDown={(e) => { if (e.button !== 0) return; onMoveStart(e, task); }}
          style={{
            left: `${startPct}%`, width: `${widthPct}%`, height: barHeight, minWidth: 4,
            background: barColor, borderRadius: 4, zIndex: 2,
            cursor: isMoving ? "grabbing" : "grab",
            opacity: task.status === "approved" ? 0.7 : 1,
            boxShadow: (isResizing || isMoving) ? `0 0 0 2px ${barColor}, 0 0 0 4px rgba(255,255,255,0.1)` : "none",
            transition: (isResizing || isMoving) ? "none" : "width 0.1s ease, left 0.1s ease",
          }}
        >
          {/* Resize handle — left edge */}
          {!isParent && (
            <div onMouseDown={(e) => { e.stopPropagation(); onResizeLeftStart(e, task); }}
              className="absolute left-0 top-0 bottom-0 flex items-center justify-center"
              style={{ width: 8, cursor: "ew-resize", background: "rgba(0,0,0,0.15)", borderRadius: "4px 0 0 4px", flexShrink: 0, zIndex: 3 }}>
              <div style={{ width: 1.5, height: Math.max(barHeight - 6, 4), background: "rgba(255,255,255,0.4)", borderRadius: 2 }} />
            </div>
          )}
          {/* Progress fill overlay */}
          {(task.progress_pct ?? 0) > 0 && (
            <div className="absolute inset-y-0 left-0 pointer-events-none"
              style={{ width: `${task.progress_pct}%`, background: "rgba(255,255,255,0.2)", transition: (isResizing || isMoving) ? "none" : "width 0.3s ease" }} />
          )}
          {/* Duration label inside bar */}
          {widthPct > 5 && (
            <span className="text-white truncate text-center flex-1"
              style={{ fontSize: 9, fontWeight: 600, pointerEvents: "none", position: "relative" }}>
              {task.duration_weeks}{language === "es" ? "s" : "w"}
            </span>
          )}
          {/* Resize handle — right edge */}
          <div onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, task); }}
            className="absolute right-0 top-0 bottom-0 flex items-center justify-center"
            style={{ width: 8, cursor: "ew-resize", background: "rgba(0,0,0,0.15)", borderRadius: "0 4px 4px 0", flexShrink: 0, zIndex: 3 }}>
            <div style={{ width: 1.5, height: Math.max(barHeight - 6, 4), background: "rgba(255,255,255,0.4)", borderRadius: 2 }} />
          </div>
        </div>

        {/* Today line in row */}
        {todayPct !== null && (
          <div className="absolute top-0 bottom-0 pointer-events-none"
            style={{ left: `${todayPct}%`, width: 2, background: CS.accent, opacity: 0.4, zIndex: 3 }} />
        )}
      </div>

      {/* ── Row actions ──────────────────── */}
      <div className="shrink-0 flex items-center justify-center gap-0.5" style={{ width: ACTION_W, height: rowH }}>
        <button type="button" onClick={() => onDuplicate(task)}
          className="flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ width: 22, height: 22, background: "none", border: "none", cursor: "pointer", color: CS.muted }}
          aria-label={language === "es" ? "Duplicar tarea" : "Duplicate task"}>
          <Copy className="h-3 w-3" />
        </button>
        <button type="button" onClick={() => onDelete(task.id)}
          className="flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ width: 22, height: 22, background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}
          aria-label="Delete task">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ─── EditTaskModal ────────────────────────────────────────────────────────────

interface EditTaskModalProps {
  task: GanttTask;
  language: Locale;
  onSaved: (task: GanttTask) => void;
  onClose: () => void;
}

function EditTaskModal({ task, language, onSaved, onClose }: EditTaskModalProps) {
  const supabase = createClient();
  const [saving, setSaving]       = useState(false);
  const [name, setName]           = useState(task.name);
  const [startWeek, setStartWeek] = useState(task.start_week);
  const [duration, setDuration]   = useState(task.duration_weeks);
  const status = task.status as StatusKey;
  const [progress, setProgress]   = useState(task.progress_pct ?? 0);
  const [color, setColor]         = useState(task.color);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    const update = {
      name: name.trim(),
      start_week: startWeek,
      duration_weeks: duration,
      progress_pct: progress,
      color,
    };
    await supabase.from("gantt_tasks").update(update).eq("id", task.id);
    setSaving(false);
    onSaved({ ...task, ...update });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full flex flex-col gap-4"
        style={{
          maxWidth: 480,
          background: CS.surface,
          border: `1px solid ${CS.border}`,
          borderRadius: 16,
          padding: "1.5rem",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        <div className="flex items-center justify-between">
          <span className="font-syne font-bold text-base" style={{ color: CS.text }}>
            {language === "es" ? "Editar Tarea" : "Edit Task"}
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: CS.muted }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div>
          <label style={LBL}>{t("taskName", language)} *</label>
          <input autoFocus style={FIELD} value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={LBL}>{language === "es" ? "Semana inicio" : "Start week"}</label>
            <input style={FIELD} type="number" min={1} value={startWeek}
              onChange={(e) => setStartWeek(Math.max(1, parseInt(e.target.value) || 1))} />
          </div>
          <div>
            <label style={LBL}>{language === "es" ? "Duración (sem.)" : "Duration (wks)"}</label>
            <input style={FIELD} type="number" min={1} value={duration}
              onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value) || 1))} />
          </div>
        </div>

        {/* Status (read-only) + Progress */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={LBL}>{language === "es" ? "Estatus" : "Status"}</label>
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium font-dm-sans"
              style={{ background: `${(STATUS_CFG[status] ?? STATUS_CFG.pending).color}33`, color: (STATUS_CFG[status] ?? STATUS_CFG.pending).color }}
            >
              {(STATUS_CFG[status] ?? STATUS_CFG.pending).label[language]}
            </span>
            <span className="block text-xs mt-1" style={{ color: CS.muted }}>
              {language === "es" ? "Se controla desde Presupuesto" : "Controlled from Budget"}
            </span>
          </div>
          <div>
            <label style={LBL}>
              {language === "es" ? "Avance" : "Progress"}
              <span style={{ marginLeft: 6, color: CS.accent, fontWeight: 700 }}>{progress}%</span>
            </label>
            <input style={FIELD} type="range" min={0} max={100} step={5} value={progress}
              onChange={(e) => setProgress(parseInt(e.target.value))} />
          </div>
        </div>

        <div>
          <label style={LBL}>{language === "es" ? "Color de barra" : "Bar color"}</label>
          <div className="flex gap-2 flex-wrap">
            {BAR_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)}
                className="rounded-full transition-transform"
                style={{
                  width: 22, height: 22, background: c, cursor: "pointer",
                  border: color === c ? "2px solid #fff" : "2px solid transparent",
                  transform: color === c ? "scale(1.25)" : "scale(1)",
                }} />
            ))}
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onClose}
            className="px-4 py-2 rounded-[10px] text-sm font-medium font-dm-sans"
            style={{ border: `1px solid ${CS.border}`, background: "transparent", color: CS.muted, cursor: "pointer" }}>
            {t("cancel", language)}
          </button>
          <button onClick={handleSave} disabled={saving || !name.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-semibold font-dm-sans"
            style={{
              background: CS.accent, color: "#fff", border: "none",
              cursor: saving || !name.trim() ? "not-allowed" : "pointer",
              opacity: saving || !name.trim() ? 0.6 : 1,
            }}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t("save", language)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── GanttTab ─────────────────────────────────────────────────────────────────

interface GanttTabProps {
  initialTasks: GanttTask[];
  projectCreatedAt: string;
  onCountChange?: (n: number) => void;
}

export default function GanttTab({ initialTasks, projectCreatedAt, onCountChange }: GanttTabProps) {
  const supabase = createClient();
  const { projectId, language, setActiveTab } = useWorkspace();
  const { toast } = useToast();
  const ganttRef = useMiddleClickScroll();

  const [tasks, setTasks] = useState<GanttTask[]>(
    [...initialTasks].sort((a, b) => a.sort_order - b.sort_order)
  );
  const [loading, setLoading]           = useState(initialTasks.length === 0);
  const [editingTask, setEditingTask]   = useState<GanttTask | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [resizingId, setResizingId]     = useState<string | null>(null);
  const [movingId, setMovingId]         = useState<string | null>(null);
  const [zoomStep, _setZoomStep]        = useState(0);
  const [viewMode, setViewMode]        = useState<"weeks" | "months">("weeks");
  const [expandedChapters, setExpandedChapters] = useState<string[]>([]);

  // ── Load on mount ───────────────────────────────────────────────────────────
  // Pure read — the DB trigger on budget_rows creates gantt_tasks automatically.
  // This effect only fetches what exists. No client-side creation.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from("gantt_tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order");
      if (cancelled) return;
      const loaded = ((data ?? []) as GanttTask[]).sort((a, b) => a.sort_order - b.sort_order);
      setTasks(loaded);
      // Default: all chapters expanded
      setExpandedChapters(loaded.filter((t) => !!t.is_chapter).map((t) => t.id));
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleCollapse(id: string) {
    setExpandedChapters((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  // Resize state stored in refs to avoid stale closures in document listeners
  const resizeStateRef = useRef<{
    taskId: string;
    startX: number;
    startDuration: number;
    pxPerWeek: number;
  } | null>(null);
  const currentDurationRef = useRef(0);

  // Move state (drag bar left/right to change start_week)
  const moveStateRef = useRef<{
    taskId: string;
    startX: number;
    startWeek: number;
    pxPerWeek: number;
  } | null>(null);
  const currentStartRef = useRef(1);

  // Ref to the timeline header for measuring px-per-week
  const timelineHeaderRef = useRef<HTMLDivElement>(null);

  // Group chapters with children and calculate chapter bar spans
  const { chapterTasks, childrenByChapter, orphanTasks } = useMemo(() => {
    const chapters = tasks.filter((t) => !!t.is_chapter).sort((a, b) => a.sort_order - b.sort_order);
    const childMap = new Map<string, GanttTask[]>();
    const assigned = new Set<string>();

    const adjustedChapters = chapters.map((chapter) => {
      const children = tasks
        .filter((t) => !t.is_chapter && (
          t.parent_task_id === chapter.id ||
          (t.budget_section && t.budget_section === chapter.budget_section)
        ))
        .sort((a, b) => a.sort_order - b.sort_order);
      childMap.set(chapter.id, children);
      for (const c of children) assigned.add(c.id);

      // Calculate span from children
      if (children.length > 0) {
        const startWeek = Math.min(...children.map((c) => c.start_week || 1));
        const endWeek = Math.max(...children.map((c) => (c.start_week || 1) + (c.duration_weeks || 1)));
        const duration = endWeek - startWeek;
        return { ...chapter, start_week: startWeek, duration_weeks: duration > 0 ? duration : 1 };
      }
      return chapter;
    });

    const orphans = tasks
      .filter((t) => !t.is_chapter && !assigned.has(t.id))
      .sort((a, b) => a.sort_order - b.sort_order);

    return { chapterTasks: adjustedChapters, childrenByChapter: childMap, orphanTasks: orphans };
  }, [tasks]);

  const totalWeeks = Math.max(
    MIN_WEEKS,
    ...tasks.map((tk) => tk.start_week + tk.duration_weeks - 1)
  );

  // Minimum px for the timeline section; 0 = fill container (default)
  const colPx = ZOOM_STEPS[zoomStep] ?? 0;
  const timelineMinPx = colPx > 0 ? colPx * totalWeeks : 0;

  // Current week relative to project start (1-based; 0 if before start)
  const todayWeek = Math.max(
    0,
    Math.ceil((Date.now() - new Date(projectCreatedAt).getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
  );
  const todayPct = todayWeek > 0 && todayWeek <= totalWeeks
    ? ((todayWeek - 1) / totalWeeks) * 100
    : null;

  // ── Global cursor while resizing ─────────────────────────────────────────────
  useEffect(() => {
    if (!resizingId) return;
    const prev = document.body.style.cursor;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = prev;
      document.body.style.userSelect = "";
    };
  }, [resizingId]);

  // ── Global cursor while moving bar ───────────────────────────────────────────
  useEffect(() => {
    if (!movingId) return;
    const prev = document.body.style.cursor;
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = prev;
      document.body.style.userSelect = "";
    };
  }, [movingId]);

  // ── Realtime ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const lang = language as Locale;
    const channel = supabase.channel(`gantt:${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "gantt_tasks", filter: `project_id=eq.${projectId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newTask = payload.new as GanttTask;
            setTasks((prev) => {
              if (prev.some((t) => t.id === newTask.id)) return prev;
              toast(lang === "es" ? "Nueva tarea en tiempo real" : "New task received", "info");
              return [...prev, newTask].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
            });
            // Auto-expand new chapters
            if (newTask.is_chapter) {
              setExpandedChapters((prev) => prev.includes(newTask.id) ? prev : [...prev, newTask.id]);
            }
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as GanttTask;
            setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
          } else if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as { id: string }).id;
            setTasks((prev) => prev.filter((t) => t.id !== deletedId));
          }
        }
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Listen for budget_rows DELETE to remove linked gantt tasks ─────────────
  useEffect(() => {
    const ch = supabase.channel(`budget-delete:${projectId}`)
      .on("postgres_changes",
        { event: "DELETE", schema: "public", table: "budget_rows", filter: `project_id=eq.${projectId}` },
        (payload) => {
          const deletedRowId = (payload.old as { id: string }).id;
          setTasks((prev) => prev.filter((t) => t.budget_row_id !== deletedRowId));
        }
      ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { onCountChange?.(tasks.length); }, [tasks.length]); // eslint-disable-line react-hooks/exhaustive-deps


  // ── Progress cycle (0 → 25 → 50 → 75 → 100 → 0) ─────────────────────────────
  async function handleProgressCycle(id: string) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const cur = task.progress_pct ?? 0;
    const idx = PROGRESS_STEPS.indexOf(cur as typeof PROGRESS_STEPS[number]);
    const next = PROGRESS_STEPS[(idx + 1) % PROGRESS_STEPS.length];
    // Infer status from new progress
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, progress_pct: next } : t))
    );
    await supabase.from("gantt_tasks").update({ progress_pct: next }).eq("id", id);
  }


  // ── Resize ───────────────────────────────────────────────────────────────────
  const handleResizeStart = useCallback(
    (e: React.MouseEvent, task: GanttTask) => {
      e.preventDefault();
      e.stopPropagation();

      const containerW =
        timelineHeaderRef.current?.getBoundingClientRect().width ?? 600;
      const pxPerWeek = containerW / totalWeeks;

      resizeStateRef.current = {
        taskId:        task.id,
        startX:        e.clientX,
        startDuration: task.duration_weeks,
        pxPerWeek,
      };
      currentDurationRef.current = task.duration_weeks;
      setResizingId(task.id);
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";

      function onMouseMove(ev: MouseEvent) {
        const state = resizeStateRef.current;
        if (!state) return;
        const delta = Math.round(
          (ev.clientX - state.startX) / state.pxPerWeek
        );
        const next = Math.max(1, state.startDuration + delta);
        currentDurationRef.current = next;
        setTasks((prev) =>
          prev.map((t) =>
            t.id === state.taskId ? { ...t, duration_weeks: next } : t
          )
        );
      }

      async function onMouseUp() {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setResizingId(null);
        const state = resizeStateRef.current;
        resizeStateRef.current = null;
        if (state) {
          await supabase
            .from("gantt_tasks")
            .update({ duration_weeks: currentDurationRef.current })
            .eq("id", state.taskId);
        }
      }

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [supabase, totalWeeks] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Resize left edge (change start_week + duration_weeks together) ──────────
  const resizeLeftRef = useRef<{
    taskId: string;
    startX: number;
    origStart: number;
    origDuration: number;
    pxPerWeek: number;
    currentStart: number;
    currentDuration: number;
  } | null>(null);

  const handleResizeLeftStart = useCallback(
    (e: React.MouseEvent, task: GanttTask) => {
      e.preventDefault();
      e.stopPropagation();

      const containerW = timelineHeaderRef.current?.getBoundingClientRect().width ?? 600;
      const pxPerWeek = containerW / totalWeeks;

      resizeLeftRef.current = {
        taskId: task.id,
        startX: e.clientX,
        origStart: task.start_week,
        origDuration: task.duration_weeks,
        pxPerWeek,
        currentStart: task.start_week,
        currentDuration: task.duration_weeks,
      };
      setResizingId(task.id);
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";

      function onMouseMove(ev: MouseEvent) {
        const state = resizeLeftRef.current;
        if (!state) return;
        const delta = Math.round((ev.clientX - state.startX) / state.pxPerWeek);
        // Clamp: can't move start past the original end
        const newStart = Math.max(1, Math.min(state.origStart + delta, state.origStart + state.origDuration - 1));
        const startDelta = newStart - state.origStart;
        const newDuration = Math.max(1, state.origDuration - startDelta);
        state.currentStart = newStart;
        state.currentDuration = newDuration;
        setTasks((prev) =>
          prev.map((t) =>
            t.id === state.taskId ? { ...t, start_week: newStart, duration_weeks: newDuration } : t
          )
        );
      }

      async function onMouseUp() {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setResizingId(null);
        const state = resizeLeftRef.current;
        resizeLeftRef.current = null;
        if (state) {
          await supabase
            .from("gantt_tasks")
            .update({ start_week: state.currentStart, duration_weeks: state.currentDuration })
            .eq("id", state.taskId);
        }
      }

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [supabase, totalWeeks] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Move bar (drag start_week) ───────────────────────────────────────────────
  const handleMoveStart = useCallback(
    (e: React.MouseEvent, task: GanttTask) => {
      e.preventDefault();
      e.stopPropagation();

      const containerW =
        timelineHeaderRef.current?.getBoundingClientRect().width ?? 600;
      const pxPerWeek = containerW / totalWeeks;

      moveStateRef.current = {
        taskId:    task.id,
        startX:    e.clientX,
        startWeek: task.start_week,
        pxPerWeek,
      };
      currentStartRef.current = task.start_week;
      setMovingId(task.id);

      function onMouseMove(ev: MouseEvent) {
        const state = moveStateRef.current;
        if (!state) return;
        const delta = Math.round((ev.clientX - state.startX) / state.pxPerWeek);
        const next = Math.max(1, state.startWeek + delta);
        currentStartRef.current = next;
        setTasks((prev) =>
          prev.map((t) => (t.id === state.taskId ? { ...t, start_week: next } : t))
        );
      }

      async function onMouseUp() {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        setMovingId(null);
        const state = moveStateRef.current;
        moveStateRef.current = null;
        if (state && currentStartRef.current !== state.startWeek) {
          await supabase
            .from("gantt_tasks")
            .update({ start_week: currentStartRef.current })
            .eq("id", state.taskId);
        }
      }

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [supabase, totalWeeks] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Delete ───────────────────────────────────────────────────────────────────
  function handleDelete(id: string) {
    setDeleteConfirm(id);
  }

  async function confirmDelete(id: string) {
    setDeleteConfirm(null);
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await supabase.from("gantt_tasks").delete().eq("id", id);
  }

  async function handleDuplicateTask(source: GanttTask) {
    const maxOrder = tasks.reduce((m, t) => Math.max(m, t.sort_order ?? 0), 0);
    const payload: GanttTaskInsert = {
      project_id: projectId,
      name: source.name + (language === "es" ? " (copia)" : " (copy)"),
      start_week: source.start_week,
      duration_weeks: source.duration_weeks,
      color: source.color,
      status: "pending",
      progress_pct: 0,
      sort_order: maxOrder + 1,
    };
    const { data, error } = await supabase.from("gantt_tasks").insert(payload).select().single();
    if (!error && data) {
      setTasks((prev) => [...prev, data as GanttTask]);
    }
  }

  const lang = language as Locale;

  // ── CSV ──────────────────────────────────────────────────────────────────────
  function handleCSV() {
    exportCSV(tasks, totalWeeks, lang, projectCreatedAt);
  }

  // ── PDF (print) ──────────────────────────────────────────────────────────────
  function handlePrintGantt() {
    const win = window.open("", "_blank", "width=1200,height=720,menubar=yes");
    if (!win) return;

    // Inline date helpers (projectStart / weekGroups / fmtWeekLabel are defined
    // later in component scope, so we duplicate the minimal logic here)
    const pdfStart = new Date(projectCreatedAt);
    const PDF_MON_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    const PDF_MON_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const PDF_MONTHS = lang === "es" ? PDF_MON_ES : PDF_MON_EN;

    function pdfWeekStart(weekNum: number): Date {
      const d = new Date(pdfStart);
      d.setDate(d.getDate() + (weekNum - 1) * 7);
      return d;
    }
    function pdfFmt(weekNum: number): string {
      const d = pdfWeekStart(weekNum);
      return `${PDF_MONTHS[d.getMonth()]} ${d.getDate()}`;
    }
    function pdfFmtFull(d: Date): string {
      return `${PDF_MONTHS[d.getMonth()]} ${d.getDate()}`;
    }

    const colW = 22;
    const pdfGroups = Array.from({ length: Math.ceil(totalWeeks / 4) }, (_, i) => ({
      start: i * 4 + 1,
      end: Math.min(i * 4 + 4, totalWeeks),
    }));

    // Two-row thead: row 1 = month group spans, row 2 = individual week dates
    const monthHeaderCells = pdfGroups.map((g) => {
      const span = g.end - g.start + 1;
      const label = pdfFmt(g.start);
      return `<th colspan="${span}" style="width:${span * colW}px;text-align:center;font-size:9px;border-right:1px solid #fff;background:#ea580c">${label}</th>`;
    }).join("");

    const weekHeaderCells = Array.from({ length: totalWeeks }, (_, i) => {
      const w = i + 1;
      const isGroupEnd = w % 4 === 0 || w === totalWeeks;
      return `<th style="width:${colW}px;text-align:center;font-size:8px;font-weight:400;background:#f97316;border-right:${isGroupEnd ? "1px solid #fff" : "none"}">${pdfFmt(w)}</th>`;
    }).join("");

    const dataRows = tasks.map((task) => {
      const statusLabel = STATUS_CFG[task.status as StatusKey]?.label[lang] ?? task.status;
      const progress = task.progress_pct ?? 0;
      const progressBar = `<div style="background:#e5e7eb;border-radius:4px;height:6px;width:56px;display:inline-block;vertical-align:middle"><div style="background:${task.color};height:6px;border-radius:4px;width:${progress}%"></div></div>&nbsp;<span style="color:#6b7280">${progress}%</span>`;

      // Actual date range for this task
      const taskStartD = pdfWeekStart(task.start_week);
      const taskEndD = pdfWeekStart(task.start_week + task.duration_weeks - 1);
      taskEndD.setDate(taskEndD.getDate() + 6); // end of last week
      const dateRange = `<span style="font-size:9px;color:#6b7280;white-space:nowrap">${pdfFmtFull(taskStartD)} – ${pdfFmtFull(taskEndD)}</span>`;

      const weekCells = Array.from({ length: totalWeeks }, (_, i) => {
        const w = i + 1;
        const inBar = w >= task.start_week && w < task.start_week + task.duration_weeks;
        const isGroupEnd = w % 4 === 0 || w === totalWeeks;
        const borderStyle = isGroupEnd ? "border-right:1px solid #e5e7eb;" : "";
        return `<td style="text-align:center;padding:2px;${borderStyle}">${inBar ? `<div style="background:${task.color};height:13px;border-radius:3px"></div>` : ""}</td>`;
      }).join("");

      return `<tr><td style="white-space:nowrap;padding:4px 8px;font-weight:500">${task.name}</td><td style="padding:4px 8px">${dateRange}</td><td style="padding:4px 8px;color:#6b7280;font-size:10px">${statusLabel}</td><td style="padding:4px 8px;font-size:10px">${progressBar}</td>${weekCells}</tr>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8"/>
  <title>${lang === "es" ? "Cronograma" : "Gantt Chart"} — ConstruSheet</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,-apple-system,sans-serif;font-size:11px;color:#111827;padding:20px}
    h1{font-size:16px;font-weight:700;margin-bottom:2px}
    .meta{font-size:10px;color:#6b7280;margin-bottom:12px}
    table{width:100%;border-collapse:collapse}
    thead th{color:#fff;padding:3px 4px;text-align:left;font-size:10px;font-weight:600}
    td{border-bottom:1px solid #f3f4f6;vertical-align:middle}
    tr:nth-child(even) td{background:#f9fafb}
    .footer{margin-top:12px;font-size:10px;color:#9ca3af;display:flex;justify-content:space-between}
    @media print{body{padding:8px}}
  </style>
</head>
<body>
  <h1>ConstruSheet — ${lang === "es" ? "Cronograma de Obra" : "Project Schedule"}</h1>
  <div class="meta">${lang === "es" ? "Generado" : "Generated"}: ${new Date().toLocaleDateString(lang === "es" ? "es-MX" : "en-US", { year: "numeric", month: "long", day: "numeric" })} &nbsp;·&nbsp; ${tasks.length} ${lang === "es" ? "tareas" : "tasks"} · ${totalWeeks} ${lang === "es" ? "semanas" : "weeks"} · ${lang === "es" ? "Inicio" : "Start"}: ${pdfFmtFull(pdfStart)}</div>
  <table>
    <thead>
      <tr>
        <th rowspan="2" style="width:160px;background:#f97316;vertical-align:bottom">${lang === "es" ? "Tarea" : "Task"}</th>
        <th rowspan="2" style="width:100px;background:#f97316;vertical-align:bottom">${lang === "es" ? "Fechas" : "Dates"}</th>
        <th rowspan="2" style="width:70px;background:#f97316;vertical-align:bottom">${lang === "es" ? "Estatus" : "Status"}</th>
        <th rowspan="2" style="width:90px;background:#f97316;vertical-align:bottom">${lang === "es" ? "Avance" : "Progress"}</th>
        ${monthHeaderCells}
      </tr>
      <tr>
        ${weekHeaderCells}
      </tr>
    </thead>
    <tbody>${dataRows}</tbody>
  </table>
  <div class="footer"><span>ConstruSheet</span><span>${new Date().toISOString().slice(0, 10)}</span></div>
  <script>setTimeout(()=>{window.print();},400)<\/script>
</body>
</html>`;
    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  // ── Week group headers (every 4 = ~1 month) ──────────────────────────────────
  const projectStart = new Date(projectCreatedAt);

  // Returns the Monday of the week that starts at week number `weekNum` (1-based)
  function weekStartDate(weekNum: number): Date {
    const d = new Date(projectStart);
    d.setDate(d.getDate() + (weekNum - 1) * 7);
    return d;
  }

  const SHORT_MONTHS_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const SHORT_MONTHS_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  function fmtWeekLabel(weekNum: number): string {
    const d = weekStartDate(weekNum);
    const months = lang === "es" ? SHORT_MONTHS_ES : SHORT_MONTHS_EN;
    return `${months[d.getMonth()]} ${d.getDate()}`;
  }

  const weekGroups = Array.from(
    { length: Math.ceil(totalWeeks / 4) },
    (_, i) => ({
      start: i * 4 + 1,
      end: Math.min(i * 4 + 4, totalWeeks),
    })
  );

  return (
    <>
    <ToolbarPortal>
      <ToolbarGroup label={lang === "es" ? "Exportar" : "Export"}>
        <TBtn onClick={handleCSV} disabled={tasks.length === 0}>
          <Download className="h-3.5 w-3.5" /> CSV
        </TBtn>
        <TBtn onClick={handlePrintGantt} disabled={tasks.length === 0}>
          <FileText className="h-3.5 w-3.5" /> PDF
        </TBtn>
      </ToolbarGroup>
      <ToolbarSep />
      <ToolbarGroup label={lang === "es" ? "Vista" : "View"}>
        <TBtn active={viewMode === "weeks"} onClick={() => setViewMode("weeks")}>
          <LayoutList className="h-3.5 w-3.5" /> {lang === "es" ? "Semanas" : "Weeks"}
        </TBtn>
        <TBtn active={viewMode === "months"} onClick={() => setViewMode("months")}>
          <CalendarDays className="h-3.5 w-3.5" /> {lang === "es" ? "Meses" : "Months"}
        </TBtn>
      </ToolbarGroup>
      <ToolbarSep />
      <div style={{ flex: 1 }} />
      <TBadge>
        <Lock className="h-3 w-3" /> {lang === "es" ? "Sincronizado con Presupuesto" : "Synced from Budget"}
      </TBadge>
    </ToolbarPortal>
    <div ref={ganttRef} className="construsheet-scroll" style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%", padding: "12px 16px", overflow: "auto", flex: 1, minHeight: 0 }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-syne font-bold text-lg" style={{ color: CS.text }}>
            {t("ganttTitle", lang)}
          </h2>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <p className="text-xs font-dm-sans" style={{ color: CS.muted }}>
              {tasks.length}{" "}
              {lang === "es" ? "tareas" : "tasks"} ·{" "}
              {totalWeeks}{" "}
              {lang === "es" ? "semanas" : "weeks"}
            </p>
            {tasks.length > 0 && (() => {
              const approved   = tasks.filter((t) => t.status === "approved").length;
              const inReview   = tasks.filter((t) => t.status === "in-review").length;
              const pending    = tasks.filter((t) => t.status === "pending").length;
              const avgPct = Math.round(tasks.reduce((s, t) => s + (t.progress_pct ?? 0), 0) / tasks.length);
              return (
                <>
                  <span style={{ color: CS.muted, fontSize: "0.65rem" }}>·</span>
                  {approved > 0 && (
                    <span className="text-xs font-dm-sans" style={{ color: STATUS_CFG.approved.color }}>
                      ✓ {approved}
                    </span>
                  )}
                  {inReview > 0 && (
                    <span className="text-xs font-dm-sans" style={{ color: STATUS_CFG["in-review"].color }}>
                      ⟳ {inReview}
                    </span>
                  )}
                  {pending > 0 && (
                    <span className="text-xs font-dm-sans" style={{ color: STATUS_CFG.pending.color }}>
                      ○ {pending}
                    </span>
                  )}
                  <span style={{ color: CS.muted, fontSize: "0.65rem" }}>·</span>
                  <span className="text-xs font-dm-sans font-semibold" style={{ color: CS.accent }}>
                    {avgPct}% {lang === "es" ? "avg" : "avg"}
                  </span>
                </>
              );
            })()}
          </div>
        </div>

        {/* Buttons moved to ContextualToolbar via portal */}
      </div>

      {/* ── Loading state ───────────────────────────────────── */}
      {loading && tasks.length === 0 && (
        <div
          className="flex flex-col items-center justify-center py-16 rounded-[10px] text-center gap-3"
          style={{ border: `1.5px dashed ${CS.border}` }}
        >
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: CS.accent }} />
          <p className="text-sm font-dm-sans" style={{ color: CS.muted }}>
            {lang === "es" ? "Cargando cronograma…" : "Loading schedule…"}
          </p>
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────── */}
      {!loading && tasks.length === 0 && (
        <div
          className="flex flex-col items-center justify-center rounded-[10px] text-center gap-4"
          style={{ padding: "60px 24px" }}
        >
          <CalendarOff className="h-12 w-12" style={{ color: CS.muted }} />
          <p className="font-dm-sans font-medium" style={{ fontSize: 18, color: CS.text }}>
            {lang === "es"
              ? "Sin actividades programadas"
              : "No scheduled activities"}
          </p>
          <p
            className="text-sm font-dm-sans"
            style={{ color: CS.muted, maxWidth: 400, textAlign: "center" }}
          >
            {lang === "es"
              ? "Las actividades aparecen automáticamente cuando agregas partidas al presupuesto"
              : "Activities appear automatically when you add items to the budget"}
          </p>
          <button
            onClick={() => setActiveTab("budget")}
            className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-semibold font-dm-sans"
            style={{ background: CS.accent, color: "#fff", border: "none", cursor: "pointer" }}
          >
            <ArrowRight className="h-4 w-4" />
            {lang === "es" ? "Ir al Presupuesto" : "Go to Budget"}
          </button>
        </div>
      )}

      {/* ── Mobile list view ─────────────────────────────── */}
      {tasks.length > 0 && (
        <div className="flex flex-col gap-2 sm:hidden">
          {chapterTasks.map((chapter) => {
            const children = childrenByChapter.get(chapter.id) ?? [];
            return (
              <div key={chapter.id}>
                <div
                  className="rounded-lg px-3 py-2 font-syne font-bold text-xs uppercase tracking-wider"
                  style={{ background: "rgba(249,115,22,0.07)", color: CS.accent, borderLeft: `3px solid ${CS.accent}` }}
                >
                  {chapter.name}
                </div>
                {children.map((task) => {
                  const cfg = STATUS_CFG[task.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.pending;
                  return (
                    <div
                      key={task.id}
                      className="flex items-center justify-between px-3 py-2.5"
                      style={{ borderBottom: `1px solid ${CS.border}`, minHeight: 44 }}
                    >
                      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                        <span className="text-sm font-dm-sans truncate" style={{ color: CS.text }}>{task.name}</span>
                        <span className="text-xs font-dm-sans" style={{ color: CS.muted }}>
                          {lang === "es" ? "S" : "W"}{task.start_week}–{task.start_week + task.duration_weeks - 1}
                        </span>
                      </div>
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold font-dm-sans shrink-0 ml-2"
                        style={{ background: `${cfg.color}20`, color: cfg.color }}
                      >
                        {cfg.label[lang]}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
          {orphanTasks.map((task) => {
            const cfg = STATUS_CFG[task.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.pending;
            return (
              <div
                key={task.id}
                className="flex items-center justify-between px-3 py-2.5"
                style={{ borderBottom: `1px solid ${CS.border}`, minHeight: 44 }}
              >
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span className="text-sm font-dm-sans truncate" style={{ color: CS.text }}>{task.name}</span>
                  <span className="text-xs font-dm-sans" style={{ color: CS.muted }}>
                    {lang === "es" ? "S" : "W"}{task.start_week}–{task.start_week + task.duration_weeks - 1}
                  </span>
                </div>
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold font-dm-sans shrink-0 ml-2"
                  style={{ background: `${cfg.color}20`, color: cfg.color }}
                >
                  {cfg.label[lang]}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Gantt chart (desktop) ─────────────────────────── */}
      {tasks.length > 0 && (
        <div
          className="rounded-[10px] hidden sm:block"
          // overflow handled by parent scroll container
          style={{ border: "1px solid var(--color-border-tertiary)", background: "var(--color-background-tertiary)" }}
        >
          {/* Column headers */}
          <div className="flex shrink-0" style={{ borderBottom: "0.5px solid var(--color-border-tertiary)", minWidth: 600 }}>
            {/* Left header */}
            <div className="shrink-0 flex items-center px-3 text-xs font-semibold font-dm-sans"
              style={{ width: LEFT_W, minWidth: LEFT_W, borderRight: "0.5px solid var(--color-border-tertiary)", color: CS.muted, height: 32 }}>
              {lang === "es" ? "Tarea" : "Task"}
            </div>

            {/* Week / Month column labels */}
            <div ref={timelineHeaderRef} className="relative flex flex-1"
              style={{ minWidth: timelineMinPx > 0 ? timelineMinPx : 0 }}>
              {viewMode === "weeks" ? (
                /* Individual week columns S1, S2, ... */
                Array.from({ length: totalWeeks }, (_, i) => (
                  <div key={i} className="flex flex-col items-center justify-center font-dm-sans shrink-0"
                    style={{
                      width: `${(1 / totalWeeks) * 100}%`, height: 32,
                      borderRight: "0.5px solid var(--color-border-tertiary)", color: CS.muted,
                      background: i % 2 === 0 ? "var(--color-background-tertiary)" : "var(--color-background-secondary)",
                    }}>
                    <span style={{ fontSize: 10, fontWeight: 600 }}>
                      {lang === "es" ? "S" : "W"}{i + 1}
                    </span>
                    <span style={{ fontSize: 8, opacity: 0.5 }}>{fmtWeekLabel(i + 1)}</span>
                  </div>
                ))
              ) : (
                /* Month columns (4 weeks each) */
                weekGroups.map(({ start, end }, gi) => {
                  const span = end - start + 1;
                  const pct = (span / totalWeeks) * 100;
                  return (
                    <div key={start} className="flex flex-col items-center justify-center font-dm-sans shrink-0"
                      style={{
                        width: `${pct}%`, height: 32,
                        borderRight: "0.5px solid var(--color-border-tertiary)", color: CS.muted,
                        background: gi % 2 === 0 ? "var(--color-background-tertiary)" : "var(--color-background-secondary)",
                      }}>
                      <span style={{ fontSize: 10, fontWeight: 600 }}>
                        {lang === "es" ? `Mes ${gi + 1}` : `Month ${gi + 1}`}
                      </span>
                      <span style={{ fontSize: 8, opacity: 0.5 }}>
                        {lang === "es" ? "S" : "W"}{start}–{end}
                      </span>
                    </div>
                  );
                })
              )}

              {/* Today indicator */}
              {todayPct !== null && (
                <div className="absolute top-0 bottom-0 flex flex-col items-center pointer-events-none"
                  style={{ left: `${todayPct}%`, transform: "translateX(-50%)", zIndex: 5 }}>
                  <div className="text-white rounded px-1"
                    style={{ fontSize: 8, fontWeight: 700, fontFamily: "var(--font-dm-sans)", background: CS.accent, marginTop: 2, lineHeight: 1.4, whiteSpace: "nowrap" }}>
                    {lang === "es" ? "Hoy" : "Today"}
                  </div>
                  <div style={{ flex: 1, width: 2, background: CS.accent, opacity: 0.8 }} />
                </div>
              )}
            </div>

            {/* Actions column */}
            <div style={{ width: ACTION_W, flexShrink: 0 }} />
          </div>

          {/* Chapter rows + their children */}
          {chapterTasks.map((chapter) => {
            const children = childrenByChapter.get(chapter.id) ?? [];
            const isExpanded = expandedChapters.includes(chapter.id);
            return (
              <div key={chapter.id}>
                <SortableGanttRow
                  task={chapter}
                  totalWeeks={totalWeeks}
                  todayPct={todayPct}
                  language={lang}
                  isResizing={resizingId === chapter.id}
                  isMoving={movingId === chapter.id}
                  projectStart={projectStart}
                  timelineMinPx={timelineMinPx}
                  isParent
                  isChild={false}
                  isCollapsed={!isExpanded}
                  childCount={children.length}
                  onToggleCollapse={() => toggleCollapse(chapter.id)}
                  onDelete={handleDelete}
                  onDuplicate={handleDuplicateTask}
                  onProgressCycle={handleProgressCycle}
                  onResizeStart={handleResizeStart}
                  onResizeLeftStart={handleResizeLeftStart}
                  onMoveStart={handleMoveStart}
                  onEdit={setEditingTask}
                />
                {isExpanded && children.map((child) => (
                  <SortableGanttRow
                    key={child.id}
                    task={child}
                    totalWeeks={totalWeeks}
                    todayPct={todayPct}
                    language={lang}
                    isResizing={resizingId === child.id}
                    isMoving={movingId === child.id}
                    projectStart={projectStart}
                    timelineMinPx={timelineMinPx}
                    isParent={false}
                    isChild
                    isCollapsed={false}
                    childCount={0}
                    onDelete={handleDelete}
                    onDuplicate={handleDuplicateTask}
                    onProgressCycle={handleProgressCycle}
                    onResizeStart={handleResizeStart}
                    onResizeLeftStart={handleResizeLeftStart}
                    onMoveStart={handleMoveStart}
                    onEdit={setEditingTask}
                  />
                ))}
              </div>
            );
          })}
          {/* Orphan tasks (no chapter, no parent) */}
          {orphanTasks.map((task) => (
            <SortableGanttRow
              key={task.id}
              task={task}
              totalWeeks={totalWeeks}
              todayPct={todayPct}
              language={lang}
              isResizing={resizingId === task.id}
              isMoving={movingId === task.id}
              projectStart={projectStart}
              timelineMinPx={timelineMinPx}
              isParent={false}
              isChild={false}
              isCollapsed={false}
              childCount={0}
              onDelete={handleDelete}
              onDuplicate={handleDuplicateTask}
              onProgressCycle={handleProgressCycle}
              onResizeStart={handleResizeStart}
              onResizeLeftStart={handleResizeLeftStart}
              onMoveStart={handleMoveStart}
              onEdit={setEditingTask}
            />
          ))}
        </div>
      )}

      {/* ── Legend + hint ──────────────────────────────────── */}
      {tasks.length > 0 && (
        <div className="hidden md:flex items-center gap-4 flex-wrap">
          {Object.entries(STATUS_CFG).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span
                className="rounded-full"
                style={{
                  width: 8, height: 8,
                  background: cfg.color,
                  display: "inline-block",
                }}
              />
              <span
                className="text-xs font-dm-sans"
                style={{ color: CS.muted }}
              >
                {cfg.label[lang]}
              </span>
            </div>
          ))}
          {todayPct !== null && (
            <div className="flex items-center gap-1.5">
              <div style={{ width: 14, height: 3, background: CS.accent, borderRadius: 2 }} />
              <span className="text-xs font-dm-sans" style={{ color: CS.muted }}>
                {lang === "es" ? "Hoy" : "Today"}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5 ml-2">
            <div style={{ width: 14, height: 7, background: "#f97316", borderRadius: 2 }} />
            <span className="text-xs font-dm-sans" style={{ color: CS.muted }}>
              {lang === "es" ? "Capítulo" : "Chapter"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div style={{ width: 14, height: 5, background: "#3b82f6", borderRadius: 2 }} />
            <span className="text-xs font-dm-sans" style={{ color: CS.muted }}>
              {lang === "es" ? "Tarea" : "Task"}
            </span>
          </div>
          <span
            className="text-xs font-dm-sans ml-auto hidden sm:block"
            style={{ color: "rgba(139,150,165,0.55)" }}
          >
            {lang === "es"
              ? "← → Barra/borde para mover · Clic en % para cambiar"
              : "← → Bar/edge to move · Click % to cycle"}
          </span>
        </div>
      )}

      {/* ── Edit task modal ─────────────────────────────────── */}
      {editingTask && (
        <EditTaskModal
          task={editingTask}
          language={lang}
          onSaved={(updated) => {
            setTasks((p) => p.map((t) => t.id === updated.id ? updated : t));
            setEditingTask(null);
          }}
          onClose={() => setEditingTask(null)}
        />
      )}

      {/* ── Delete task confirmation ─────────────────────────── */}
      {deleteConfirm && (() => {
        const target = tasks.find((t) => t.id === deleteConfirm);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
            <div className="flex flex-col gap-4 p-6 rounded-2xl" style={{ background: CS.surface, border: `1px solid ${CS.border}`, maxWidth: 380, width: "100%" }}>
              <div className="flex items-center gap-2">
                <Trash2 className="h-5 w-5" style={{ color: "#ef4444" }} />
                <span className="font-syne font-bold text-base" style={{ color: CS.text }}>{lang === "es" ? "Eliminar tarea" : "Delete task"}</span>
              </div>
              <p className="text-sm font-dm-sans" style={{ color: CS.muted }}>
                {lang === "es"
                  ? `¿Eliminar "${target?.name ?? "esta tarea"}"? Esta acción no se puede deshacer.`
                  : `Delete "${target?.name ?? "this task"}"? This cannot be undone.`}
              </p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-[10px] text-sm font-medium font-dm-sans"
                  style={{ border: `1px solid ${CS.border}`, background: "transparent", color: CS.muted, cursor: "pointer" }}>
                  {lang === "es" ? "Cancelar" : "Cancel"}
                </button>
                <button onClick={() => confirmDelete(deleteConfirm!)} className="px-4 py-2 rounded-[10px] text-sm font-semibold font-dm-sans"
                  style={{ background: "#ef4444", color: "#fff", border: "none", cursor: "pointer" }}>
                  {lang === "es" ? "Eliminar" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
    </>
  );
}
