"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, RotateCcw, Clock, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/lib/context/ToastContext";
import type { Locale } from "@/lib/utils/i18n";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface HistoryEntry {
  id: string;
  budget_row_id: string;
  project_id: string;
  user_id: string | null;
  user_name: string | null;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
}

interface RowHistoryPanelProps {
  rowId: string;
  rowDescription: string;
  projectId: string;
  lang: Locale;
  onClose: () => void;
  onRestore: (field: string, value: string) => void;
}

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

function fieldLabel(field: string, lang: Locale): string {
  return FIELD_LABELS[field]?.[lang] ?? field;
}

// ─── Status value translations ──────────────────────────────────────────────

const STATUS_LABELS: Record<string, { es: string; en: string }> = {
  pending:     { es: "Pendiente",    en: "Pending" },
  "in-review": { es: "En revisión",  en: "Under Review" },
  approved:    { es: "Aprobado",     en: "Approved" },
};

function formatValue(field: string, value: string | null, lang: Locale): string {
  if (value === null || value === "") return "—";
  if (field === "status") return STATUS_LABELS[value]?.[lang] ?? value;
  return value;
}

// ─── Relative time ──────────────────────────────────────────────────────────

function relativeTime(dateStr: string, lang: Locale): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);

  if (mins < 1) return lang === "es" ? "ahora" : "just now";
  if (mins < 60) return lang === "es" ? `hace ${mins} min` : `${mins} min ago`;
  if (hours < 24) return lang === "es" ? `hace ${hours}h` : `${hours}h ago`;
  if (days < 30) return lang === "es" ? `hace ${days}d` : `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(lang === "es" ? "es-MX" : "en-US", { month: "short", day: "numeric" });
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function RowHistoryPanel({
  rowId, rowDescription, projectId, lang, onClose, onRestore,
}: RowHistoryPanelProps) {
  const supabaseRef = useRef(createClient());
  const { toast } = useToast();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoreConfirm, setRestoreConfirm] = useState<HistoryEntry | null>(null);
  const [restoring, setRestoring] = useState(false);

  // Fetch history
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data } = await supabaseRef.current
        .from("budget_row_history")
        .select("*")
        .eq("budget_row_id", rowId)
        .order("changed_at", { ascending: false })
        .limit(100);
      if (!cancelled) {
        setEntries((data as HistoryEntry[]) ?? []);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [rowId]);

  // Handle restore
  const handleRestore = useCallback(async (entry: HistoryEntry) => {
    setRestoring(true);
    try {
      // Update the budget row
      const field = entry.field_changed;
      const restoreValue = entry.old_value ?? "";

      let updatePayload: Record<string, unknown> = {};
      if (field === "quantity" || field === "unit_price") {
        updatePayload = { [field]: parseFloat(restoreValue) || 0 };
      } else if (field === "status") {
        updatePayload = { [field]: restoreValue };
      } else {
        updatePayload = { [field]: restoreValue || null };
      }

      const { error } = await supabaseRef.current
        .from("budget_rows")
        .update(updatePayload)
        .eq("id", rowId);

      if (error) {
        toast(lang === "es" ? `Error: ${error.message}` : `Error: ${error.message}`, "error");
        setRestoring(false);
        setRestoreConfirm(null);
        return;
      }

      // Track the restore as a new history entry
      const { data: { user } } = await supabaseRef.current.auth.getUser();
      await supabaseRef.current.from("budget_row_history").insert({
        budget_row_id: rowId,
        project_id: projectId,
        user_id: user?.id,
        user_name: user?.email?.split("@")[0] || "Usuario",
        field_changed: field,
        old_value: entry.new_value,
        new_value: entry.old_value,
      });

      // Notify parent to update local state
      onRestore(field, restoreValue);

      toast(
        lang === "es" ? "Valor restaurado" : "Value restored",
        "success",
      );

      // Refresh history
      const { data: refreshed } = await supabaseRef.current
        .from("budget_row_history")
        .select("*")
        .eq("budget_row_id", rowId)
        .order("changed_at", { ascending: false })
        .limit(100);
      setEntries((refreshed as HistoryEntry[]) ?? []);
    } catch {
      toast(lang === "es" ? "Error al restaurar" : "Restore failed", "error");
    } finally {
      setRestoring(false);
      setRestoreConfirm(null);
    }
  }, [rowId, projectId, lang, toast, onRestore]);

  const isEs = lang === "es";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50"
        style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)" }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 bottom-0 z-50 flex flex-col"
        style={{
          width: "min(440px, 90vw)",
          background: "var(--cs-surface)",
          borderLeft: "1px solid var(--cs-border)",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.2)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--cs-border)" }}>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0" style={{ color: "var(--cs-accent)" }} />
              <span className="font-syne font-bold text-sm" style={{ color: "var(--cs-text)" }}>
                {isEs ? "Historial de Cambios" : "Change History"}
              </span>
            </div>
            <p className="text-xs font-dm-sans mt-1 truncate" style={{ color: "var(--cs-muted)" }}>
              {rowDescription}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--cs-muted)" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--cs-muted)" }} />
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Clock className="h-8 w-8 mb-3" style={{ color: "var(--cs-muted)", opacity: 0.4 }} />
              <p className="font-dm-sans text-sm" style={{ color: "var(--cs-muted)" }}>
                {isEs ? "Sin cambios registrados" : "No changes recorded"}
              </p>
              <p className="font-dm-sans text-xs mt-1" style={{ color: "var(--cs-muted)", opacity: 0.6 }}>
                {isEs
                  ? "Los cambios se registrarán cuando edites esta partida"
                  : "Changes will be recorded when you edit this row"}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {entries.map((entry) => {
                const exactDate = new Date(entry.changed_at).toLocaleString(
                  isEs ? "es-MX" : "en-US",
                  { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" },
                );
                return (
                  <div
                    key={entry.id}
                    className="rounded-lg p-3"
                    style={{
                      border: "1px solid var(--cs-border)",
                      background: "rgba(255,255,255,0.02)",
                    }}
                  >
                    {/* Field + time */}
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold font-dm-sans"
                        style={{ background: "rgba(249,115,22,0.1)", color: "var(--cs-accent)" }}
                      >
                        {fieldLabel(entry.field_changed, lang)}
                      </span>
                      <span
                        className="text-xs font-dm-sans"
                        style={{ color: "var(--cs-muted)" }}
                        title={exactDate}
                      >
                        {relativeTime(entry.changed_at, lang)}
                      </span>
                    </div>

                    {/* Old → New */}
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="text-xs font-dm-sans px-2 py-1 rounded"
                        style={{
                          background: "rgba(239,68,68,0.08)",
                          color: "#ef4444",
                          textDecoration: "line-through",
                          maxWidth: "45%",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatValue(entry.field_changed, entry.old_value, lang)}
                      </span>
                      <span style={{ color: "var(--cs-muted)", fontSize: 12 }}>→</span>
                      <span
                        className="text-xs font-dm-sans font-semibold px-2 py-1 rounded"
                        style={{
                          background: "rgba(34,197,94,0.08)",
                          color: "#22c55e",
                          maxWidth: "45%",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatValue(entry.field_changed, entry.new_value, lang)}
                      </span>
                    </div>

                    {/* User + restore */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-dm-sans" style={{ color: "var(--cs-muted)" }}>
                        {entry.user_name || (isEs ? "Usuario" : "User")}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setRestoreConfirm(entry); }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium font-dm-sans transition-colors"
                        style={{
                          background: "transparent",
                          border: "1px solid var(--cs-border)",
                          color: "var(--cs-muted)",
                          cursor: "pointer",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--cs-accent)";
                          (e.currentTarget as HTMLButtonElement).style.color = "var(--cs-accent)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--cs-border)";
                          (e.currentTarget as HTMLButtonElement).style.color = "var(--cs-muted)";
                        }}
                      >
                        <RotateCcw className="h-3 w-3" />
                        {isEs ? "Restaurar" : "Restore"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Entry count */}
        {!loading && entries.length > 0 && (
          <div className="px-5 py-3 shrink-0" style={{ borderTop: "1px solid var(--cs-border)" }}>
            <span className="text-xs font-dm-sans" style={{ color: "var(--cs-muted)" }}>
              {entries.length} {isEs ? "cambio(s) registrado(s)" : "change(s) recorded"}
            </span>
          </div>
        )}
      </div>

      {/* Restore confirmation dialog */}
      {restoreConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setRestoreConfirm(null)}
        >
          <div
            className="rounded-xl p-6 flex flex-col gap-4"
            style={{
              width: "min(380px, 90vw)",
              background: "var(--cs-surface)",
              border: "1px solid var(--cs-border)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4" style={{ color: "var(--cs-accent)" }} />
              <span className="font-syne font-bold text-sm" style={{ color: "var(--cs-text)" }}>
                {isEs ? "Confirmar restauración" : "Confirm restore"}
              </span>
            </div>
            <p className="text-sm font-dm-sans" style={{ color: "var(--cs-muted)" }}>
              {isEs
                ? `¿Restaurar ${fieldLabel(restoreConfirm.field_changed, lang)} a "${formatValue(restoreConfirm.field_changed, restoreConfirm.old_value, lang)}"?`
                : `Restore ${fieldLabel(restoreConfirm.field_changed, lang)} to "${formatValue(restoreConfirm.field_changed, restoreConfirm.old_value, lang)}"?`}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRestoreConfirm(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium font-dm-sans"
                style={{
                  border: "1px solid var(--cs-border)",
                  background: "transparent",
                  color: "var(--cs-muted)",
                  cursor: "pointer",
                }}
              >
                {isEs ? "Cancelar" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => handleRestore(restoreConfirm)}
                disabled={restoring}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold font-dm-sans"
                style={{
                  border: "none",
                  background: "var(--cs-accent)",
                  color: "#fff",
                  cursor: restoring ? "wait" : "pointer",
                  opacity: restoring ? 0.7 : 1,
                }}
              >
                {restoring
                  ? (isEs ? "Restaurando…" : "Restoring…")
                  : (isEs ? "Restaurar" : "Restore")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
