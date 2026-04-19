"use client";

import { useState, useEffect, useRef, useCallback, Fragment } from "react";
import {
  Plus, Trash2, Loader2, X, Search, Import,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/context/WorkspaceContext";
import { useToast } from "@/lib/context/ToastContext";
import { t } from "@/lib/utils/i18n";
import type {
  BudgetRow, BudgetRowInsert, BudgetRowUpdate, ApuItem,
} from "@/lib/types/database.types";
import type { Locale } from "@/lib/utils/i18n";
import PDFExportButton from "@/components/workspace/PDFExportButton";

// ─── Design tokens ────────────────────────────────────────────────────────────

const CS = {
  surface:  "var(--cs-surface)",
  border:   "var(--cs-border)",
  accent:   "var(--cs-accent)",
  text:     "var(--cs-text)",
  muted:    "var(--cs-muted)",
  bg:       "var(--cs-bg)",
} as const;

// ─── Status configuration ─────────────────────────────────────────────────────

const STATUS_CFG = {
  approved: { label: { es: "Aprobado",    en: "Approved"     }, bg: "rgba(34,197,94,0.12)",  color: "#22c55e" },
  review:   { label: { es: "En revisión", en: "Under Review"  }, bg: "rgba(251,191,36,0.12)", color: "#fbbf24" },
  pending:  { label: { es: "Pendiente",   en: "Pending"       }, bg: "rgba(96,165,250,0.12)", color: "#60a5fa" },
} as const;

type StatusKey = keyof typeof STATUS_CFG;

function StatusPill({ status, language }: { status: StatusKey; language: Locale }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.pending;
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium font-dm-sans whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label[language]}
    </span>
  );
}

// ─── Inline-editable cell ─────────────────────────────────────────────────────

type EditableField = "quantity" | "unit_price" | "status" | "assignee";

interface InlineCellProps {
  field: EditableField;
  displayValue: React.ReactNode;
  rawValue: string;
  onSave: (val: string) => void;
}

function InlineCell({ field, displayValue, rawValue, onSave }: InlineCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(rawValue);
  const ref = useRef<HTMLInputElement & HTMLSelectElement>(null);

  function commit() {
    onSave(draft);
    setEditing(false);
  }

  function startEdit() {
    setDraft(rawValue);
    setEditing(true);
    setTimeout(() => ref.current?.focus(), 0);
  }

  const inputBase: React.CSSProperties = {
    background: "rgba(255,255,255,0.06)",
    border: `1px solid ${CS.accent}`,
    borderRadius: 4,
    color: CS.text,
    fontFamily: "var(--font-dm-sans)",
    fontSize: "0.8125rem",
    outline: "none",
    width: "100%",
    padding: "1px 4px",
  };

  if (editing && field === "status") {
    return (
      <select
        ref={ref as React.RefObject<HTMLSelectElement>}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        style={inputBase}
      >
        <option value="pending">Pendiente</option>
        <option value="review">En revisión</option>
        <option value="approved">Aprobado</option>
      </select>
    );
  }

  if (editing) {
    return (
      <input
        ref={ref as React.RefObject<HTMLInputElement>}
        value={draft}
        type={field === "quantity" || field === "unit_price" ? "number" : "text"}
        min={0}
        step="any"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        style={inputBase}
      />
    );
  }

  return (
    <span
      onDoubleClick={startEdit}
      title="Double-click to edit"
      style={{ cursor: "default", minWidth: 20, display: "inline-block" }}
    >
      {displayValue}
    </span>
  );
}

// ─── Add Item Modal ───────────────────────────────────────────────────────────

const FIELD: React.CSSProperties = {
  width: "100%",
  padding: "0.4rem 0.6rem",
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

interface AddItemModalProps {
  projectId: string;
  language: Locale;
  sections: string[];
  rowCount: number;
  onSaved: (row: BudgetRow) => void;
  onClose: () => void;
}

function AddItemModal({ projectId, language, sections, rowCount, onSaved, onClose }: AddItemModalProps) {
  const supabase = createClient();
  const [saving, setSaving]       = useState(false);
  const [section, setSection]     = useState(sections[0] ?? "");
  const [newSec, setNewSec]       = useState("");
  const [code, setCode]           = useState("");
  const [description, setDesc]    = useState("");
  const [unit, setUnit]           = useState("");
  const [quantity, setQuantity]   = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [status, setStatus]       = useState<StatusKey>("pending");
  const [assignee, setAssignee]   = useState("");

  const effectiveSec = section === "__new__" ? newSec.trim() : section.trim();

  async function handleSave() {
    if (!effectiveSec || !description.trim()) return;
    setSaving(true);
    const payload: BudgetRowInsert = {
      project_id: projectId,
      section:    effectiveSec,
      description: description.trim(),
      code:       code.trim() || null,
      unit:       unit.trim() || null,
      quantity:   parseFloat(quantity)  || 0,
      unit_price: parseFloat(unitPrice) || 0,
      status,
      assignee:   assignee.trim() || null,
      sort_order: rowCount,
    };
    const { data, error } = await supabase.from("budget_rows").insert(payload).select().single();
    setSaving(false);
    if (!error && data) { onSaved(data as BudgetRow); onClose(); }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full flex flex-col gap-4 overflow-y-auto"
        style={{
          maxWidth: 540, maxHeight: "90vh",
          background: CS.surface,
          border: `1px solid ${CS.border}`,
          borderRadius: 16, padding: "1.5rem",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        <div className="flex items-center justify-between shrink-0">
          <span className="font-syne font-bold text-base" style={{ color: CS.text }}>
            {language === "es" ? "Nueva Partida" : "New Budget Row"}
          </span>
          <button
            onClick={onClose}
            aria-label={language === "es" ? "Cerrar" : "Close"}
            style={{ background: "none", border: "none", cursor: "pointer", color: CS.muted }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Section */}
        <div>
          <label style={LBL}>{language === "es" ? "Sección *" : "Section *"}</label>
          <select style={FIELD} value={section} onChange={(e) => setSection(e.target.value)}>
            {sections.map((s) => <option key={s} value={s}>{s}</option>)}
            <option value="__new__">{language === "es" ? "+ Nueva sección..." : "+ New section..."}</option>
          </select>
        </div>
        {section === "__new__" && (
          <div>
            <label style={LBL}>{language === "es" ? "Nombre de la sección" : "Section name"}</label>
            <input style={FIELD} value={newSec} onChange={(e) => setNewSec(e.target.value)} placeholder="01 · TRABAJOS PRELIMINARES" autoFocus />
          </div>
        )}

        <div className="grid grid-cols-4 gap-3">
          <div>
            <label style={LBL}>{language === "es" ? "Código" : "Code"}</label>
            <input style={FIELD} value={code} onChange={(e) => setCode(e.target.value)} placeholder="01.01" />
          </div>
          <div className="col-span-3">
            <label style={LBL}>{language === "es" ? "Descripción *" : "Description *"}</label>
            <input style={FIELD} value={description} onChange={(e) => setDesc(e.target.value)} placeholder={language === "es" ? "Limpieza y trazo..." : "Site clearing..."} />
          </div>
          <div>
            <label style={LBL}>{language === "es" ? "Unidad" : "Unit"}</label>
            <input style={FIELD} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="m²" />
          </div>
          <div>
            <label style={LBL}>{language === "es" ? "Cantidad" : "Quantity"}</label>
            <input style={FIELD} type="number" min={0} step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" />
          </div>
          <div>
            <label style={LBL}>{language === "es" ? "Precio Unitario" : "Unit Price"}</label>
            <input style={FIELD} type="number" min={0} step="any" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <label style={LBL}>{language === "es" ? "Estatus" : "Status"}</label>
            <select style={FIELD} value={status} onChange={(e) => setStatus(e.target.value as StatusKey)}>
              <option value="pending">{language === "es" ? "Pendiente" : "Pending"}</option>
              <option value="review">{language === "es" ? "En revisión" : "Under Review"}</option>
              <option value="approved">{language === "es" ? "Aprobado" : "Approved"}</option>
            </select>
          </div>
          <div className="col-span-2">
            <label style={LBL}>{language === "es" ? "Responsable" : "Assignee"}</label>
            <input style={FIELD} value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder={language === "es" ? "Nombre..." : "Name..."} />
          </div>
        </div>

        {quantity && unitPrice && (
          <p className="text-xs font-dm-sans text-right" style={{ color: CS.muted }}>
            {language === "es" ? "Total estimado: " : "Estimated total: "}
            <strong style={{ color: CS.accent }}>
              {(parseFloat(quantity) * parseFloat(unitPrice)).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </strong>
          </p>
        )}

        <div className="flex gap-2 justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-[10px] text-sm font-medium font-dm-sans"
            style={{ border: `1px solid ${CS.border}`, background: "transparent", color: CS.muted, cursor: "pointer" }}
          >
            {t("cancel", language)}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !effectiveSec || !description.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-semibold font-dm-sans"
            style={{
              background: CS.accent, color: "#fff", border: "none",
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving || !effectiveSec || !description.trim() ? 0.6 : 1,
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

// ─── Import APU Modal ─────────────────────────────────────────────────────────

interface ImportAPUModalProps {
  projectId: string;
  language: Locale;
  sections: string[];
  rowCount: number;
  onSaved: (row: BudgetRow) => void;
  onClose: () => void;
}

function ImportAPUModal({ projectId, language, sections, rowCount, onSaved, onClose }: ImportAPUModalProps) {
  const supabase = createClient();
  const [apuItems, setApuItems] = useState<ApuItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [query, setQuery]       = useState("");
  const [section, setSection]   = useState(sections[0] ?? "");
  const [newSec, setNewSec]     = useState("");
  const [importing, setImporting] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("apu_items")
      .select("*")
      .eq("project_id", projectId)
      .order("code")
      .then(({ data }) => { setApuItems((data as ApuItem[]) ?? []); setLoading(false); });
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const effectiveSec = section === "__new__" ? newSec.trim() : section.trim();

  const filtered = apuItems.filter(
    (a) =>
      a.description.toLowerCase().includes(query.toLowerCase()) ||
      a.code.toLowerCase().includes(query.toLowerCase())
  );

  async function handleImport(apu: ApuItem) {
    if (!effectiveSec) return;
    setImporting(apu.id);
    const payload: BudgetRowInsert = {
      project_id:  projectId,
      apu_item_id: apu.id,
      section:     effectiveSec,
      code:        apu.code,
      description: apu.description,
      unit:        apu.unit,
      quantity:    0,
      unit_price:  apu.selling_price,
      status:      "pending",
      sort_order:  rowCount,
    };
    const { data, error } = await supabase.from("budget_rows").insert(payload).select().single();
    setImporting(null);
    if (!error && data) { onSaved(data as BudgetRow); onClose(); }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full flex flex-col"
        style={{
          maxWidth: 560, maxHeight: "85vh",
          background: CS.surface, border: `1px solid ${CS.border}`,
          borderRadius: 16, overflow: "hidden",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: `1px solid ${CS.border}` }}>
          <div className="flex items-center gap-2">
            <Import className="h-4 w-4" style={{ color: CS.accent }} />
            <span className="font-syne font-bold text-base" style={{ color: CS.text }}>
              {language === "es" ? "Importar desde APU" : "Import from APU"}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label={language === "es" ? "Cerrar" : "Close"}
            style={{ background: "none", border: "none", cursor: "pointer", color: CS.muted }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Section selector */}
        <div className="px-5 py-3 shrink-0" style={{ borderBottom: `1px solid ${CS.border}` }}>
          <label style={{ ...LBL, marginBottom: 6 }}>
            {language === "es" ? "Insertar en sección:" : "Insert into section:"}
          </label>
          <div className="flex gap-2">
            <select
              style={{ ...FIELD, flex: 1 }}
              value={section}
              onChange={(e) => setSection(e.target.value)}
            >
              {sections.map((s) => <option key={s} value={s}>{s}</option>)}
              <option value="__new__">{language === "es" ? "+ Nueva sección..." : "+ New section..."}</option>
            </select>
            {section === "__new__" && (
              <input
                style={{ ...FIELD, flex: 1 }}
                value={newSec}
                onChange={(e) => setNewSec(e.target.value)}
                placeholder="01 · TRABAJOS PRELIMINARES"
                autoFocus
              />
            )}
          </div>
        </div>

        {/* Search */}
        <div
          className="flex items-center gap-2 px-4 py-2.5 shrink-0"
          style={{ borderBottom: `1px solid ${CS.border}`, background: "rgba(255,255,255,0.02)" }}
        >
          <Search className="h-3.5 w-3.5 shrink-0" style={{ color: CS.muted }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={language === "es" ? "Buscar concepto o código..." : "Search description or code..."}
            className="flex-1 bg-transparent text-sm font-dm-sans outline-none"
            style={{ color: CS.text }}
          />
        </div>

        {/* APU list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: CS.muted }} />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center py-10 text-sm font-dm-sans" style={{ color: CS.muted }}>
              {apuItems.length === 0
                ? (language === "es" ? "No hay APUs en este proyecto." : "No APUs in this project.")
                : (language === "es" ? "Sin resultados." : "No results.")}
            </p>
          ) : (
            <table className="w-full text-sm font-dm-sans">
              <thead className="sticky top-0" style={{ background: CS.surface }}>
                <tr style={{ borderBottom: `1px solid ${CS.border}` }}>
                  <th className="text-left px-4 py-2 text-xs font-semibold" style={{ color: CS.muted, width: 70 }}>
                    {language === "es" ? "Código" : "Code"}
                  </th>
                  <th className="text-left px-2 py-2 text-xs font-semibold" style={{ color: CS.muted }}>
                    {language === "es" ? "Descripción" : "Description"}
                  </th>
                  <th className="text-left px-2 py-2 text-xs font-semibold w-16" style={{ color: CS.muted }}>
                    {language === "es" ? "Unidad" : "Unit"}
                  </th>
                  <th className="text-right px-4 py-2 text-xs font-semibold w-28" style={{ color: CS.muted }}>
                    P. Venta
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((apu) => (
                  <tr
                    key={apu.id}
                    className="group cursor-pointer"
                    style={{ borderBottom: `1px solid ${CS.border}` }}
                    onClick={() => handleImport(apu)}
                  >
                    <td className="px-4 py-2.5">
                      <code className="text-xs font-mono" style={{ color: CS.accent }}>{apu.code}</code>
                    </td>
                    <td className="px-2 py-2.5" style={{ color: CS.text }}>
                      {importing === apu.id ? (
                        <span className="flex items-center gap-1.5" style={{ color: CS.accent }}>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {language === "es" ? "Insertando..." : "Inserting..."}
                        </span>
                      ) : apu.description}
                    </td>
                    <td className="px-2 py-2.5" style={{ color: CS.muted }}>{apu.unit}</td>
                    <td className="px-4 py-2.5 text-right font-semibold" style={{ color: CS.accent }}>
                      {apu.selling_price.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div
          className="px-4 py-2.5 text-xs font-dm-sans shrink-0"
          style={{ color: CS.muted, borderTop: `1px solid ${CS.border}`, background: "rgba(255,255,255,0.02)" }}
        >
          {language === "es"
            ? "Haz clic en un APU para insertarlo como partida. La cantidad quedará en 0 para que la ajustes."
            : "Click an APU to insert it as a row. Quantity will be 0 — adjust it after insertion."}
        </div>
      </div>
    </div>
  );
}

// ─── Main BudgetTab ───────────────────────────────────────────────────────────

interface BudgetTabProps {
  initialRows: BudgetRow[];
}

export default function BudgetTab({ initialRows }: BudgetTabProps) {
  const { projectId, language, fmt } = useWorkspace();
  const { toast } = useToast();
  const supabase = createClient();

  const [rows, setRows]             = useState<BudgetRow[]>(initialRows);
  const [showAdd, setShowAdd]       = useState(false);
  const [showImport, setShowImport] = useState(false);

  const sections = Array.from(new Set(rows.map((r) => r.section)));
  const grandTotal = rows.reduce((s, r) => s + (r.total ?? r.quantity * r.unit_price), 0);

  // ── Supabase Realtime ──────────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`budget:${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "budget_rows",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newRow = payload.new as BudgetRow;
            setRows((prev) => {
              if (prev.some((r) => r.id === newRow.id)) return prev;
              toast(language === "es" ? "Nueva partida recibida en tiempo real" : "New row received in real time", "info");
              return [...prev, newRow].sort((a, b) => a.sort_order - b.sort_order);
            });
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as BudgetRow;
            setRows((prev) => {
              const next = prev.map((r) => (r.id === updated.id ? updated : r));
              // Only toast if something actually changed
              const old = prev.find((r) => r.id === updated.id);
              if (old && (old.quantity !== updated.quantity || old.unit_price !== updated.unit_price || old.status !== updated.status)) {
                toast(language === "es" ? "Fila actualizada en tiempo real" : "Row updated in real time", "info");
              }
              return next;
            });
          } else if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as { id: string }).id;
            setRows((prev) => prev.filter((r) => r.id !== deletedId));
            toast(language === "es" ? "Partida eliminada en tiempo real" : "Row deleted in real time", "info");
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [projectId, language]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Inline save ────────────────────────────────────────────────────────────
  const handleCellSave = useCallback(
    async (rowId: string, field: EditableField, rawVal: string) => {
      let patch: BudgetRowUpdate = {};
      if (field === "quantity")   patch = { quantity: parseFloat(rawVal) || 0 };
      if (field === "unit_price") patch = { unit_price: parseFloat(rawVal) || 0 };
      if (field === "status")     patch = { status: rawVal as StatusKey };
      if (field === "assignee")   patch = { assignee: rawVal.trim() || null };

      // Optimistic update
      setRows((prev) =>
        prev.map((r) => {
          if (r.id !== rowId) return r;
          const next = { ...r, ...patch };
          // recalculate total locally (generated col)
          next.total = next.quantity * next.unit_price;
          return next;
        })
      );

      await supabase.from("budget_rows").update(patch).eq("id", rowId);
    },
    [supabase]
  );

  // ── Delete row ─────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    await supabase.from("budget_rows").delete().eq("id", id);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const lang = language as Locale;
  const colLabels = {
    num:        "#",
    code:       lang === "es" ? "Código"        : "Code",
    desc:       lang === "es" ? "Descripción"   : "Description",
    unit:       lang === "es" ? "Unidad"        : "Unit",
    qty:        lang === "es" ? "Cantidad"      : "Qty",
    unitPrice:  lang === "es" ? "Precio Unit."  : "Unit Price",
    total:      lang === "es" ? "Total"         : "Total",
    status:     lang === "es" ? "Estatus"       : "Status",
    assignee:   lang === "es" ? "Responsable"   : "Assignee",
    actions:    "",
  };

  const thStyle: React.CSSProperties = {
    padding: "8px 10px",
    textAlign: "left",
    fontSize: "0.7rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: CS.muted,
    background: "rgba(255,255,255,0.03)",
    borderBottom: `1px solid ${CS.border}`,
    whiteSpace: "nowrap",
  };

  let globalRowNum = 0;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-syne font-bold text-lg" style={{ color: CS.text }}>
            {lang === "es" ? "Presupuesto de Obra" : "Construction Budget"}
          </h2>
          <p className="text-xs font-dm-sans mt-0.5" style={{ color: CS.muted }}>
            {rows.length} {lang === "es" ? "partidas" : "rows"} ·{" "}
            {sections.length} {lang === "es" ? "secciones" : "sections"}
            <span
              className="ml-2 text-[10px] rounded-full px-1.5 py-px"
              style={{ background: "rgba(96,165,250,0.12)", color: "#60a5fa" }}
            >
              {lang === "es" ? "Doble clic para editar" : "Double-click to edit"}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* PDF */}
          <PDFExportButton type="budget" disabled={rows.length === 0} />
          {/* Import APU */}
          <button
            type="button"
            onClick={() => setShowImport(true)}
            aria-label={lang === "es" ? "Importar desde APU" : "Import from APU"}
            className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-sm font-medium font-dm-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cs-accent)]"
            style={{
              border: `1px solid ${CS.border}`,
              background: "transparent",
              color: CS.muted,
              cursor: "pointer",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = CS.text)}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = CS.muted)}
          >
            <Import className="h-4 w-4" aria-hidden="true" />
            {lang === "es" ? "Importar APU" : "Import APU"}
          </button>
          {/* Add */}
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            aria-label={lang === "es" ? "Agregar partida" : "Add budget row"}
            className="flex items-center gap-2 px-3 py-2 rounded-[10px] text-sm font-semibold font-dm-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cs-accent)]"
            style={{ background: CS.accent, color: "#fff", border: "none", cursor: "pointer" }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {lang === "es" ? "+ Agregar" : "+ Add Item"}
          </button>
        </div>
      </div>

      {/* ── Empty state ────────────────────────────────────── */}
      {rows.length === 0 && (
        <div
          className="flex flex-col items-center justify-center py-20 rounded-[10px] text-center gap-4"
          style={{ border: `1.5px dashed ${CS.border}` }}
        >
          <p className="font-syne font-bold text-base" style={{ color: CS.text }}>
            {lang === "es" ? "Sin partidas presupuestales" : "No budget rows yet"}
          </p>
          <p className="text-sm font-dm-sans max-w-xs" style={{ color: CS.muted }}>
            {lang === "es"
              ? "Agrega partidas manualmente o importa desde los APUs del proyecto."
              : "Add rows manually or import from the project's APU items."}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-semibold font-dm-sans"
              style={{ background: CS.accent, color: "#fff", border: "none", cursor: "pointer" }}
            >
              <Plus className="h-4 w-4" />
              {lang === "es" ? "Agregar Partida" : "Add Row"}
            </button>
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-medium font-dm-sans"
              style={{ border: `1px solid ${CS.border}`, background: "transparent", color: CS.muted, cursor: "pointer" }}
            >
              <Import className="h-4 w-4" />
              {lang === "es" ? "Importar APU" : "Import APU"}
            </button>
          </div>
        </div>
      )}

      {/* ── Budget table ───────────────────────────────────── */}
      {rows.length > 0 && (
        <div
          className="rounded-[10px] overflow-hidden"
          style={{ border: `1px solid ${CS.border}` }}
        >
          <div className="overflow-x-auto">
            <table className="w-full font-dm-sans" style={{ minWidth: 860 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 36, textAlign: "center" }}>{colLabels.num}</th>
                  <th style={{ ...thStyle, width: 70 }}>{colLabels.code}</th>
                  <th style={{ ...thStyle }}>{colLabels.desc}</th>
                  <th style={{ ...thStyle, width: 60 }}>{colLabels.unit}</th>
                  <th style={{ ...thStyle, textAlign: "right", width: 80 }}>{colLabels.qty}</th>
                  <th style={{ ...thStyle, textAlign: "right", width: 110 }}>{colLabels.unitPrice}</th>
                  <th style={{ ...thStyle, textAlign: "right", width: 110 }}>{colLabels.total}</th>
                  <th style={{ ...thStyle, width: 100 }}>{colLabels.status}</th>
                  <th style={{ ...thStyle, width: 110 }}>{colLabels.assignee}</th>
                  <th style={{ ...thStyle, width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {sections.map((sec) => {
                  const secRows = rows.filter((r) => r.section === sec);
                  const secTotal = secRows.reduce((s, r) => s + (r.total ?? r.quantity * r.unit_price), 0);

                  return (
                    <Fragment key={sec}>
                      {/* Section header row */}
                      <tr>
                        <td
                          colSpan={10}
                          style={{
                            padding: "7px 12px",
                            background: "rgba(249,115,22,0.07)",
                            borderTop: `2px solid rgba(249,115,22,0.25)`,
                            borderBottom: `1px solid rgba(249,115,22,0.15)`,
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className="font-syne font-bold text-xs uppercase tracking-wider"
                              style={{ color: CS.accent }}
                            >
                              {sec}
                            </span>
                            <span
                              className="text-xs font-semibold font-dm-sans"
                              style={{ color: CS.accent }}
                            >
                              {fmt(secTotal)}
                            </span>
                          </div>
                        </td>
                      </tr>

                      {/* Data rows */}
                      {secRows.map((row) => {
                        globalRowNum++;
                        const rowTotal = row.total ?? row.quantity * row.unit_price;
                        const isEven = globalRowNum % 2 === 0;

                        return (
                          <tr
                            key={row.id}

                            className="group"
                            style={{
                              borderBottom: `1px solid ${CS.border}`,
                              background: isEven ? "rgba(255,255,255,0.015)" : "transparent",
                            }}
                          >
                            {/* # */}
                            <td
                              style={{
                                padding: "7px 10px",
                                textAlign: "center",
                                fontSize: "0.7rem",
                                color: CS.muted,
                              }}
                            >
                              {globalRowNum}
                            </td>

                            {/* Code */}
                            <td style={{ padding: "7px 10px" }}>
                              <code className="text-xs font-mono" style={{ color: CS.accent }}>
                                {row.code}
                              </code>
                            </td>

                            {/* Description (not inline-editable — too wide) */}
                            <td
                              style={{ padding: "7px 10px", color: CS.text, fontSize: "0.8125rem" }}
                            >
                              {row.description}
                              {row.apu_item_id && (
                                <span
                                  className="ml-1.5 text-[10px] rounded-full px-1.5 py-px"
                                  style={{ background: "rgba(96,165,250,0.1)", color: "#60a5fa" }}
                                >
                                  APU
                                </span>
                              )}
                            </td>

                            {/* Unit */}
                            <td style={{ padding: "7px 10px", color: CS.muted, fontSize: "0.8125rem" }}>
                              {row.unit}
                            </td>

                            {/* Quantity — inline editable */}
                            <td style={{ padding: "7px 10px", textAlign: "right" }}>
                              <InlineCell
                                field="quantity"
                                rawValue={String(row.quantity)}
                                displayValue={
                                  <span style={{ fontSize: "0.8125rem", color: CS.text }}>
                                    {row.quantity.toLocaleString()}
                                  </span>
                                }
                                onSave={(v) => handleCellSave(row.id, "quantity", v)}
                              />
                            </td>

                            {/* Unit Price — inline editable */}
                            <td style={{ padding: "7px 10px", textAlign: "right" }}>
                              <InlineCell
                                field="unit_price"
                                rawValue={String(row.unit_price)}
                                displayValue={
                                  <span style={{ fontSize: "0.8125rem", color: CS.text }}>
                                    {fmt(row.unit_price)}
                                  </span>
                                }
                                onSave={(v) => handleCellSave(row.id, "unit_price", v)}
                              />
                            </td>

                            {/* Total — computed, not editable */}
                            <td style={{ padding: "7px 10px", textAlign: "right" }}>
                              <span
                                className="font-semibold"
                                style={{ fontSize: "0.8125rem", color: rowTotal > 0 ? CS.text : CS.muted }}
                              >
                                {fmt(rowTotal)}
                              </span>
                            </td>

                            {/* Status — inline editable */}
                            <td style={{ padding: "6px 10px" }}>
                              <InlineCell
                                field="status"
                                rawValue={row.status}
                                displayValue={<StatusPill status={row.status as StatusKey} language={lang} />}
                                onSave={(v) => handleCellSave(row.id, "status", v)}
                              />
                            </td>

                            {/* Assignee — inline editable */}
                            <td style={{ padding: "7px 10px" }}>
                              <InlineCell
                                field="assignee"
                                rawValue={row.assignee ?? ""}
                                displayValue={
                                  <span style={{ fontSize: "0.8125rem", color: row.assignee ? CS.text : CS.muted }}>
                                    {row.assignee || "—"}
                                  </span>
                                }
                                onSave={(v) => handleCellSave(row.id, "assignee", v)}
                              />
                            </td>

                            {/* Delete */}
                            <td style={{ padding: "7px 8px" }}>
                              <button
                                type="button"
                                onClick={() => handleDelete(row.id)}
                                aria-label={lang === "es" ? "Eliminar partida" : "Delete row"}
                                className="flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ef4444]"
                                style={{
                                  width: 26, height: 26,
                                  background: "none", border: "none",
                                  cursor: "pointer", color: "#ef4444",
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tbody>

              {/* Grand total row */}
              <tfoot>
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      padding: "10px 12px",
                      textAlign: "right",
                      fontFamily: "var(--font-dm-sans)",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      color: CS.muted,
                      background: "rgba(249,115,22,0.05)",
                      borderTop: `1px solid rgba(249,115,22,0.2)`,
                    }}
                  >
                    {lang === "es" ? "TOTAL DEL PRESUPUESTO" : "BUDGET TOTAL"}
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",
                      textAlign: "right",
                      background: "rgba(249,115,22,0.05)",
                      borderTop: `1px solid rgba(249,115,22,0.2)`,
                    }}
                  >
                    <span
                      className="font-syne font-bold text-lg"
                      style={{ color: CS.accent }}
                    >
                      {fmt(grandTotal)}
                    </span>
                  </td>
                  <td
                    colSpan={3}
                    style={{
                      background: "rgba(249,115,22,0.05)",
                      borderTop: `1px solid rgba(249,115,22,0.2)`,
                    }}
                  />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────── */}
      {showAdd && (
        <AddItemModal
          projectId={projectId}
          language={lang}
          sections={sections.length > 0 ? sections : []}
          rowCount={rows.length}
          onSaved={(row) => setRows((p) => [...p, row])}
          onClose={() => setShowAdd(false)}
        />
      )}

      {showImport && (
        <ImportAPUModal
          projectId={projectId}
          language={lang}
          sections={sections.length > 0 ? sections : []}
          rowCount={rows.length}
          onSaved={(row) => setRows((p) => [...p, row])}
          onClose={() => setShowImport(false)}
        />
      )}

    </div>
  );
}
