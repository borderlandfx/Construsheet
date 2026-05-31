"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Loader2, Clock, Filter, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/context/WorkspaceContext";
import type { Locale } from "@/lib/utils/i18n";
import type { HistoryEntry } from "./RowHistoryPanel";

// ─── Field name translations ────────────────────────────────────────────────

const FIELD_LABELS: Record<string, { es: string; en: string }> = {
  quantity:    { es: "Cantidad",        en: "Quantity" },
  unit_price:  { es: "Precio Unitario", en: "Unit Price" },
  description: { es: "Descripción",     en: "Description" },
  status:      { es: "Estatus",         en: "Status" },
  assignee:    { es: "Responsable",     en: "Assignee" },
  section:     { es: "Capítulo",        en: "Chapter" },
  code:        { es: "Código",          en: "Code" },
  unit:        { es: "Unidad",          en: "Unit" },
};

const STATUS_LABELS: Record<string, { es: string; en: string }> = {
  pending:     { es: "Pendiente",    en: "Pending" },
  "in-review": { es: "En revisión",  en: "Under Review" },
  approved:    { es: "Aprobado",     en: "Approved" },
};

function fieldLabel(field: string, lang: Locale): string {
  return FIELD_LABELS[field]?.[lang] ?? field;
}

function formatValue(field: string, value: string | null, lang: Locale): string {
  if (value === null || value === "") return "—";
  if (field === "status") return STATUS_LABELS[value]?.[lang] ?? value;
  return value;
}

// ─── Extended entry with row description ────────────────────────────────────

interface HistoryEntryWithRow extends HistoryEntry {
  row_description?: string;
  row_section?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ProjectHistory() {
  const supabaseRef = useRef(createClient());
  const { projectId, language } = useWorkspace();
  const lang = language as Locale;
  const isEs = lang === "es";

  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<HistoryEntryWithRow[]>([]);
  const [fieldFilter, setFieldFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [sectionFilter, setSectionFilter] = useState<string>("all");

  // Fetch all history + budget row descriptions
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const sb = supabaseRef.current;
      const [hRes, bRes] = await Promise.all([
        sb.from("budget_row_history")
          .select("*")
          .eq("project_id", projectId)
          .order("changed_at", { ascending: false })
          .limit(500),
        sb.from("budget_rows")
          .select("id, description, section")
          .eq("project_id", projectId),
      ]);
      if (cancelled) return;

      const rowMap = new Map<string, { description: string; section: string }>();
      ((bRes.data ?? []) as { id: string; description: string; section: string }[]).forEach((r) => {
        rowMap.set(r.id, { description: r.description, section: r.section });
      });

      const enriched: HistoryEntryWithRow[] = ((hRes.data ?? []) as HistoryEntry[]).map((e) => ({
        ...e,
        row_description: rowMap.get(e.budget_row_id)?.description,
        row_section: rowMap.get(e.budget_row_id)?.section,
      }));

      setEntries(enriched);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [projectId]);

  // Unique values for filters
  const fields = useMemo(() => Array.from(new Set(entries.map((e) => e.field_changed))), [entries]);
  const users = useMemo(() => Array.from(new Set(entries.map((e) => e.user_name).filter(Boolean))), [entries]);
  const sections = useMemo(() => Array.from(new Set(entries.map((e) => e.row_section).filter(Boolean))), [entries]);

  // Filtered entries
  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (fieldFilter !== "all" && e.field_changed !== fieldFilter) return false;
      if (userFilter !== "all" && e.user_name !== userFilter) return false;
      if (sectionFilter !== "all" && e.row_section !== sectionFilter) return false;
      return true;
    });
  }, [entries, fieldFilter, userFilter, sectionFilter]);

  const hasFilters = fieldFilter !== "all" || userFilter !== "all" || sectionFilter !== "all";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--color-text-secondary)" }} />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Clock className="h-10 w-10 mb-3" style={{ color: "var(--cs-muted)", opacity: 0.4 }} />
        <p className="font-dm-sans text-base font-medium" style={{ color: "var(--cs-text)" }}>
          {isEs ? "Sin historial de cambios" : "No change history"}
        </p>
        <p className="font-dm-sans text-sm mt-1" style={{ color: "var(--cs-muted)", maxWidth: 360 }}>
          {isEs
            ? "Los cambios a partidas del presupuesto se registrarán aquí automáticamente"
            : "Budget row changes will be recorded here automatically"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5" style={{ color: "var(--cs-muted)" }} />
          <span className="text-xs font-dm-sans font-medium" style={{ color: "var(--cs-muted)" }}>
            {isEs ? "Filtrar:" : "Filter:"}
          </span>
        </div>

        {/* Field filter */}
        <select
          value={fieldFilter}
          onChange={(e) => setFieldFilter(e.target.value)}
          className="text-xs font-dm-sans rounded-lg px-2 py-1"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--cs-border)",
            color: "var(--cs-text)",
            cursor: "pointer",
          }}
        >
          <option value="all">{isEs ? "Todos los campos" : "All fields"}</option>
          {fields.map((f) => (
            <option key={f} value={f}>{fieldLabel(f, lang)}</option>
          ))}
        </select>

        {/* User filter */}
        {users.length > 1 && (
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="text-xs font-dm-sans rounded-lg px-2 py-1"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--cs-border)",
              color: "var(--cs-text)",
              cursor: "pointer",
            }}
          >
            <option value="all">{isEs ? "Todos los usuarios" : "All users"}</option>
            {users.map((u) => (
              <option key={u} value={u!}>{u}</option>
            ))}
          </select>
        )}

        {/* Section filter */}
        {sections.length > 1 && (
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="text-xs font-dm-sans rounded-lg px-2 py-1"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--cs-border)",
              color: "var(--cs-text)",
              cursor: "pointer",
            }}
          >
            <option value="all">{isEs ? "Todos los capítulos" : "All chapters"}</option>
            {sections.map((s) => (
              <option key={s} value={s!}>{s}</option>
            ))}
          </select>
        )}

        {hasFilters && (
          <button
            type="button"
            onClick={() => { setFieldFilter("all"); setUserFilter("all"); setSectionFilter("all"); }}
            className="text-xs font-dm-sans flex items-center gap-1 px-2 py-1 rounded-lg"
            style={{
              background: "transparent",
              border: "1px solid var(--cs-border)",
              color: "var(--cs-muted)",
              cursor: "pointer",
            }}
          >
            <X className="h-3 w-3" /> {isEs ? "Limpiar" : "Clear"}
          </button>
        )}

        <span className="text-xs font-dm-sans ml-auto" style={{ color: "var(--cs-muted)" }}>
          {filtered.length} {isEs ? "cambio(s)" : "change(s)"}
        </span>
      </div>

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "var(--color-background-secondary)",
          border: "1px solid var(--color-border-tertiary)",
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border-tertiary)" }}>
                {[
                  isEs ? "Fecha" : "Date",
                  isEs ? "Partida" : "Item",
                  isEs ? "Campo" : "Field",
                  isEs ? "Antes" : "Before",
                  isEs ? "Después" : "After",
                  isEs ? "Usuario" : "User",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider font-dm-sans whitespace-nowrap"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => {
                const dateStr = new Date(entry.changed_at).toLocaleString(
                  isEs ? "es-MX" : "en-US",
                  { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" },
                );
                return (
                  <tr
                    key={entry.id}
                    className="transition-colors hover:bg-white/[0.02]"
                    style={{ borderBottom: "1px solid var(--color-border-tertiary)" }}
                  >
                    <td className="px-4 py-2.5 text-xs font-dm-sans whitespace-nowrap" style={{ color: "var(--color-text-secondary)" }}>
                      {dateStr}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-dm-sans" style={{ color: "var(--color-text-primary)", maxWidth: 180 }}>
                      <span className="truncate block">{entry.row_description ?? entry.budget_row_id.slice(0, 8)}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium font-dm-sans"
                        style={{ background: "rgba(249,115,22,0.1)", color: "var(--cs-accent, #f97316)" }}
                      >
                        {fieldLabel(entry.field_changed, lang)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-dm-sans" style={{ color: "#ef4444", maxWidth: 120 }}>
                      <span className="truncate block" style={{ textDecoration: "line-through" }}>
                        {formatValue(entry.field_changed, entry.old_value, lang)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-dm-sans font-semibold" style={{ color: "#22c55e", maxWidth: 120 }}>
                      <span className="truncate block">
                        {formatValue(entry.field_changed, entry.new_value, lang)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-dm-sans" style={{ color: "var(--color-text-secondary)" }}>
                      {entry.user_name || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
