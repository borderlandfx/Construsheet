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
  GripVertical, Download,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/context/WorkspaceContext";
import { t } from "@/lib/utils/i18n";
import type { GanttTask, GanttTaskInsert } from "@/lib/types/database.types";
import type { Locale } from "@/lib/utils/i18n";
import PDFExportButton from "@/components/workspace/PDFExportButton";

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
const ACTION_W = 36;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function exportCSV(tasks: GanttTask[], totalWeeks: number, language: Locale) {
  const headers = [
    language === "es" ? "Nombre" : "Name",
    language === "es" ? "Responsable" : "Assignee",
    language === "es" ? "Estatus" : "Status",
    ...Array.from({ length: totalWeeks }, (_, i) => `S${i + 1}`),
  ];

  const rows = tasks.map((task) => {
    const statusLabel =
      STATUS_CFG[task.status as StatusKey]?.label[language] ?? task.status;
    const weekCols = Array.from({ length: totalWeeks }, (_, i) => {
      const w = i + 1;
      return w >= task.start_week && w < task.start_week + task.duration_weeks
        ? "X"
        : "";
    });
    return [task.name, task.assignee ?? "", statusLabel, ...weekCols];
  });

  const csv = [headers, ...rows]
    .map((row) =>
      row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")
    )
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
  const [color, setColor]         = useState(
    BAR_COLORS[colorIndex % BAR_COLORS.length]
  );

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    const payload: GanttTaskInsert = {
      project_id:     projectId,
      name:           name.trim(),
      assignee:       assignee.trim() || null,
      start_week:     startWeek,
      duration_weeks: duration,
      color,
      status,
      sort_order:     taskCount,
    };
    const { data, error } = await supabase
      .from("gantt_tasks")
      .insert(payload)
      .select()
      .single();
    setSaving(false);
    if (!error && data) onSaved(data as GanttTask);
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
          <span className="font-syne font-bold text-base" style={{ color: CS.text }}>
            {language === "es" ? "Nueva Tarea" : "New Task"}
          </span>
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
            style={FIELD}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={language === "es" ? "Cimentación..." : "Foundation..."}
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
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

        {/* Status */}
        <div>
          <label style={LBL}>{language === "es" ? "Estatus" : "Status"}</label>
          <select
            style={FIELD}
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusKey)}
          >
            <option value="pending">
              {language === "es" ? "Pendiente" : "Pending"}
            </option>
            <option value="in-progress">
              {language === "es" ? "En curso" : "In progress"}
            </option>
            <option value="complete">
              {language === "es" ? "Completo" : "Complete"}
            </option>
          </select>
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
        <div className="flex gap-2 justify-end pt-1">
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
            {t("cancel", language)}
          </button>
          <button
            onClick={handleSave}
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

interface SortableGanttRowProps {
  task: GanttTask;
  totalWeeks: number;
  language: Locale;
  isResizing: boolean;
  onDelete: (id: string) => void;
  onStatusCycle: (id: string) => void;
  onResizeStart: (e: React.MouseEvent, task: GanttTask) => void;
}

function SortableGanttRow({
  task, totalWeeks, language, isResizing,
  onDelete, onStatusCycle, onResizeStart,
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
      style={dndStyle}
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
          minHeight: 44,
        }}
      >
        {/* Drag handle — only this element starts the drag */}
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

        {/* Task name */}
        <span
          className="text-sm font-dm-sans flex-1 truncate"
          style={{ color: CS.text, minWidth: 0 }}
        >
          {task.name}
        </span>

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
      </div>

      {/* ── Timeline panel ──────────────── */}
      <div
        className="relative flex-1"
        style={{ height: 44, minWidth: 0, overflow: "hidden" }}
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
          style={{
            left: `${startPct}%`,
            width: `${widthPct}%`,
            height: 26,
            minWidth: 4,
            background: color,
            opacity: task.status === "complete" ? 0.6 : 1,
            boxShadow: isResizing
              ? `0 0 0 2px ${color}, 0 0 0 4px rgba(255,255,255,0.12)`
              : "none",
            transition: isResizing ? "none" : "width 0.1s ease, left 0.1s ease",
          }}
        >
          {/* Week label inside bar */}
          {widthPct > 7 && (
            <span
              className="pl-2 text-white truncate"
              style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.01em", pointerEvents: "none" }}
            >
              S{task.start_week}–S{task.start_week + task.duration_weeks - 1}
            </span>
          )}

          {/* Resize handle — right edge of bar */}
          <div
            onMouseDown={(e) => onResizeStart(e, task)}
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
      </div>

      {/* ── Delete button ────────────────── */}
      <div
        className="shrink-0 flex items-center justify-center"
        style={{ width: ACTION_W, height: 44 }}
      >
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

// ─── GanttTab ─────────────────────────────────────────────────────────────────

interface GanttTabProps {
  initialTasks: GanttTask[];
}

export default function GanttTab({ initialTasks }: GanttTabProps) {
  const supabase = createClient();
  const { projectId, language } = useWorkspace();

  const [tasks, setTasks] = useState<GanttTask[]>(
    [...initialTasks].sort((a, b) => a.sort_order - b.sort_order)
  );
  const [showAdd, setShowAdd]     = useState(false);
  const [resizingId, setResizingId] = useState<string | null>(null);

  // Resize state stored in refs to avoid stale closures in document listeners
  const resizeStateRef = useRef<{
    taskId: string;
    startX: number;
    startDuration: number;
    pxPerWeek: number;
  } | null>(null);
  const currentDurationRef = useRef(0);

  // Ref to the timeline header for measuring px-per-week
  const timelineHeaderRef = useRef<HTMLDivElement>(null);

  const totalWeeks = Math.max(
    MIN_WEEKS,
    ...tasks.map((tk) => tk.start_week + tk.duration_weeks - 1)
  );

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

  // ── Status cycle ─────────────────────────────────────────────────────────────
  async function handleStatusCycle(id: string) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const next = STATUS_CFG[task.status as StatusKey]?.next ?? "pending";
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: next } : t))
    );
    await supabase.from("gantt_tasks").update({ status: next }).eq("id", id);
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

  // ── Delete ───────────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await supabase.from("gantt_tasks").delete().eq("id", id);
  }

  // ── CSV ──────────────────────────────────────────────────────────────────────
  function handleCSV() {
    exportCSV(tasks, totalWeeks, language as Locale);
  }

  // ── Week group headers (every 4 = ~1 month) ──────────────────────────────────
  const weekGroups = Array.from(
    { length: Math.ceil(totalWeeks / 4) },
    (_, i) => ({
      start: i * 4 + 1,
      end: Math.min(i * 4 + 4, totalWeeks),
    })
  );

  const lang = language as Locale;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-syne font-bold text-lg" style={{ color: CS.text }}>
            {t("ganttTitle", lang)}
          </h2>
          <p className="text-xs font-dm-sans mt-0.5" style={{ color: CS.muted }}>
            {tasks.length}{" "}
            {lang === "es" ? "tareas" : "tasks"} ·{" "}
            {totalWeeks}{" "}
            {lang === "es" ? "semanas" : "weeks"}
          </p>
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

          {/* PDF */}
          <PDFExportButton type="gantt" disabled={tasks.length === 0} />

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
              className="flex flex-1"
              style={{ minWidth: 0 }}
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
                    {lang === "es" ? `Sem.${start}` : `Wk${start}`}
                    {end > start && `–${end}`}
                  </div>
                );
              })}
            </div>

            {/* Actions column */}
            <div style={{ width: ACTION_W, flexShrink: 0 }} />
          </div>

          {/* Rows — DnD sortable */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={tasks.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              {tasks.map((task) => (
                <SortableGanttRow
                  key={task.id}
                  task={task}
                  totalWeeks={totalWeeks}
                  language={lang}
                  isResizing={resizingId === task.id}
                  onDelete={handleDelete}
                  onStatusCycle={handleStatusCycle}
                  onResizeStart={handleResizeStart}
                />
              ))}
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
          <span
            className="text-xs font-dm-sans ml-auto hidden sm:block"
            style={{ color: "rgba(139,150,165,0.55)" }}
          >
            {lang === "es"
              ? "↕ Arrastrar · ← → Borde derecho · Clic en estatus"
              : "↕ Drag to reorder · ← → Right edge to resize · Click status to cycle"}
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
          onSaved={(task) => {
            setTasks((p) => [...p, task]);
            setShowAdd(false);
          }}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}
