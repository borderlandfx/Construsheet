"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { es, enUS } from "date-fns/locale";
import {
  MapPin, Calendar, Receipt, TrendingUp, ArrowRight,
  MoreVertical, Pencil, Archive, ArchiveRestore, Trash2, X, Loader2, Copy,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/lib/utils/i18n";
import { t } from "@/lib/utils/i18n";
import type { Project, BudgetRow } from "@/lib/types/database.types";

export type ProjectWithBudget = Project & {
  budget_rows: Pick<BudgetRow, "id" | "total">[];
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

export default function ProjectCard({ project: initialProject, locale, onUpdated, onDeleted, onDuplicated }: ProjectCardProps) {
  const supabase = createClient();
  const [project, setProject]     = useState(initialProject);
  const [menuOpen, setMenuOpen]   = useState(false);
  const [showEdit, setShowEdit]   = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const statusCfg = STATUS_CONFIG[project.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.active;
  const itemCount = project.budget_rows.length;
  const totalBudget = project.budget_rows.reduce((sum, r) => sum + (r.total ?? 0), 0);
  const dateLocale = locale === "en" ? enUS : es;
  const createdDate  = format(new Date(project.created_at),  "d MMM yyyy",   { locale: dateLocale });
  const updatedDate  = format(new Date(project.updated_at),  "d MMM yyyy",   { locale: dateLocale });

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
                assignee: tk.assignee,
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
        .select("*, budget_rows(id, total)")
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

  return (
    <>
      <article
        className="group flex flex-col gap-4 rounded-[10px] transition-all duration-200 relative"
        style={{
          background: "var(--cs-surface)",
          border: "1px solid var(--cs-border)",
          padding: "1.25rem",
          height: "100%",
          opacity: project.status === "archived" || duplicating ? 0.65 : 1,
          pointerEvents: duplicating ? "none" : undefined,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(249,115,22,0.5)";
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
            className="absolute inset-0 z-10 flex items-center justify-center rounded-[10px] gap-2"
            style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(2px)" }}
          >
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--cs-accent)" }} />
            <span className="text-sm font-medium font-dm-sans" style={{ color: "var(--cs-text)" }}>
              {locale === "es" ? "Duplicando…" : "Duplicating…"}
            </span>
          </div>
        )}

        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <Link href={`/project/${project.id}`} style={{ textDecoration: "none", flex: 1, minWidth: 0 }}>
            <h3
              className="font-syne font-bold text-base leading-snug line-clamp-2"
              style={{ color: "var(--cs-text)" }}
            >
              {project.name}
            </h3>
          </Link>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Status badge */}
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
                onClick={(e) => { e.preventDefault(); setMenuOpen((o) => !o); }}
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
                    onClick={(e) => { e.preventDefault(); setMenuOpen(false); setShowEdit(true); }}
                    onMouseEnter={(el) => (el.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                    onMouseLeave={(el) => (el.currentTarget.style.background = "transparent")}
                  >
                    <Pencil className="h-3.5 w-3.5" style={{ color: "var(--cs-muted)" }} />
                    {locale === "es" ? "Editar" : "Edit"}
                  </button>

                  <button
                    style={menuItemStyle}
                    onClick={(e) => { e.preventDefault(); handleArchiveToggle(); }}
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
                    onClick={(e) => { e.preventDefault(); handleDuplicate(); }}
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
                    onClick={(e) => { e.preventDefault(); setMenuOpen(false); setShowDelete(true); }}
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

        {/* Location */}
        {project.location && (
          <div className="flex items-center gap-1.5" style={{ color: "var(--cs-muted)" }}>
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="text-sm font-dm-sans truncate">{project.location}</span>
          </div>
        )}

        {/* Stats row */}
        <Link href={`/project/${project.id}`} style={{ textDecoration: "none", marginTop: "auto" }}>
          <div
            className="flex items-center gap-4 rounded-lg py-3 px-3"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--cs-border)" }}
          >
            <div className="flex items-center gap-1.5 flex-1">
              <Receipt className="h-3.5 w-3.5" style={{ color: "var(--cs-muted)" }} />
              <span className="text-sm font-dm-sans" style={{ color: "var(--cs-text)" }}>{itemCount}</span>
              <span className="text-xs font-dm-sans" style={{ color: "var(--cs-muted)" }}>{t("budgetItems", locale)}</span>
            </div>
            <div className="w-px self-stretch" style={{ background: "var(--cs-border)" }} />
            <div className="flex items-center gap-1.5 flex-1 justify-end">
              <TrendingUp className="h-3.5 w-3.5" style={{ color: "var(--cs-accent)" }} />
              <span className="text-sm font-semibold font-dm-sans" style={{ color: "var(--cs-text)" }}>
                {formatCurrency(totalBudget, project.currency)}
              </span>
            </div>
          </div>
        </Link>

        {/* Footer */}
        <Link href={`/project/${project.id}`} style={{ textDecoration: "none" }}>
          <div className="flex items-center justify-between">
            <div
              className="flex items-center gap-1.5"
              style={{ color: "var(--cs-muted)" }}
              title={`${t("createdOn", locale)}: ${createdDate}`}
            >
              <Calendar className="h-3 w-3" />
              <span className="text-xs font-dm-sans">
                {t("lastUpdated", locale)}: {updatedDate}
              </span>
            </div>
            <span className="flex items-center gap-1 text-xs font-medium font-dm-sans" style={{ color: "var(--cs-muted)" }}>
              {t("openProject", locale)}
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" style={{ color: "var(--cs-accent)" }} />
            </span>
          </div>
        </Link>
      </article>

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
