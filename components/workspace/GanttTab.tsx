"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus, Trash2, Loader2, X,
  GripVertical, Download, ZoomIn, ZoomOut, Copy, ChevronRight, ChevronDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/context/WorkspaceContext";
import { useToast } from "@/lib/context/ToastContext";
import { t } from "@/lib/utils/i18n";
import type { GanttTask, GanttTaskInsert, BudgetRow } from "@/lib/types/database.types";
import type { Locale } from "@/lib/utils/i18n";
// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_WEEKS = 12;

const BAR_COLORS = [
  "#f97316", "#14b8a6", "#3b82f6", "#8b5cf6",
  "#fbbf24", "#22c55e",
] as const;

const STATUS_CFG = {
  pending:      { label: { es: "Pendiente",  en: "Pending"     }, color: "#6b7280", next: "in-progress" as const },
  "in-progress":{ label: { es: "En curso",   en: "In progress" }, color: "#f97316", next: "complete"    as const },
  complete:     { label: { es: "Completo",   en: "Complete"    }, color: "#14b8a6", next: "pending"     as const },
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
const LEFT_W = 240;
const ACTION_W = 64;

// Zoom: minimum pixels per week column (0 = auto-fit)
const ZOOM_STEPS = [0, 22, 32, 48, 68, 96] as const;

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
    language === "es" ? "Responsable" : "Assignee",
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
      task.assignee ?? "",
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

// ─── AddTaskModal ─────────────────────────────────────────────────────────────

interface AddTaskModalProps {
  projectId: string;
  language: Locale;
  taskCount: number;
  colorIndex: number;
  onSaved: (task: GanttTask) => void;
  onClose: () => void;
}

function AddTaskModal({
  projectId, language, taskCount, colorIndex, onSaved, onClose,
}: AddTaskModalProps) {
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const [name, setName]           = useState("");
  const [assignee, setAssignee]   = useState("");
  const [startWeek, setStartWeek] = useState(1);
  const [duration, setDuration]   = useState(2);
  const [status, setStatus]       = useState<StatusKey>("pending");
  const [progress, setProgress]   = useState(0);
  const defaultColor = BAR_COLORS[colorIndex % BAR_COLORS.length];
  const [color, setColor]         = useState(defaultColor);

  function resetFields() {
    setName(""); setAssignee(""); setStartWeek(1); setDuration(2);
    setStatus("pending"); setProgress(0); setColor(defaultColor);
    setTimeout(() => nameRef.current?.focus(), 50);
  }

  async function handleSave(andAnother = false) {
    if (!name.trim()) return;
    setSaving(true);
    const resolvedProgress = status === "complete" ? 100 : status === "pending" ? Math.min(progress, 99) : progress;
    const payload: GanttTaskInsert = {
      project_id:     projectId,
      name:           name.trim(),
      assignee:       assignee.trim() || null,
      start_week:     startWeek,
      duration_weeks: duration,
      color,
      status,
      progress_pct:   resolvedProgress,
      sort_order:     taskCount + savedCount,
    };
    const { data, error } = await supabase
      .from("gantt_tasks")
      .insert(payload)
      .select()
      .single();
    setSaving(false);
    if (!error && data) {
      onSaved(data as GanttTask);
      if (andAnother) { setSavedCount((c) => c + 1); resetFields(); }
      else onClose();
    }
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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-syne font-bold text-base" style={{ color: CS.text }}>
              {language === "es" ? "Nueva Tarea" : "New Task"}
            </span>
            {savedCount > 0 && (
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: CS.accent + "22", color: CS.accent }}
              >
                {savedCount} {language === "es" ? "guardadas" : "saved"}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label={language === "es" ? "Cerrar" : "Close"}
            style={{ background: "none", border: "none", cursor: "pointer", color: CS.muted }}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Name */}
        <div>
          <label style={LBL}>{t("taskName", language)} *</label>
          <input
            ref={nameRef}
            style={FIELD}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={language === "es" ? "Cimentación..." : "Foundation..."}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.ctrlKey) handleSave(true);
              else if (e.key === "Enter") handleSave(false);
            }}
          />
        </div>

        {/* Assignee */}
        <div>
          <label style={LBL}>{language === "es" ? "Responsable" : "Assignee"}</label>
          <input
            style={FIELD}
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            placeholder={language === "es" ? "Nombre..." : "Name..."}
          />
        </div>

        {/* Start week + Duration */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={LBL}>
              {language === "es" ? "Semana inicio" : "Start week"}
            </label>
            <input
              style={FIELD}
              type="number"
              min={1}
              value={startWeek}
              onChange={(e) =>
                setStartWeek(Math.max(1, parseInt(e.target.value) || 1))
              }
            />
          </div>
          <div>
            <label style={LBL}>
              {language === "es" ? "Duración (sem.)" : "Duration (wks)"}
            </label>
            <input
              style={FIELD}
              type="number"
              min={1}
              value={duration}
              onChange={(e) =>
                setDuration(Math.max(1, parseInt(e.target.value) || 1))
              }
            />
          </div>
        </div>

        {/* Status + Progress */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={LBL}>{language === "es" ? "Estatus" : "Status"}</label>
            <select
              style={FIELD}
              value={status}
              onChange={(e) => {
                const s = e.target.value as StatusKey;
                setStatus(s);
                if (s === "complete") setProgress(100);
                else if (s === "pending") setProgress(0);
              }}
            >
              <option value="pending">{language === "es" ? "Pendiente" : "Pending"}</option>
              <option value="in-progress">{language === "es" ? "En curso" : "In progress"}</option>
              <option value="complete">{language === "es" ? "Completo" : "Complete"}</option>
            </select>
          </div>
          <div>
            <label style={LBL}>
              {language === "es" ? "Avance" : "Progress"}
              <span style={{ marginLeft: 6, color: CS.accent, fontWeight: 700 }}>{progress}%</span>
            </label>
            <input
              style={FIELD}
              type="range"
              min={0}
              max={100}
              step={5}
              value={progress}
              onChange={(e) => {
                const p = parseInt(e.target.value);
                setProgress(p);
                if (p === 100) setStatus("complete");
                else if (p === 0) setStatus("pending");
                else setStatus("in-progress");
              }}
            />
          </div>
        </div>

        {/* Color picker */}
        <div>
          <label style={LBL}>
            {language === "es" ? "Color de barra" : "Bar color"}
          </label>
          <div className="flex gap-2 flex-wrap">
            {BAR_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="rounded-full transition-transform"
                style={{
                  width: 22, height: 22,
                  background: c,
                  border: color === c ? "2px solid #fff" : "2px solid transparent",
                  cursor: "pointer",
                  transform: color === c ? "scale(1.25)" : "scale(1)",
                }}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-1 flex-wrap">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-[10px] text-sm font-medium font-dm-sans"
            style={{
              border: `1px solid ${CS.border}`,
              background: "transparent",
              color: CS.muted,
              cursor: "pointer",
            }}
          >
            {savedCount > 0 ? (language === "es" ? "Listo" : "Done") : t("cancel", language)}
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving || !name.trim()}
            className="px-4 py-2 rounded-[10px] text-sm font-medium font-dm-sans"
            style={{
              border: `1px solid ${CS.accent}`,
              background: "transparent",
              color: CS.accent,
              cursor: saving || !name.trim() ? "not-allowed" : "pointer",
              opacity: saving || !name.trim() ? 0.5 : 1,
            }}
            title="Ctrl+Enter"
          >
            + {language === "es" ? "Guardar y agregar otra" : "Save & add another"}
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={saving || !name.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-semibold font-dm-sans"
            style={{
              background: CS.accent,
              color: "#fff",
              border: "none",
              cursor: saving || !name.trim() ? "not-allowed" : "pointer",
              opacity: saving || !name.trim() ? 0.6 : 1,
            }}
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t("save", language)}
          </button>
        </div>
      </div>
    </div>
  );
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
  onStatusCycle: (id: string) => void;
  onProgressCycle: (id: string) => void;
  onResizeStart: (e: React.MouseEvent, task: GanttTask) => void;
  onMoveStart: (e: React.MouseEvent, task: GanttTask) => void;
  onEdit: (task: GanttTask) => void;
}

function SortableGanttRow({
  task, totalWeeks, todayPct, language, isResizing, isMoving, projectStart, timelineMinPx,
  isParent, isChild, isCollapsed, childCount, onToggleCollapse,
  onDelete, onDuplicate, onStatusCycle, onProgressCycle, onResizeStart, onMoveStart, onEdit,
}: SortableGanttRowProps) {
  const {
    attributes, listeners,
    setNodeRef, transform, transition,
    isDragging,
  } = useSortable({ id: task.id });

  const dndStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    zIndex: isDragging ? 9 : undefined,
    position: "relative",
  };

  const statusCfg = STATUS_CFG[task.status as StatusKey] ?? STATUS_CFG.pending;
  const color = task.color ?? BAR_COLORS[0];

  // Compute actual start/end dates for tooltip
  const barStartDate = new Date(projectStart);
  barStartDate.setDate(barStartDate.getDate() + (task.start_week - 1) * 7);
  const barEndDate = new Date(projectStart);
  barEndDate.setDate(barEndDate.getDate() + (task.start_week - 1 + task.duration_weeks) * 7 - 1);
  const dateLocale = language === "es" ? "es-MX" : "en-US";
  const fmtDate = (d: Date) => d.toLocaleDateString(dateLocale, { day: "numeric", month: "short" });
  const barDateRange = `${fmtDate(barStartDate)} – ${fmtDate(barEndDate)}`;

  // Bar geometry (clamped so it can't overflow)
  const startPct = Math.min(
    ((task.start_week - 1) / totalWeeks) * 100,
    95
  );
  const maxWidth = 100 - startPct;
  const widthPct = Math.min(
    (task.duration_weeks / totalWeeks) * 100,
    maxWidth
  );

  return (
    <div
      ref={setNodeRef}
      style={{
        ...dndStyle,
        borderBottom: isParent
          ? `1px solid rgba(249,115,22,0.15)`
          : `1px solid ${CS.border}`,
      }}
      className="group flex items-center"
      data-testid={`gantt-row-${task.id}`}
    >
      {/* ── Left panel ──────────────────── */}
      <div
        className="flex items-center gap-1.5 shrink-0"
        style={{
          width: LEFT_W,
          minWidth: LEFT_W,
          borderRight: `1px solid ${CS.border}`,
          padding: "6px 8px 6px 4px",
          paddingLeft: isChild ? 24 : 4,
          minHeight: isParent ? 40 : 44,
          background: isParent ? "rgba(249,115,22,0.04)" : undefined,
        }}
      >
        {/* Collapse toggle for parents / drag handle */}
        {isParent ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex items-center justify-center rounded shrink-0"
            style={{
              width: 20, height: 20,
              background: "none", border: "none",
              cursor: "pointer", color: CS.accent,
            }}
            aria-label={isCollapsed ? "Expand" : "Collapse"}
          >
            {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <button
            {...attributes}
            {...listeners}
            tabIndex={-1}
            className="flex items-center justify-center rounded shrink-0 touch-none"
            style={{
              width: 20, height: 20,
              background: "none", border: "none",
              cursor: isDragging ? "grabbing" : "grab",
              color: CS.muted,
            }}
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Status pill — click cycles through states */}
        <button
          type="button"
          onClick={() => onStatusCycle(task.id)}
          className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium font-dm-sans transition-opacity hover:opacity-75"
          style={{
            background: `${statusCfg.color}22`,
            color: statusCfg.color,
            border: "none",
            cursor: "pointer",
            whiteSpace: "nowrap",
            lineHeight: 1.5,
          }}
          title={
            language === "es"
              ? "Clic para cambiar estatus"
              : "Click to cycle status"
          }
        >
          <span
            className="inline-block rounded-full mr-1"
            style={{ width: 5, height: 5, background: statusCfg.color, verticalAlign: "middle" }}
          />
          {statusCfg.label[language]}
        </button>

        {/* Task name — click to edit */}
        <button
          type="button"
          onClick={() => onEdit(task)}
          className={`text-sm font-dm-sans flex-1 truncate text-left ${isParent ? "font-bold uppercase" : ""}`}
          style={{
            color: isParent ? CS.accent : CS.text,
            minWidth: 0, background: "none", border: "none",
            cursor: "pointer", padding: 0,
            fontSize: isParent ? "0.7rem" : undefined,
            letterSpacing: isParent ? "0.04em" : undefined,
          }}
          title={language === "es" ? "Clic para editar" : "Click to edit"}
        >
          {task.name}
          {isParent && childCount !== undefined && childCount > 0 && (
            <span style={{ fontWeight: 400, fontSize: "0.65rem", marginLeft: 6, opacity: 0.6 }}>
              ({childCount})
            </span>
          )}
        </button>

        {/* Assignee abbreviation */}
        {task.assignee && (
          <span
            className="text-xs font-dm-sans shrink-0 truncate"
            style={{ color: CS.muted, maxWidth: 48 }}
            title={task.assignee}
          >
            {task.assignee.split(" ")[0]}
          </span>
        )}

        {/* Progress badge — click cycles through 0/25/50/75/100 */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onProgressCycle(task.id); }}
          className="shrink-0 font-dm-sans rounded"
          style={{
            fontSize: "0.65rem",
            fontWeight: 600,
            padding: "1px 5px",
            background: `${(task.color ?? BAR_COLORS[0])}22`,
            color: task.color ?? BAR_COLORS[0],
            border: "none",
            cursor: "pointer",
            lineHeight: 1.6,
          }}
          title={language === "es" ? "Clic para cambiar avance" : "Click to cycle progress"}
        >
          {task.progress_pct ?? 0}%
        </button>
      </div>

      {/* ── Timeline panel ──────────────── */}
      <div
        className="relative flex-1"
        style={{ height: 44, minWidth: timelineMinPx > 0 ? timelineMinPx : 0, overflow: "hidden" }}
      >
        {/* Week grid lines */}
        {Array.from({ length: totalWeeks + 1 }).map((_, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{
              left: `${(i / totalWeeks) * 100}%`,
              width: 1,
              background:
                i % 4 === 0
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(255,255,255,0.022)",
            }}
          />
        ))}

        {/* Task bar */}
        <div
          className="absolute top-1/2 -translate-y-1/2 rounded flex items-center overflow-hidden select-none"
          title={barDateRange}
          onMouseDown={(e) => {
            // Only left-button, not on the resize handle (handled separately)
            if (e.button !== 0) return;
            onMoveStart(e, task);
          }}
          style={{
            left: `${startPct}%`,
            width: `${widthPct}%`,
            height: isParent ? 20 : 26,
            minWidth: 4,
            background: color,
            opacity: task.status === "complete" ? 0.6 : isParent ? 0.75 : 1,
            cursor: isMoving ? "grabbing" : "grab",
            borderRadius: isParent ? 3 : undefined,
            boxShadow: (isResizing || isMoving)
              ? `0 0 0 2px ${color}, 0 0 0 4px rgba(255,255,255,0.12)`
              : "none",
            transition: (isResizing || isMoving) ? "none" : "width 0.1s ease, left 0.1s ease",
          }}
        >
          {/* Progress fill overlay */}
          {(task.progress_pct ?? 0) > 0 && (
            <div
              className="absolute inset-y-0 left-0 pointer-events-none"
              style={{
                width: `${task.progress_pct ?? 0}%`,
                background: "rgba(255,255,255,0.22)",
                transition: (isResizing || isMoving) ? "none" : "width 0.3s ease",
              }}
            />
          )}

          {/* Date label inside bar */}
          {widthPct > 7 && (
            <span
              className="pl-2 text-white truncate"
              style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: "0.01em", pointerEvents: "none", position: "relative" }}
              title={barDateRange}
            >
              {widthPct > 16 ? barDateRange : `S${task.start_week}`}
              {(task.progress_pct ?? 0) > 0 && (task.progress_pct ?? 0) < 100 && widthPct > 20 && (
                <span style={{ marginLeft: 4, opacity: 0.85 }}>{task.progress_pct}%</span>
              )}
            </span>
          )}

          {/* Resize handle — right edge of bar */}
          <div
            onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, task); }}
            className="absolute right-0 top-0 bottom-0 flex items-center justify-center"
            style={{
              width: 9,
              cursor: "ew-resize",
              background: "rgba(0,0,0,0.18)",
              borderRadius: "0 4px 4px 0",
              flexShrink: 0,
            }}
            title={
              language === "es"
                ? "Arrastrar para redimensionar"
                : "Drag to resize"
            }
          >
            <div
              style={{
                width: 2, height: 12,
                background: "rgba(255,255,255,0.45)",
                borderRadius: 2,
              }}
            />
          </div>
        </div>

        {/* Today line in row */}
        {todayPct !== null && (
          <div
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{
              left: `${todayPct}%`,
              width: 2,
              background: CS.accent,
              opacity: 0.45,
            }}
          />
        )}
      </div>

      {/* ── Row actions ──────────────────── */}
      <div
        className="shrink-0 flex items-center justify-center gap-0.5"
        style={{ width: ACTION_W, height: 44 }}
      >
        {/* Duplicate */}
        <button
          type="button"
          onClick={() => onDuplicate(task)}
          className="flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity"
          style={{
            width: 24, height: 24,
            background: "none", border: "none",
            cursor: "pointer", color: CS.muted,
          }}
          aria-label={language === "es" ? "Duplicar tarea" : "Duplicate task"}
          title={language === "es" ? "Duplicar" : "Duplicate"}
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        {/* Delete */}
        <button
          type="button"
          onClick={() => onDelete(task.id)}
          className="flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity"
          style={{
            width: 24, height: 24,
            background: "none", border: "none",
            cursor: "pointer", color: "#ef4444",
          }}
          aria-label="Delete task"
        >
          <Trash2 className="h-3.5 w-3.5" />
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
  const [assignee, setAssignee]   = useState(task.assignee ?? "");
  const [startWeek, setStartWeek] = useState(task.start_week);
  const [duration, setDuration]   = useState(task.duration_weeks);
  const [status, setStatus]       = useState<StatusKey>(task.status as StatusKey);
  const [progress, setProgress]   = useState(task.progress_pct ?? (task.status === "complete" ? 100 : task.status === "in-progress" ? 50 : 0));
  const [color, setColor]         = useState(task.color);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    const resolvedProgress = status === "complete" ? 100 : status === "pending" ? Math.min(progress, 99) : progress;
    const update = {
      name: name.trim(),
      assignee: assignee.trim() || null,
      start_week: startWeek,
      duration_weeks: duration,
      status,
      progress_pct: resolvedProgress,
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

        <div>
          <label style={LBL}>{language === "es" ? "Responsable" : "Assignee"}</label>
          <input style={FIELD} value={assignee} onChange={(e) => setAssignee(e.target.value)}
            placeholder={language === "es" ? "Nombre..." : "Name..."} />
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

        {/* Status + Progress */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={LBL}>{language === "es" ? "Estatus" : "Status"}</label>
            <select style={FIELD} value={status} onChange={(e) => {
              const s = e.target.value as StatusKey;
              setStatus(s);
              if (s === "complete") setProgress(100);
              else if (s === "pending") setProgress(0);
            }}>
              <option value="pending">{language === "es" ? "Pendiente" : "Pending"}</option>
              <option value="in-progress">{language === "es" ? "En curso" : "In progress"}</option>
              <option value="complete">{language === "es" ? "Completo" : "Complete"}</option>
            </select>
          </div>
          <div>
            <label style={LBL}>
              {language === "es" ? "Avance" : "Progress"}
              <span style={{ marginLeft: 6, color: CS.accent, fontWeight: 700 }}>{progress}%</span>
            </label>
            <input style={FIELD} type="range" min={0} max={100} step={5} value={progress}
              onChange={(e) => {
                const p = parseInt(e.target.value);
                setProgress(p);
                if (p === 100) setStatus("complete");
                else if (p === 0) setStatus("pending");
                else setStatus("in-progress");
              }} />
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
  const { projectId, language } = useWorkspace();
  const { toast } = useToast();

  const [tasks, setTasks] = useState<GanttTask[]>(
    [...initialTasks].sort((a, b) => a.sort_order - b.sort_order)
  );
  const [showAdd, setShowAdd]           = useState(false);
  const [editingTask, setEditingTask]   = useState<GanttTask | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [resizingId, setResizingId]     = useState<string | null>(null);
  const [movingId, setMovingId]         = useState<string | null>(null);
  const [zoomStep, setZoomStep]         = useState(0);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  function toggleCollapse(id: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
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

  // Build ordered list: parents first (by sort_order), then their children
  const orderedTasks = (() => {
    const parents = tasks.filter((t) => !t.parent_task_id).sort((a, b) => a.sort_order - b.sort_order);
    const result: GanttTask[] = [];
    for (const p of parents) {
      result.push(p);
      const children = tasks.filter((t) => t.parent_task_id === p.id).sort((a, b) => a.sort_order - b.sort_order);
      result.push(...children);
    }
    // Include orphan tasks (no parent_task_id and no children pointing to them)
    const inResult = new Set(result.map((t) => t.id));
    for (const t of tasks) {
      if (!inResult.has(t.id)) result.push(t);
    }
    return result;
  })();

  // Filter out children of collapsed parents
  const visibleTasks = orderedTasks.filter((t) => {
    if (!t.parent_task_id) return true;
    return !collapsedIds.has(t.parent_task_id);
  });

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

  useEffect(() => { onCountChange?.(tasks.length); }, [tasks.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── One-time sync: create missing gantt tasks from existing budget data ──────
  useEffect(() => {
    let cancelled = false;
    async function syncFromBudget() {
      // Load all budget rows for this project
      const { data: budgetRows } = await supabase
        .from("budget_rows")
        .select("id, section, description, status")
        .eq("project_id", projectId);
      if (cancelled || !budgetRows || budgetRows.length === 0) return;

      // Load existing gantt tasks with budget_link
      const { data: existingTasks } = await supabase
        .from("gantt_tasks")
        .select("id, budget_link, parent_task_id, start_week, duration_weeks, sort_order, color")
        .eq("project_id", projectId);
      const existingLinks = new Set((existingTasks ?? []).map((t) => t.budget_link).filter(Boolean));

      // Find unique sections that need chapter tasks
      const sections = Array.from(new Set((budgetRows as BudgetRow[]).map((r) => r.section)));
      let created = false;

      for (const sec of sections) {
        const chapterLink = `chapter:${sec}`;
        if (existingLinks.has(chapterLink)) continue;

        // Find next start_week and sort_order
        const { data: lastTasks } = await supabase
          .from("gantt_tasks")
          .select("start_week, duration_weeks, sort_order")
          .eq("project_id", projectId)
          .is("parent_task_id", null)
          .order("sort_order", { ascending: false })
          .limit(1);
        const last = lastTasks?.[0];
        const startWeek = last ? (last.start_week + last.duration_weeks) : 1;
        const sortOrder = last ? (last.sort_order + 1) : 0;
        const colorIdx = sortOrder % BAR_COLORS.length;

        const { data: chapterTask } = await supabase.from("gantt_tasks").insert({
          project_id: projectId,
          name: sec,
          start_week: startWeek,
          duration_weeks: 2,
          color: BAR_COLORS[colorIdx],
          status: "pending" as const,
          progress_pct: 0,
          budget_link: chapterLink,
          sort_order: sortOrder,
        }).select().single();
        if (!chapterTask) continue;
        existingLinks.add(chapterLink);
        created = true;

        // Create child tasks for rows in this section
        const secRows = (budgetRows as BudgetRow[]).filter((r) => r.section === sec);
        for (let i = 0; i < secRows.length; i++) {
          const row = secRows[i];
          const rowLink = `row:${row.id}`;
          if (existingLinks.has(rowLink)) continue;
          const ganttStatus = row.status === "approved" ? "complete" : row.status === "review" ? "in-progress" : "pending";
          const progress = row.status === "approved" ? 100 : row.status === "review" ? 50 : 0;
          await supabase.from("gantt_tasks").insert({
            project_id: projectId,
            name: row.description,
            start_week: startWeek,
            duration_weeks: 1,
            color: BAR_COLORS[colorIdx],
            status: ganttStatus as "complete" | "in-progress" | "pending",
            progress_pct: progress,
            parent_task_id: (chapterTask as GanttTask).id,
            budget_link: rowLink,
            sort_order: i,
          });
          existingLinks.add(rowLink);
          created = true;
        }
      }

      // Also create child tasks for rows whose chapters already exist
      for (const row of budgetRows as BudgetRow[]) {
        const rowLink = `row:${row.id}`;
        if (existingLinks.has(rowLink)) continue;
        const chapterLink = `chapter:${row.section}`;
        const parentTask = (existingTasks ?? []).find((t) => t.budget_link === chapterLink);
        if (!parentTask) continue;
        const ganttStatus = row.status === "approved" ? "complete" : row.status === "review" ? "in-progress" : "pending";
        const progress = row.status === "approved" ? 100 : row.status === "review" ? 50 : 0;
        await supabase.from("gantt_tasks").insert({
          project_id: projectId,
          name: row.description,
          start_week: parentTask.start_week,
          duration_weeks: 1,
          color: parentTask.color,
          status: ganttStatus as "complete" | "in-progress" | "pending",
          progress_pct: progress,
          parent_task_id: parentTask.id,
          budget_link: rowLink,
          sort_order: 0,
        });
        created = true;
      }

      // Reload tasks if we created any
      if (created && !cancelled) {
        const { data: fresh } = await supabase
          .from("gantt_tasks")
          .select("*")
          .eq("project_id", projectId)
          .order("sort_order");
        if (fresh && !cancelled) {
          setTasks((fresh as GanttTask[]).sort((a, b) => a.sort_order - b.sort_order));
        }
      }
    }
    syncFromBudget();
    return () => { cancelled = true; };
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── DnD sensors ──────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = tasks.findIndex((t) => t.id === active.id);
    const newIdx = tasks.findIndex((t) => t.id === over.id);
    const reordered = arrayMove(tasks, oldIdx, newIdx);
    setTasks(reordered);
    // Persist in bulk
    await Promise.all(
      reordered.map((task, i) =>
        supabase
          .from("gantt_tasks")
          .update({ sort_order: i })
          .eq("id", task.id)
      )
    );
  }

  // ── Progress cycle (0 → 25 → 50 → 75 → 100 → 0) ─────────────────────────────
  async function handleProgressCycle(id: string) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const cur = task.progress_pct ?? 0;
    const idx = PROGRESS_STEPS.indexOf(cur as typeof PROGRESS_STEPS[number]);
    const next = PROGRESS_STEPS[(idx + 1) % PROGRESS_STEPS.length];
    // Infer status from new progress
    const nextStatus: GanttTask["status"] =
      next === 100 ? "complete" : next > 0 ? "in-progress" : "pending";
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, progress_pct: next, status: nextStatus } : t))
    );
    await supabase.from("gantt_tasks").update({ progress_pct: next, status: nextStatus }).eq("id", id);
  }

  // ── Status cycle ─────────────────────────────────────────────────────────────
  async function handleStatusCycle(id: string) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const next = STATUS_CFG[task.status as StatusKey]?.next ?? "pending";
    const nextProgress = next === "complete" ? 100 : next === "pending" ? 0 : task.progress_pct ?? 0;
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: next, progress_pct: nextProgress } : t))
    );
    await supabase.from("gantt_tasks").update({ status: next, progress_pct: nextProgress }).eq("id", id);
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
      assignee: source.assignee,
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

      return `<tr><td style="white-space:nowrap;padding:4px 8px;font-weight:500">${task.name}</td><td style="padding:4px 8px">${dateRange}</td><td style="white-space:nowrap;padding:4px 8px;color:#6b7280">${task.assignee ?? "—"}</td><td style="padding:4px 8px;color:#6b7280;font-size:10px">${statusLabel}</td><td style="padding:4px 8px;font-size:10px">${progressBar}</td>${weekCells}</tr>`;
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
        <th rowspan="2" style="width:90px;background:#f97316;vertical-align:bottom">${lang === "es" ? "Responsable" : "Assignee"}</th>
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
    <div className="flex flex-col gap-4">
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
              const complete   = tasks.filter((t) => t.status === "complete").length;
              const inProgress = tasks.filter((t) => t.status === "in-progress").length;
              const pending    = tasks.filter((t) => t.status === "pending").length;
              const avgPct = Math.round(tasks.reduce((s, t) => s + (t.progress_pct ?? 0), 0) / tasks.length);
              return (
                <>
                  <span style={{ color: CS.muted, fontSize: "0.65rem" }}>·</span>
                  {complete > 0 && (
                    <span className="text-xs font-dm-sans" style={{ color: STATUS_CFG.complete.color }}>
                      ✓ {complete}
                    </span>
                  )}
                  {inProgress > 0 && (
                    <span className="text-xs font-dm-sans" style={{ color: STATUS_CFG["in-progress"].color }}>
                      ⟳ {inProgress}
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

        <div className="flex items-center gap-2 flex-wrap">
          {/* CSV */}
          <button
            type="button"
            onClick={handleCSV}
            disabled={tasks.length === 0}
            aria-label={lang === "es" ? "Exportar CSV" : "Export CSV"}
            className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-sm font-medium font-dm-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cs-accent)]"
            style={{
              border: `1px solid ${CS.border}`,
              background: "transparent",
              color: CS.muted,
              cursor: tasks.length === 0 ? "not-allowed" : "pointer",
              opacity: tasks.length === 0 ? 0.45 : 1,
            }}
            onMouseEnter={(e) => {
              if (tasks.length > 0)
                (e.currentTarget as HTMLButtonElement).style.color = CS.text;
            }}
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.color = CS.muted)
            }
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {lang === "es" ? "Exportar CSV" : "Export CSV"}
          </button>

          {/* PDF print */}
          <button
            type="button"
            onClick={handlePrintGantt}
            disabled={tasks.length === 0}
            aria-label={lang === "es" ? "Exportar PDF" : "Export PDF"}
            className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-sm font-medium font-dm-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cs-accent)]"
            style={{
              border: `1px solid ${CS.border}`,
              background: "transparent",
              color: CS.muted,
              cursor: tasks.length === 0 ? "not-allowed" : "pointer",
              opacity: tasks.length === 0 ? 0.45 : 1,
            }}
            onMouseEnter={(e) => { if (tasks.length > 0) (e.currentTarget as HTMLButtonElement).style.color = CS.text; }}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = CS.muted)}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
            </svg>
            {lang === "es" ? "Exportar PDF" : "Export PDF"}
          </button>

          {/* Zoom controls */}
          {tasks.length > 0 && (
            <div
              className="flex items-center rounded-[10px] overflow-hidden"
              style={{ border: `1px solid ${CS.border}` }}
            >
              <button
                type="button"
                onClick={() => setZoomStep((z) => Math.max(0, z - 1))}
                disabled={zoomStep === 0}
                aria-label={lang === "es" ? "Reducir zoom" : "Zoom out"}
                className="flex items-center justify-center"
                style={{
                  width: 32, height: 32,
                  background: "transparent",
                  border: "none",
                  cursor: zoomStep === 0 ? "not-allowed" : "pointer",
                  color: zoomStep === 0 ? CS.muted : CS.text,
                  opacity: zoomStep === 0 ? 0.4 : 1,
                  borderRight: `1px solid ${CS.border}`,
                }}
                title={lang === "es" ? "Reducir zoom" : "Zoom out"}
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span
                className="text-xs font-dm-sans"
                style={{ color: CS.muted, padding: "0 8px", minWidth: 44, textAlign: "center" }}
              >
                {zoomStep === 0
                  ? (lang === "es" ? "Auto" : "Auto")
                  : `${colPx}px`}
              </span>
              <button
                type="button"
                onClick={() => setZoomStep((z) => Math.min(ZOOM_STEPS.length - 1, z + 1))}
                disabled={zoomStep === ZOOM_STEPS.length - 1}
                aria-label={lang === "es" ? "Ampliar zoom" : "Zoom in"}
                className="flex items-center justify-center"
                style={{
                  width: 32, height: 32,
                  background: "transparent",
                  border: "none",
                  cursor: zoomStep === ZOOM_STEPS.length - 1 ? "not-allowed" : "pointer",
                  color: zoomStep === ZOOM_STEPS.length - 1 ? CS.muted : CS.text,
                  opacity: zoomStep === ZOOM_STEPS.length - 1 ? 0.4 : 1,
                  borderLeft: `1px solid ${CS.border}`,
                }}
                title={lang === "es" ? "Ampliar zoom" : "Zoom in"}
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Add task */}
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            aria-label={lang === "es" ? "Agregar tarea" : "Add task"}
            className="flex items-center gap-2 px-3 py-2 rounded-[10px] text-sm font-semibold font-dm-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cs-accent)]"
            style={{
              background: CS.accent,
              color: "#fff",
              border: "none",
              cursor: "pointer",
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {lang === "es" ? "+ Agregar Tarea" : "+ Add Task"}
          </button>
        </div>
      </div>

      {/* ── Empty state ────────────────────────────────────── */}
      {tasks.length === 0 && (
        <div
          className="flex flex-col items-center justify-center py-16 rounded-[10px] text-center gap-3"
          style={{ border: `1.5px dashed ${CS.border}` }}
        >
          <p className="font-syne font-bold text-base" style={{ color: CS.text }}>
            {lang === "es"
              ? "Sin tareas en el cronograma"
              : "No tasks in the schedule"}
          </p>
          <p
            className="text-sm font-dm-sans max-w-xs"
            style={{ color: CS.muted }}
          >
            {lang === "es"
              ? "Agrega tareas para visualizar el cronograma de obra."
              : "Add tasks to visualize the project schedule."}
          </p>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-semibold font-dm-sans mt-1"
            style={{
              background: CS.accent,
              color: "#fff",
              border: "none",
              cursor: "pointer",
            }}
          >
            <Plus className="h-4 w-4" />
            {lang === "es" ? "Agregar primera tarea" : "Add first task"}
          </button>
        </div>
      )}

      {/* ── Gantt chart ────────────────────────────────────── */}
      {tasks.length > 0 && (
        <div
          className="rounded-[10px] overflow-hidden overflow-x-auto"
          style={{ border: `1px solid ${CS.border}`, background: CS.surface }}
        >
          {/* Column headers */}
          <div
            className="flex shrink-0"
            style={{
              borderBottom: `1px solid ${CS.border}`,
              background: "rgba(255,255,255,0.03)",
              minWidth: 600,
            }}
          >
            {/* Left header */}
            <div
              className="shrink-0 flex items-center px-3 text-xs font-semibold font-dm-sans"
              style={{
                width: LEFT_W,
                minWidth: LEFT_W,
                borderRight: `1px solid ${CS.border}`,
                color: CS.muted,
                height: 36,
              }}
            >
              {lang === "es" ? "Tarea / Estatus" : "Task / Status"}
            </div>

            {/* Week group labels */}
            <div
              ref={timelineHeaderRef}
              className="relative flex flex-1"
              style={{ minWidth: timelineMinPx > 0 ? timelineMinPx : 0 }}
            >
              {weekGroups.map(({ start, end }) => {
                const span = end - start + 1;
                const pct = (span / totalWeeks) * 100;
                return (
                  <div
                    key={start}
                    className="flex items-center justify-center text-xs font-dm-sans shrink-0"
                    style={{
                      width: `${pct}%`,
                      height: 36,
                      borderRight: `1px solid ${CS.border}`,
                      color: CS.muted,
                    }}
                  >
                    <span style={{ display: "block", fontSize: 9.5, fontWeight: 600 }}>
                      {fmtWeekLabel(start)}
                    </span>
                    <span style={{ display: "block", fontSize: 8.5, opacity: 0.6, marginTop: 1 }}>
                      {lang === "es" ? `S${start}` : `W${start}`}{end > start ? `–${end}` : ""}
                    </span>
                  </div>
                );
              })}
              {/* Today indicator */}
              {todayPct !== null && (
                <div
                  className="absolute top-0 bottom-0 flex flex-col items-center pointer-events-none"
                  style={{ left: `${todayPct}%`, transform: "translateX(-50%)", zIndex: 5 }}
                >
                  <div
                    className="text-white rounded px-1"
                    style={{
                      fontSize: 9, fontWeight: 700, fontFamily: "var(--font-dm-sans)",
                      background: CS.accent, marginTop: 3, lineHeight: 1.5, whiteSpace: "nowrap",
                    }}
                  >
                    {lang === "es" ? "Hoy" : "Today"}
                  </div>
                  <div style={{ flex: 1, width: 2, background: CS.accent, opacity: 0.8 }} />
                </div>
              )}
            </div>

            {/* Actions column */}
            <div style={{ width: ACTION_W, flexShrink: 0 }} />
          </div>

          {/* Rows — DnD sortable, with parent/child hierarchy */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={visibleTasks.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              {visibleTasks.map((task) => {
                const isParent = !task.parent_task_id && tasks.some((t) => t.parent_task_id === task.id);
                const isChild = !!task.parent_task_id;
                const childCount = isParent ? tasks.filter((t) => t.parent_task_id === task.id).length : 0;
                return (
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
                    isParent={isParent}
                    isChild={isChild}
                    isCollapsed={collapsedIds.has(task.id)}
                    childCount={childCount}
                    onToggleCollapse={() => toggleCollapse(task.id)}
                    onDelete={handleDelete}
                    onDuplicate={handleDuplicateTask}
                    onStatusCycle={handleStatusCycle}
                    onProgressCycle={handleProgressCycle}
                    onResizeStart={handleResizeStart}
                    onMoveStart={handleMoveStart}
                    onEdit={setEditingTask}
                  />
                );
              })}
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* ── Legend + hint ──────────────────────────────────── */}
      {tasks.length > 0 && (
        <div className="flex items-center gap-4 flex-wrap">
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
          <span
            className="text-xs font-dm-sans ml-auto hidden sm:block"
            style={{ color: "rgba(139,150,165,0.55)" }}
          >
            {lang === "es"
              ? "↕ Arrastrar · ← → Barra/borde · Clic en estatus"
              : "↕ Drag to reorder · ← → Bar/edge to move · Click status to cycle"}
          </span>
        </div>
      )}

      {/* ── Add task modal ─────────────────────────────────── */}
      {showAdd && (
        <AddTaskModal
          projectId={projectId}
          language={lang}
          taskCount={tasks.length}
          colorIndex={tasks.length}
          onSaved={(task) => setTasks((p) => [...p, task])}
          onClose={() => setShowAdd(false)}
        />
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
  );
}
