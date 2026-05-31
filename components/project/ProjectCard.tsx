"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  MapPin, Calendar, ArrowRight,
  MoreVertical, Pencil, Archive, ArchiveRestore, Trash2, X, Loader2, Copy,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/lib/utils/i18n";
import { t } from "@/lib/utils/i18n";
import type { Project, BudgetRow, ApuItem } from "@/lib/types/database.types";

export type ProjectWithBudget = Project & {
  budget_rows: Pick<BudgetRow, "id" | "total" | "status" | "is_chapter">[];
  apu_items: Pick<ApuItem, "id">[];
};

interface ProjectCardProps {
  project: ProjectWithBudget;
  locale: Locale;
  onUpdated?: (p: ProjectWithBudget) => void;
  onDeleted?: (id: string) => void;
  onDuplicated?: (p: ProjectWithBudget) => void;
}

const STATUS_CONFIG = {
  active: {
    labelKey: "statusActive" as const,
    dot: "#22c55e",
    bg: "rgba(34,197,94,0.1)",
    text: "#22c55e",
  },
  completed: {
    labelKey: "statusCompleted" as const,
    dot: "#14b8a6",
    bg: "rgba(20,184,166,0.1)",
    text: "#14b8a6",
  },
  archived: {
    labelKey: "statusArchived" as const,
    dot: "#6b7280",
    bg: "rgba(107,114,128,0.1)",
    text: "#6b7280",
  },
};

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditProjectModal({
  project,
  locale,
  onSaved,
  onClose,
}: {
  project: ProjectWithBudget;
  locale: Locale;
  onSaved: (p: ProjectWithBudget) => void;
  onClose: () => void;
}) {
  const supabase = createClient();
  const [saving, setSaving]       = useState(false);
  const [name, setName]           = useState(project.name);
  const [location, setLocation]   = useState(project.location ?? "");
  const [description, setDesc]    = useState(project.description ?? "");
  const [status, setStatus]       = useState(project.status);

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
      location: location.trim() || null,
      description: description.trim() || null,
      status: status as "active" | "archived" | "completed",
    };
    await supabase.from("projects").update(update).eq("id", project.id);
    setSaving(false);
    onSaved({ ...project, ...update });
    onClose();
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%", padding: "0.5rem 0.75rem", borderRadius: 8,
    border: "1px solid var(--cs-border)", background: "rgba(255,255,255,0.04)",
    color: "var(--cs-text)", fontSize: "0.875rem",
    fontFamily: "var(--font-dm-sans)", outline: "none",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", marginBottom: "0.375rem", fontSize: "0.8125rem",
    fontWeight: 500, color: "var(--cs-muted)", fontFamily: "var(--font-dm-sans)",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full flex flex-col gap-5"
        style={{
          maxWidth: 480, background: "var(--cs-surface)",
          border: "1px solid var(--cs-border)", borderRadius: 16,
          padding: "1.75rem", boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-syne font-bold text-lg" style={{ color: "var(--cs-text)" }}>
            {locale === "es" ? "Editar Proyecto" : "Edit Project"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--cs-muted)" }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label style={labelStyle}>{t("projectName", locale)} *</label>
            <input autoFocus style={fieldStyle} value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()} />
          </div>
          <div>
            <label style={labelStyle}>{t("location", locale)}</label>
            <input style={fieldStyle} value={location} onChange={(e) => setLocation(e.target.value)}
              placeholder={t("locationPlaceholder", locale)} />
          </div>
          <div>
            <label style={labelStyle}>{t("description", locale)}</label>
            <textarea style={{ ...fieldStyle, resize: "vertical", minHeight: 68 }}
              value={description} onChange={(e) => setDesc(e.target.value)} rows={2}
              placeholder={t("descriptionPlaceholder", locale)} />
          </div>
          <div>
            <label style={labelStyle}>{locale === "es" ? "Estado" : "Status"}</label>
            <select style={fieldStyle} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="active">{locale === "es" ? "Activo" : "Active"}</option>
              <option value="completed">{locale === "es" ? "Completado" : "Completed"}</option>
              <option value="archived">{locale === "es" ? "Archivado" : "Archived"}</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-[10px] text-sm font-medium font-dm-sans"
            style={{ border: "1px solid var(--cs-border)", background: "transparent", color: "var(--cs-muted)", cursor: "pointer" }}>
            {t("cancel", locale)}
          </button>
          <button onClick={handleSave} disabled={saving || !name.trim()}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[10px] text-sm font-semibold font-dm-sans"
            style={{
              background: "var(--cs-accent)", color: "#fff", border: "none",
              cursor: saving || !name.trim() ? "not-allowed" : "pointer",
              opacity: saving || !name.trim() ? 0.6 : 1,
            }}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("save", locale)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteConfirmModal({
  project,
  locale,
  onConfirm,
  onClose,
}: {
  project: ProjectWithBudget;
  locale: Locale;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleDelete() {
    setDeleting(true);
    await onConfirm();
    setDeleting(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full flex flex-col gap-4"
        style={{
          maxWidth: 400, background: "var(--cs-surface)",
          border: "1px solid var(--cs-border)", borderRadius: 16,
          padding: "1.5rem", boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-syne font-bold text-base" style={{ color: "var(--cs-text)" }}>
            {locale === "es" ? "¿Eliminar proyecto?" : "Delete project?"}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--cs-muted)" }}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm font-dm-sans" style={{ color: "var(--cs-muted)", lineHeight: 1.6 }}>
          {locale === "es"
            ? <>Se eliminará permanentemente <strong style={{ color: "var(--cs-text)" }}>{project.name}</strong> junto con todas sus partidas, APUs, tareas y cubicaciones. Esta acción no se puede deshacer.</>
            : <>This will permanently delete <strong style={{ color: "var(--cs-text)" }}>{project.name}</strong> along with all its budget rows, APUs, tasks and takeoffs. This cannot be undone.</>}
        </p>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 rounded-[10px] text-sm font-medium font-dm-sans"
            style={{ border: "1px solid var(--cs-border)", background: "transparent", color: "var(--cs-muted)", cursor: "pointer" }}>
            {locale === "es" ? "Cancelar" : "Cancel"}
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-semibold font-dm-sans"
            style={{ background: "#ef4444", color: "#fff", border: "none", cursor: deleting ? "not-allowed" : "pointer", opacity: deleting ? 0.6 : 1 }}>
            {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {locale === "es" ? "Sí, eliminar" : "Yes, delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ProjectCard ──────────────────────────────────────────────────────────────

function relativeDate(dateStr: string, locale: Locale): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return t("cardToday", locale);
  if (diffDays === 1) return t("cardYesterday", locale);
  const template = t("cardDaysAgo", locale);
  return template.replace("{n}", String(diffDays));
}

export default function ProjectCard({ project: initialProject, locale, onUpdated, onDeleted, onDuplicated }: ProjectCardProps) {
  const supabase = createClient();
  const [project, setProject]     = useState(initialProject);
  const [menuOpen, setMenuOpen]   = useState(false);
  const [showEdit, setShowEdit]   = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const statusCfg = STATUS_CONFIG[project.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.active;
  const budgetRows = project.budget_rows ?? [];
  const apuItems = project.apu_items ?? [];
  const nonChapterRows = budgetRows.filter((r) => !r.is_chapter);
  const totalBudget = nonChapterRows.reduce((sum, r) => sum + (r.total ?? 0), 0);
  const approvedTotal = nonChapterRows.filter((r) => r.status === "approved").reduce((sum, r) => sum + (r.total ?? 0), 0);
  const approvedPct = totalBudget > 0 ? Math.round((approvedTotal / totalBudget) * 100) : 0;
  const partidasCount = nonChapterRows.length;
  const apuCount = apuItems.length;
  const updatedRelative = relativeDate(project.updated_at, locale);

  // Close menu when clicking outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  async function handleArchiveToggle() {
    setMenuOpen(false);
    const nextStatus = project.status === "archived" ? "active" : "archived";
    await supabase.from("projects").update({ status: nextStatus }).eq("id", project.id);
    const updated = { ...project, status: nextStatus as typeof project.status };
    setProject(updated);
    onUpdated?.(updated);
  }

  async function handleDelete() {
    await supabase.from("projects").delete().eq("id", project.id);
    onDeleted?.(project.id);
  }

  function handleUpdated(p: ProjectWithBudget) {
    setProject(p);
    onUpdated?.(p);
  }

  async function handleDuplicate() {
    setMenuOpen(false);
    setDuplicating(true);
    try {
      // 1. Create the new project
      const copyName = locale === "es"
        ? `${project.name} (Copia)`
        : `${project.name} (Copy)`;
      const { data: newProj, error: projErr } = await supabase
        .from("projects")
        .insert({
          user_id: project.user_id,
          name: copyName,
          location: project.location,
          description: project.description,
          currency: project.currency,
          status: "active" as const,
          project_settings: project.project_settings,
        })
        .select()
        .single();
      if (projErr || !newProj) throw projErr ?? new Error("Failed to create project");

      const newId = (newProj as { id: string }).id;

      // 2. Fetch all source data in parallel
      const [
        { data: srcApus },
        { data: srcRows },
        { data: srcTasks },
        { data: srcTakeoffs },
      ] = await Promise.all([
        supabase.from("apu_items").select("*").eq("project_id", project.id),
        supabase.from("budget_rows").select("*").eq("project_id", project.id).order("sort_order"),
        supabase.from("gantt_tasks").select("*").eq("project_id", project.id).order("sort_order"),
        supabase.from("takeoff_items").select("*").eq("project_id", project.id).order("sort_order"),
      ]);

      // 3. Insert APU items and build old-id → new-id map
      const apuIdMap = new Map<string, string>();
      if (srcApus && srcApus.length > 0) {
        const apuPayload = (srcApus as import("@/lib/types/database.types").ApuItem[]).map((a) => ({
          project_id: newId,
          code: a.code,
          description: a.description,
          unit: a.unit,
          materials: a.materials,
          labor: a.labor,
          equipment: a.equipment,
          direct_cost: a.direct_cost,
          overhead_pct: a.overhead_pct,
          profit_pct: a.profit_pct,
          selling_price: a.selling_price,
        }));
        const { data: newApus } = await supabase
          .from("apu_items")
          .insert(apuPayload)
          .select("id");
        // PostgREST returns rows in insert order
        (newApus as { id: string }[] | null)?.forEach((newApu, i) => {
          apuIdMap.set((srcApus as import("@/lib/types/database.types").ApuItem[])[i].id, newApu.id);
        });
      }

      // 4. Insert budget rows, gantt tasks, takeoff items in parallel
      await Promise.all([
        srcRows && srcRows.length > 0
          ? supabase.from("budget_rows").insert(
              (srcRows as import("@/lib/types/database.types").BudgetRow[]).map((r, i) => ({
                project_id: newId,
                apu_item_id: r.apu_item_id ? (apuIdMap.get(r.apu_item_id) ?? null) : null,
                section: r.section,
                code: r.code,
                description: r.description,
                unit: r.unit,
                quantity: r.quantity,
                unit_price: r.unit_price,
                original_unit_price: r.unit_price,
                original_quantity: r.quantity,
                status: r.status,
                assignee: r.assignee,
                sort_order: i,
              }))
            )
          : Promise.resolve(),
        srcTasks && srcTasks.length > 0
          ? supabase.from("gantt_tasks").insert(
              (srcTasks as import("@/lib/types/database.types").GanttTask[]).map((tk, i) => ({
                project_id: newId,
                name: tk.name,
                start_week: tk.start_week,
                duration_weeks: tk.duration_weeks,
                color: tk.color,
                status: tk.status,
                progress_pct: tk.progress_pct,
                sort_order: i,
              }))
            )
          : Promise.resolve(),
        srcTakeoffs && srcTakeoffs.length > 0
          ? supabase.from("takeoff_items").insert(
              (srcTakeoffs as import("@/lib/types/database.types").TakeoffItem[]).map((to, i) => ({
                project_id: newId,
                element: to.element,
                description: to.description,
                unit: to.unit,
                quantity: to.quantity,
                notes: to.notes,
                sort_order: i,
              }))
            )
          : Promise.resolve(),
      ]);

      // 5. Fetch new project with budget_rows for the dashboard card
      const { data: newProjFull } = await supabase
        .from("projects")
        .select("*, budget_rows(id, total, status, is_chapter), apu_items(id)")
        .eq("id", newId)
        .single();

      if (newProjFull) {
        onDuplicated?.(newProjFull as ProjectWithBudget);
      }
    } finally {
      setDuplicating(false);
    }
  }

  const menuItemStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 8,
    width: "100%", padding: "7px 12px", border: "none",
    background: "transparent", cursor: "pointer",
    fontSize: "0.8125rem", fontFamily: "var(--font-dm-sans)",
    textAlign: "left", borderRadius: 6,
    color: "var(--cs-text)",
  };

  const metricStyle: React.CSSProperties = {
    display: "flex", flexDirection: "column", gap: 2,
    padding: "8px 10px", borderRadius: 8,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid var(--cs-border)",
    flex: 1, minWidth: 0,
  };

  return (
    <>
      <Link href={`/project/${project.id}`} style={{ textDecoration: "none" }}>
        <article
          className="group flex flex-col gap-3 rounded-xl transition-all duration-200 relative cursor-pointer"
          style={{
            background: "var(--cs-surface)",
            border: "1px solid var(--cs-border)",
            padding: "1.25rem",
            height: "100%",
            opacity: project.status === "archived" || duplicating ? 0.65 : 1,
            pointerEvents: duplicating ? "none" : undefined,
            borderRadius: "var(--border-radius-lg, 12px)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border-secondary, rgba(249,115,22,0.5))";
            (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 1px rgba(249,115,22,0.15), 0 4px 24px rgba(249,115,22,0.08)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "var(--cs-border)";
            (e.currentTarget as HTMLElement).style.boxShadow = "none";
          }}
        >
          {/* Duplicating overlay */}
          {duplicating && (
            <div
              className="absolute inset-0 z-10 flex items-center justify-center rounded-xl gap-2"
              style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(2px)" }}
            >
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--cs-accent)" }} />
              <span className="text-sm font-medium font-dm-sans" style={{ color: "var(--cs-text)" }}>
                {locale === "es" ? "Duplicando…" : "Duplicating…"}
              </span>
            </div>
          )}

          {/* Header row: name + status + menu */}
          <div className="flex items-start justify-between gap-2">
            <h3
              className="font-syne font-bold text-base leading-snug line-clamp-2 flex-1 min-w-0"
              style={{ color: "var(--cs-text)" }}
            >
              {project.name}
            </h3>

            <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.preventDefault()}>
              <span
                className="inline-flex items-center gap-1.5 rounded-full text-xs font-medium px-2.5 py-1"
                style={{
                  background: statusCfg.bg,
                  color: statusCfg.text,
                  fontFamily: "var(--font-dm-sans)",
                }}
              >
                <span className="rounded-full" style={{ width: 6, height: 6, background: statusCfg.dot, display: "inline-block" }} />
                {t(statusCfg.labelKey, locale)}
              </span>

              {/* Three-dot menu */}
              <div ref={menuRef} style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen((o) => !o); }}
                  className="flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    width: 26, height: 26, background: "none",
                    border: "1px solid var(--cs-border)", cursor: "pointer",
                    color: "var(--cs-muted)",
                  }}
                  aria-label={locale === "es" ? "Opciones del proyecto" : "Project options"}
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </button>

                {menuOpen && (
                  <div
                    className="absolute right-0 top-full mt-1 rounded-[10px] py-1 z-20"
                    style={{
                      minWidth: 160,
                      background: "var(--cs-surface)",
                      border: "1px solid var(--cs-border)",
                      boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                    }}
                  >
                    <button
                      style={menuItemStyle}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(false); setShowEdit(true); }}
                      onMouseEnter={(el) => (el.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                      onMouseLeave={(el) => (el.currentTarget.style.background = "transparent")}
                    >
                      <Pencil className="h-3.5 w-3.5" style={{ color: "var(--cs-muted)" }} />
                      {locale === "es" ? "Editar" : "Edit"}
                    </button>

                    <button
                      style={menuItemStyle}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleArchiveToggle(); }}
                      onMouseEnter={(el) => (el.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                      onMouseLeave={(el) => (el.currentTarget.style.background = "transparent")}
                    >
                      {project.status === "archived"
                        ? <ArchiveRestore className="h-3.5 w-3.5" style={{ color: "var(--cs-muted)" }} />
                        : <Archive className="h-3.5 w-3.5" style={{ color: "var(--cs-muted)" }} />}
                      {project.status === "archived"
                        ? (locale === "es" ? "Activar" : "Unarchive")
                        : (locale === "es" ? "Archivar" : "Archive")}
                    </button>

                    <button
                      style={menuItemStyle}
                      disabled={duplicating}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDuplicate(); }}
                      onMouseEnter={(el) => (el.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                      onMouseLeave={(el) => (el.currentTarget.style.background = "transparent")}
                    >
                      {duplicating
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: "var(--cs-muted)" }} />
                        : <Copy className="h-3.5 w-3.5" style={{ color: "var(--cs-muted)" }} />}
                      {locale === "es" ? "Duplicar" : "Duplicate"}
                    </button>

                    <div style={{ height: 1, background: "var(--cs-border)", margin: "4px 8px" }} />

                    <button
                      style={{ ...menuItemStyle, color: "#ef4444" }}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(false); setShowDelete(true); }}
                      onMouseEnter={(el) => (el.currentTarget.style.background = "rgba(239,68,68,0.08)")}
                      onMouseLeave={(el) => (el.currentTarget.style.background = "transparent")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {locale === "es" ? "Eliminar" : "Delete"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Metrics row: 2x2 grid */}
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div style={metricStyle}>
              <span className="text-[11px] font-dm-sans" style={{ color: "var(--cs-muted)" }}>
                {t("cardBudget", locale)}
              </span>
              <span className="text-sm font-semibold font-dm-sans truncate" style={{ color: "var(--cs-text)" }}>
                {formatCurrency(totalBudget, project.currency)}
              </span>
            </div>
            <div style={metricStyle}>
              <span className="text-[11px] font-dm-sans" style={{ color: "var(--cs-muted)" }}>
                {t("cardApproved", locale)}
              </span>
              <span className="text-sm font-semibold font-dm-sans" style={{ color: "#22c55e" }}>
                {approvedPct}%
              </span>
            </div>
            <div style={metricStyle}>
              <span className="text-[11px] font-dm-sans" style={{ color: "var(--cs-muted)" }}>
                {t("cardApus", locale)}
              </span>
              <span className="text-sm font-semibold font-dm-sans" style={{ color: "var(--cs-text)" }}>
                {apuCount}
              </span>
            </div>
            <div style={metricStyle}>
              <span className="text-[11px] font-dm-sans" style={{ color: "var(--cs-muted)" }}>
                {t("cardPartidas", locale)}
              </span>
              <span className="text-sm font-semibold font-dm-sans" style={{ color: "var(--cs-text)" }}>
                {partidasCount}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="flex flex-col gap-1.5">
            <div
              className="w-full rounded-full overflow-hidden"
              style={{ height: 5, background: "rgba(255,255,255,0.06)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${approvedPct}%`,
                  background: "#22c55e",
                  minWidth: approvedPct > 0 ? 4 : 0,
                }}
              />
            </div>
            <span className="text-[11px] font-dm-sans" style={{ color: "var(--cs-muted)" }}>
              {approvedPct}% {t("cardApprovedPct", locale)}
            </span>
          </div>

          {/* Footer row */}
          <div className="flex items-center justify-between mt-auto pt-1">
            <div className="flex items-center gap-3" style={{ color: "var(--cs-muted)" }}>
              {project.location && (
                <span className="flex items-center gap-1 text-xs font-dm-sans truncate" style={{ maxWidth: 140 }}>
                  <MapPin className="h-3 w-3 shrink-0" />
                  {project.location}
                </span>
              )}
              <span className="flex items-center gap-1 text-xs font-dm-sans">
                <Calendar className="h-3 w-3 shrink-0" />
                {updatedRelative}
              </span>
            </div>
            <span
              className="flex items-center gap-1 text-xs font-semibold font-dm-sans shrink-0"
              style={{ color: "var(--cs-accent)" }}
            >
              {t("openProject", locale)}
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </article>
      </Link>

      {showEdit && (
        <EditProjectModal
          project={project}
          locale={locale}
          onSaved={handleUpdated}
          onClose={() => setShowEdit(false)}
        />
      )}

      {showDelete && (
        <DeleteConfirmModal
          project={project}
          locale={locale}
          onConfirm={handleDelete}
          onClose={() => setShowDelete(false)}
        />
      )}
    </>
  );
}
