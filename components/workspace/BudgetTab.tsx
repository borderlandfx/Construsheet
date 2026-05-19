"use client";

import {
  useState, useEffect, useRef, useCallback, useMemo, Fragment,
} from "react";
import {
  Plus, Trash2, Loader2, X, Search, Import, BookOpen,
  Copy, ClipboardPaste, Pencil, CheckSquare, GripVertical, Download,
  FileText, Filter, ArrowDownToLine, TableIcon,
} from "lucide-react";
import {
  ToolbarPortal, ToolbarGroup, ToolbarSep,
  TBtn, TBtnPrimary,
} from "@/components/workspace/ContextualToolbar";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  MATERIALS_DB, CATEGORY_LABELS,
  type MaterialCategory, type MaterialEntry,
} from "@/lib/data/materials-db";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/context/WorkspaceContext";
import { useToast } from "@/lib/context/ToastContext";
import { t } from "@/lib/utils/i18n";
import type {
  BudgetRow, BudgetRowInsert, ApuItem, ApuLineItem,
} from "@/lib/types/database.types";
import type { Locale } from "@/lib/utils/i18n";
import { calcCostsDetailed, type EditorDraft } from "@/components/workspace/APUTab";
import APULibraryModal from "@/components/workspace/APULibraryModal";

// ─── Design tokens ────────────────────────────────────────────────────────────

const CS = {
  surface:  "var(--cs-surface)",
  border:   "var(--cs-border)",
  accent:   "var(--cs-accent)",
  text:     "var(--cs-text)",
  muted:    "var(--cs-muted)",
  bg:       "var(--cs-bg)",
} as const;

// ─── Status pill ──────────────────────────────────────────────────────────────

const STATUS_CFG = {
  pending:     { label: { es: "Pendiente",   en: "Pending"      }, bg: "rgba(59,130,246,0.2)",  color: "#60a5fa" },
  "in-review": { label: { es: "En revisión", en: "Under Review" }, bg: "rgba(245,158,11,0.2)", color: "#f59e0b" },
  approved:    { label: { es: "Aprobado",    en: "Approved"     }, bg: "rgba(16,185,129,0.2)",  color: "#10b981" },
} as const;
type StatusKey = keyof typeof STATUS_CFG;

function StatusPill({ status, language }: { status: StatusKey; language: Locale }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.pending;
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium font-dm-sans whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.label[language]}
    </span>
  );
}

// ─── Assignee avatar ──────────────────────────────────────────────────────────

const AVATAR_PALETTE = ["#f97316","#22c55e","#3b82f6","#a855f7","#ec4899","#14b8a6","#eab308","#ef4444"];
function nameToColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h * 31) + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}
function AssigneeAvatar({ name }: { name: string | null }) {
  if (!name) return <span style={{ color: CS.muted, fontSize: "0.8125rem" }}>—</span>;
  const color = nameToColor(name);
  const initials = name.trim().split(/\s+/).map((w) => w[0]?.toUpperCase() ?? "").slice(0, 2).join("");
  return (
    <span title={name} className="inline-flex items-center justify-center shrink-0"
      style={{ width: 24, height: 24, borderRadius: "50%", background: `${color}28`, border: `1px solid ${color}55`, color, fontSize: "0.6rem", fontWeight: 700, fontFamily: "var(--font-dm-sans)", letterSpacing: 0 }}>
      {initials}
    </span>
  );
}

// ─── Safe formula evaluator ──────────────────────────────────────────────────

function safeEval(expr: string): number | null {
  const cleaned = expr.replace(/×/g, "*").replace(/÷/g, "/").replace(/,/g, ".").trim();
  if (!/^[\d\s+\-*/^.()\n]+$/.test(cleaned)) return null;
  if (cleaned === "" || cleaned === "0") return 0;
  try {
    const result = new Function(`"use strict"; return (${cleaned})`)() as unknown;
    if (typeof result !== "number" || !isFinite(result) || result < 0) return null;
    return Math.round(result * 1000) / 1000;
  } catch { return null; }
}

// ─── Inline-editable cell ─────────────────────────────────────────────────────

type EditableField = "code" | "description" | "unit" | "quantity" | "unit_price" | "status" | "assignee";

const STATUS_CYCLE: StatusKey[] = ["pending", "in-review", "approved"];

function InlineCell({ field, displayValue, rawValue, onSave }:
  { field: EditableField; displayValue: React.ReactNode; rawValue: string; onSave: (v: string) => void }
) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(rawValue);
  const [preview, setPreview] = useState<number | null>(null);
  const ref = useRef<HTMLInputElement & HTMLSelectElement>(null);

  const isNumericFormula = field === "quantity";
  const isClickToEdit = field === "quantity" || field === "unit_price" || field === "description";
  const isStatusCycle = field === "status";

  function commit() {
    if (isNumericFormula) {
      const evaled = safeEval(draft);
      onSave(evaled !== null ? String(evaled) : (parseFloat(draft) || 0).toString());
    } else {
      onSave(draft);
    }
    setEditing(false);
    setPreview(null);
  }
  function startEdit(e?: React.MouseEvent) {
    e?.stopPropagation();
    setDraft(rawValue);
    setPreview(null);
    setEditing(true);
    setTimeout(() => { ref.current?.focus(); ref.current?.select(); }, 0);
  }
  function cycleStatus(e: React.MouseEvent) {
    e.stopPropagation();
    const curIdx = STATUS_CYCLE.indexOf(rawValue as StatusKey);
    const nextStatus = STATUS_CYCLE[(curIdx + 1) % STATUS_CYCLE.length];
    onSave(nextStatus);
  }

  const inputBase: React.CSSProperties = {
    background: "rgba(255,255,255,0.08)", border: `1.5px solid ${CS.accent}`,
    borderRadius: 4, color: CS.text, fontFamily: "var(--font-dm-sans)",
    fontSize: "0.8125rem", outline: "none", width: "100%", padding: "2px 6px",
    boxShadow: `0 0 0 2px rgba(249,115,22,0.15)`,
  };

  // Status: click to cycle, no edit mode
  if (isStatusCycle) {
    return <span onClick={cycleStatus} title="Click to cycle status"
      style={{ cursor: "pointer", minWidth: 20, display: "inline-block" }}>{displayValue}</span>;
  }
  if (editing && isNumericFormula) {
    const isFormula = /[+\-*/×÷(]/.test(draft);
    return (
      <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
        <input
          ref={ref as React.RefObject<HTMLInputElement>}
          value={draft}
          type="text"
          inputMode="decimal"
          onChange={(e) => { setDraft(e.target.value); setPreview(safeEval(e.target.value)); }}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          style={inputBase}
          placeholder="ej: 5×3"
          title="Soporta fórmulas: 5×4×3"
        />
        {isFormula && preview !== null && (
          <span style={{
            position: "absolute", right: 2, top: "50%", transform: "translateY(-50%)",
            fontSize: "0.65rem", fontWeight: 700, color: CS.accent,
            pointerEvents: "none", whiteSpace: "nowrap",
          }}>
            ={preview}
          </span>
        )}
      </div>
    );
  }
  if (editing) {
    return <div onClick={(e) => e.stopPropagation()}>
      <input ref={ref as React.RefObject<HTMLInputElement>} value={draft}
        type={field === "unit_price" ? "number" : "text"} min={0} step="any"
        onChange={(e) => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        style={inputBase} />
    </div>;
  }
  if (isClickToEdit) {
    return <span onClick={startEdit} title="Click to edit"
      style={{ cursor: "pointer", minWidth: 20, display: "inline-block", borderRadius: 3,
        padding: "1px 3px", margin: "-1px -3px", transition: "background 150ms ease" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>{displayValue}</span>;
  }
  return <span onDoubleClick={startEdit} title="Double-click to edit"
    style={{ cursor: "default", minWidth: 20, display: "inline-block" }}>{displayValue}</span>;
}

// ─── Add Item Modal ───────────────────────────────────────────────────────────

const FIELD: React.CSSProperties = {
  width: "100%", padding: "0.4rem 0.6rem", borderRadius: 8,
  border: `1px solid ${CS.border}`, background: "rgba(255,255,255,0.04)",
  color: CS.text, fontSize: "0.8125rem", fontFamily: "var(--font-dm-sans)", outline: "none",
};
const LBL: React.CSSProperties = {
  display: "block", fontSize: "0.75rem", fontWeight: 500, color: CS.muted,
  fontFamily: "var(--font-dm-sans)", marginBottom: 4,
};

function AddItemModal({ projectId, language, sections, rowCount, fmt, prefill, onSaved, onClose }:
  { projectId: string; language: Locale; sections: string[]; rowCount: number;
    fmt: (n: number) => string;
    prefill?: { name: string; unit: string; unit_price: number };
    onSaved: (row: BudgetRow) => void; onClose: () => void }
) {
  const supabase = createClient();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [section, setSection] = useState(sections.length > 0 ? sections[0] : "__new__");
  const [newSec, setNewSec] = useState("");
  const [code, setCode] = useState("");
  const [description, setDesc] = useState(prefill?.name ?? "");
  const [unit, setUnit] = useState(prefill?.unit ?? "");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState(prefill ? String(prefill.unit_price) : "");
  const [status, setStatus] = useState<StatusKey>("pending");
  const [assignee, setAssignee] = useState("");
  const descRef = useRef<HTMLInputElement>(null);

  const effectiveSec = section === "__new__" ? newSec.trim() : section.trim();

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function resetFields(keepSection: boolean) {
    setCode("");
    setDesc("");
    setUnit("");
    setQuantity("");
    setUnitPrice("");
    setStatus("pending");
    setAssignee("");
    if (!keepSection) setNewSec("");
    setTimeout(() => descRef.current?.focus(), 50);
  }

  async function handleSave(andAnother = false) {
    if (!effectiveSec || !description.trim()) return;
    setSaving(true);
    try {
      const payload: BudgetRowInsert = {
        project_id: projectId, section: effectiveSec,
        description: description.trim(), code: code.trim() || null,
        unit: unit.trim() || null, quantity: parseFloat(quantity) || 0,
        unit_price: parseFloat(unitPrice) || 0, status, assignee: assignee.trim() || null,
        sort_order: rowCount + savedCount,
      };
      const { data, error } = await supabase.from("budget_rows").insert(payload).select().single();
      if (error) {
        toast(language === "es" ? `Error: ${error.message}` : `Error: ${error.message}`, "error");
        setSaving(false);
        return;
      }
      if (data) {
        onSaved(data as BudgetRow);
        toast(
          language === "es" ? "Partida guardada correctamente" : "Budget row saved successfully",
          "success"
        );
        if (andAnother) {
          setSavedCount((c) => c + 1);
          resetFields(true);
        } else {
          onClose();
        }
      }
    } catch {
      toast(language === "es" ? "Error inesperado al guardar" : "Unexpected error while saving", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full flex flex-col gap-4 overflow-y-auto"
        style={{ maxWidth: 540, maxHeight: "90vh", background: CS.surface, border: `1px solid ${CS.border}`, borderRadius: 16, padding: "1.5rem", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}>
        <div className="flex items-center justify-between shrink-0">
          <div>
            <span className="font-syne font-bold text-base" style={{ color: CS.text }}>{language === "es" ? "Nueva Partida" : "New Budget Row"}</span>
            {savedCount > 0 && (
              <span className="ml-2 text-xs font-dm-sans rounded-full px-2 py-0.5" style={{ background: "rgba(249,115,22,0.12)", color: CS.accent }}>
                {savedCount} {language === "es" ? "guardada(s)" : "saved"}
              </span>
            )}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: CS.muted }}><X className="h-4 w-4" /></button>
        </div>
        <div>
          <label style={LBL}>{language === "es" ? "Capítulo *" : "Chapter *"}</label>
          {section === "__new__" ? (
            <div className="flex items-center gap-2">
              <input style={{ ...FIELD, flex: 1 }} value={newSec} onChange={(e) => setNewSec(e.target.value)} placeholder={language === "es" ? "ej. 01 · TRABAJOS PRELIMINARES" : "e.g. 01 · PRELIMINARY WORKS"} autoFocus />
              {sections.length > 0 && (
                <button onClick={() => { setSection(sections[0]); setNewSec(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: CS.accent, fontSize: "0.75rem", fontFamily: "var(--font-dm-sans)", whiteSpace: "nowrap" }}>← {language === "es" ? "volver" : "back"}</button>
              )}
            </div>
          ) : (
            <select style={FIELD} value={section} onChange={(e) => setSection(e.target.value)}>
              {sections.map((s) => <option key={s} value={s}>{s}</option>)}
              <option value="__new__">{language === "es" ? "+ Nuevo capítulo..." : "+ New chapter..."}</option>
            </select>
          )}
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div><label style={LBL}>{language === "es" ? "Código" : "Code"}</label><input style={FIELD} value={code} onChange={(e) => setCode(e.target.value)} placeholder="01.01" /></div>
          <div className="col-span-3"><label style={LBL}>{language === "es" ? "Descripción *" : "Description *"}</label><input ref={descRef} style={FIELD} value={description} onChange={(e) => setDesc(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) handleSave(true); }} /></div>
          <div><label style={LBL}>{language === "es" ? "Unidad" : "Unit"}</label><input style={FIELD} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="m²" /></div>
          <div><label style={LBL}>{language === "es" ? "Cantidad" : "Qty"}</label><input style={FIELD} type="number" min={0} step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div>
          <div><label style={LBL}>{language === "es" ? "P.U." : "Unit Price"}</label><input style={FIELD} type="number" min={0} step="any" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} /></div>
          <div>
            <label style={LBL}>{language === "es" ? "Estatus" : "Status"}</label>
            <select style={FIELD} value={status} onChange={(e) => setStatus(e.target.value as StatusKey)}>
              <option value="pending">{language === "es" ? "Pendiente" : "Pending"}</option>
              <option value="in-review">{language === "es" ? "En revisión" : "Under Review"}</option>
              <option value="approved">{language === "es" ? "Aprobado" : "Approved"}</option>
            </select>
          </div>
          <div className="col-span-2"><label style={LBL}>{language === "es" ? "Responsable" : "Assignee"}</label><input style={FIELD} value={assignee} onChange={(e) => setAssignee(e.target.value)} /></div>
        </div>
        {quantity && unitPrice && (
          <p className="text-xs font-dm-sans text-right" style={{ color: CS.muted }}>
            {language === "es" ? "Total estimado: " : "Estimated total: "}<strong style={{ color: CS.accent }}>{fmt(parseFloat(quantity) * parseFloat(unitPrice))}</strong>
          </p>
        )}
        <div className="flex gap-2 justify-end shrink-0 flex-wrap">
          <button onClick={onClose} className="px-4 py-2 rounded-[10px] text-sm font-medium font-dm-sans"
            style={{ border: `1px solid ${CS.border}`, background: "transparent", color: CS.muted, cursor: "pointer" }}>{t("cancel", language)}</button>
          <button onClick={() => handleSave(true)} disabled={saving || !effectiveSec || !description.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-medium font-dm-sans"
            title={language === "es" ? "Guardar y agregar otra (Ctrl+Enter)" : "Save and add another (Ctrl+Enter)"}
            style={{ border: `1px solid ${CS.border}`, background: "transparent", color: CS.muted, cursor: saving || !effectiveSec || !description.trim() ? "not-allowed" : "pointer", opacity: saving || !effectiveSec || !description.trim() ? 0.45 : 1 }}
            onMouseEnter={(e) => { if (!saving && effectiveSec && description.trim()) (e.currentTarget as HTMLButtonElement).style.color = CS.text; }}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = CS.muted)}>
            {language === "es" ? "+ Guardar y continuar" : "+ Save & add another"}
          </button>
          <button onClick={() => handleSave(false)} disabled={saving || !effectiveSec || !description.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-semibold font-dm-sans"
            style={{ background: CS.accent, color: "#fff", border: "none", cursor: "pointer", opacity: saving || !effectiveSec || !description.trim() ? 0.6 : 1 }}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{t("save", language)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Activities Modal ─────────────────────────────────────────────────────

interface AddActivitiesModalProps {
  projectId: string;
  language: Locale;
  apuItems: ApuItem[];
  targetSection: string;
  rowCount: number;
  onSaved: (rows: BudgetRow[]) => void;
  onClose: () => void;
  onCreateNew: () => void;
}

function AddActivitiesModal({
  projectId, language, apuItems, targetSection, rowCount, onSaved, onClose, onCreateNew,
}: AddActivitiesModalProps) {
  const supabase = createClient();
  const lang = language;
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addToGroup, setAddToGroup] = useState(true);
  const [customSection, setCustomSection] = useState(targetSection);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filtered = apuItems.filter((a) =>
    a.description.toLowerCase().includes(query.toLowerCase()) ||
    a.code.toLowerCase().includes(query.toLowerCase())
  );

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((a) => a.id)));
  }

  async function handleAccept() {
    if (selected.size === 0) return;
    setSaving(true);
    const section = addToGroup ? customSection : targetSection;
    const selectedApus = apuItems.filter((a) => selected.has(a.id));
    const payloads: BudgetRowInsert[] = selectedApus.map((apu, idx) => ({
      project_id: projectId, apu_item_id: apu.id, section,
      code: apu.code, description: apu.description, unit: apu.unit,
      quantity: 0, unit_price: apu.selling_price, status: "pending",
      sort_order: rowCount + idx,
    }));

    const { data, error } = await supabase.from("budget_rows").insert(payloads).select();
    setSaving(false);
    if (!error && data) { onSaved(data as BudgetRow[]); onClose(); }
  }

  const fmt = (n: number) => n.toLocaleString("es-MX", { minimumFractionDigits: 2 });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex flex-col w-full" style={{
        maxWidth: 640, maxHeight: "88vh",
        background: CS.surface, border: `1px solid ${CS.border}`,
        borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
      }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: `1px solid ${CS.border}` }}>
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4" style={{ color: CS.accent }} />
            <span className="font-syne font-bold text-base" style={{ color: CS.text }}>
              {lang === "es" ? "Agregar Actividades" : "Add Activities"}
            </span>
            {selected.size > 0 && (
              <span className="text-xs font-dm-sans rounded-full px-2 py-0.5" style={{ background: "rgba(249,115,22,0.12)", color: CS.accent }}>
                {selected.size} {lang === "es" ? "seleccionados" : "selected"}
              </span>
            )}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: CS.muted }}><X className="h-4 w-4" /></button>
        </div>

        {/* Target group option */}
        <div className="px-5 py-3 shrink-0" style={{ borderBottom: `1px solid ${CS.border}`, background: "rgba(255,255,255,0.02)" }}>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={addToGroup} onChange={(e) => setAddToGroup(e.target.checked)}
                style={{ accentColor: CS.accent }} />
              <span className="text-xs font-dm-sans" style={{ color: CS.text }}>
                {lang === "es" ? "Agregar automáticamente al grupo:" : "Add automatically to group:"}
              </span>
            </label>
            <input
              value={customSection} onChange={(e) => setCustomSection(e.target.value)}
              disabled={!addToGroup}
              className="text-xs font-dm-sans px-2 py-1 rounded-lg flex-1"
              style={{
                background: "rgba(255,255,255,0.04)", border: `1px solid ${CS.border}`,
                color: addToGroup ? CS.text : CS.muted, outline: "none",
                opacity: addToGroup ? 1 : 0.5, minWidth: 160,
              }}
            />
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 px-4 py-2.5 shrink-0" style={{ borderBottom: `1px solid ${CS.border}`, background: "rgba(255,255,255,0.02)" }}>
          <Search className="h-3.5 w-3.5 shrink-0" style={{ color: CS.muted }} />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={lang === "es" ? "Buscar concepto o código..." : "Search description or code..."}
            className="flex-1 bg-transparent text-sm font-dm-sans outline-none" style={{ color: CS.text }} />
          {query && <button onClick={() => setQuery("")} style={{ background: "none", border: "none", cursor: "pointer", color: CS.muted }}><X className="h-3 w-3" /></button>}
        </div>

        {/* APU list */}
        <div className="flex-1 overflow-y-auto">
          {apuItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <p className="text-sm font-dm-sans" style={{ color: CS.muted }}>
                {lang === "es" ? "No hay APUs en este proyecto." : "No APUs in this project."}
              </p>
              <button onClick={onCreateNew}
                className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-semibold font-dm-sans"
                style={{ background: CS.accent, color: "#fff", border: "none", cursor: "pointer" }}>
                <Plus className="h-4 w-4" />
                {lang === "es" ? "Crear actividad" : "Create activity"}
              </button>
            </div>
          ) : (
            <table className="w-full text-sm font-dm-sans">
              <thead className="sticky top-0" style={{ background: CS.surface }}>
                <tr style={{ borderBottom: `1px solid ${CS.border}` }}>
                  <th className="px-4 py-2 w-10">
                    <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0}
                      onChange={selectAll} style={{ accentColor: CS.accent, cursor: "pointer" }} />
                  </th>
                  <th className="text-left px-2 py-2 text-xs font-semibold w-16" style={{ color: CS.muted }}>{lang === "es" ? "Código" : "Code"}</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold" style={{ color: CS.muted }}>{lang === "es" ? "Descripción" : "Description"}</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold w-14" style={{ color: CS.muted }}>{lang === "es" ? "Unidad" : "Unit"}</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold w-28" style={{ color: CS.muted }}>{lang === "es" ? "Precio Final" : "Final Price"}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((apu) => {
                  const isSelected = selected.has(apu.id);
                  return (
                    <tr key={apu.id} className="cursor-pointer"
                      style={{ borderBottom: `1px solid ${CS.border}`, background: isSelected ? "rgba(249,115,22,0.06)" : undefined }}
                      onClick={() => toggleSelect(apu.id)}>
                      <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(apu.id)}
                          style={{ accentColor: CS.accent, cursor: "pointer" }} />
                      </td>
                      <td className="px-2 py-2.5">
                        <code className="text-xs font-mono" style={{ color: CS.accent }}>{apu.code}</code>
                      </td>
                      <td className="px-2 py-2.5" style={{ color: CS.text }}>{apu.description}</td>
                      <td className="px-2 py-2.5" style={{ color: CS.muted }}>{apu.unit}</td>
                      <td className="px-4 py-2.5 text-right font-semibold" style={{ color: CS.accent }}>{fmt(apu.selling_price)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderTop: `1px solid ${CS.border}`, background: "rgba(255,255,255,0.02)" }}>
          <button onClick={onCreateNew}
            className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-sm font-medium font-dm-sans"
            style={{ border: `1px solid ${CS.border}`, background: "transparent", color: CS.muted, cursor: "pointer" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = CS.text)}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = CS.muted)}>
            <Plus className="h-4 w-4" />
            {lang === "es" ? "Crear actividad" : "Create activity"}
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-[10px] text-sm font-medium font-dm-sans"
              style={{ border: `1px solid ${CS.border}`, background: "transparent", color: CS.muted, cursor: "pointer" }}>
              {t("cancel", lang)}
            </button>
            <button onClick={handleAccept} disabled={saving || selected.size === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-semibold font-dm-sans"
              style={{ background: CS.accent, color: "#fff", border: "none", cursor: selected.size === 0 ? "not-allowed" : "pointer", opacity: selected.size === 0 ? 0.5 : 1 }}>
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {lang === "es" ? `Aceptar (${selected.size})` : `Accept (${selected.size})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Paste Budget Modal ───────────────────────────────────────────────────────

interface PasteBudgetModalProps {
  projectId: string;
  language: Locale;
  sections: string[];
  rowCount: number;
  onSaved: (rows: BudgetRow[]) => void;
  onClose: () => void;
}

function PasteBudgetModal({ projectId, language, sections, rowCount, onSaved, onClose }: PasteBudgetModalProps) {
  const supabase = createClient();
  const [raw, setRaw] = useState("");
  const [hasHeader, setHasHeader] = useState(true);
  const [section, setSection] = useState(sections[0] ?? "");
  const [newSec, setNewSec] = useState("");
  const [saving, setSaving] = useState(false);
  const lang = language;

  const effectiveSec = section === "__new__" ? newSec.trim() : section.trim();

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const parsed = useMemo(() => {
    const lines = raw.trim().split(/\r?\n/).filter((l) => l.trim());
    const skip = hasHeader && lines.length > 1 ? 1 : 0;
    return lines.slice(skip).map((line) => {
      const cols = line.split("\t");
      const rawQty = (cols[2] ?? "").replace(/,/g, ".").trim();
      const rawPU  = (cols[3] ?? "").replace(/,/g, ".").trim();
      return {
        description: cols[0]?.trim() ?? "",
        unit:        cols[1]?.trim() || null,
        quantity:    parseFloat(rawQty) || 0,
        unit_price:  parseFloat(rawPU)  || 0,
        code:        cols[4]?.trim() || null,
      };
    }).filter((r) => r.description);
  }, [raw, hasHeader]);

  async function handleImport() {
    if (!parsed.length || !effectiveSec) return;
    setSaving(true);
    const payloads: BudgetRowInsert[] = parsed.map((row, i) => ({
      project_id:  projectId,
      section:     effectiveSec,
      description: row.description,
      unit:        row.unit,
      quantity:    row.quantity,
      unit_price:  row.unit_price,
      code:        row.code,
      status:      "pending" as const,
      sort_order:  rowCount + i,
    }));
    const { data, error } = await supabase.from("budget_rows").insert(payloads).select();
    setSaving(false);
    if (!error && data) { onSaved(data as BudgetRow[]); onClose(); }
  }

  const preview = parsed.slice(0, 15);
  const grandImportTotal = parsed.reduce((s, r) => s + r.quantity * r.unit_price, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full flex flex-col gap-4"
        style={{
          maxWidth: 660, maxHeight: "90vh",
          background: CS.surface, border: `1px solid ${CS.border}`,
          borderRadius: 16, padding: "1.5rem",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 shrink-0">
          <div>
            <span className="font-syne font-bold text-base" style={{ color: CS.text }}>
              {lang === "es" ? "Pegar partidas desde Excel" : "Paste budget rows from Excel"}
            </span>
            <p className="text-xs font-dm-sans mt-0.5" style={{ color: CS.muted }}>
              {lang === "es"
                ? "Columnas esperadas: Descripción · Unidad · Cantidad · P.U. · Código (opc.)"
                : "Expected columns: Description · Unit · Quantity · Unit Price · Code (opt.)"}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: CS.muted, flexShrink: 0 }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Section selector */}
        <div className="shrink-0">
          <label style={LBL}>{lang === "es" ? "Capítulo destino *" : "Target chapter *"}</label>
          {section === "__new__" ? (
            <div className="flex gap-2 items-center">
              <input
                style={{ ...FIELD, flex: 1 }}
                value={newSec}
                onChange={(e) => setNewSec(e.target.value)}
                placeholder={lang === "es" ? "ej. 01 · TRABAJOS PRELIMINARES" : "e.g. 01 · PRELIMINARY WORKS"}
                autoFocus
              />
              <button onClick={() => { setSection(sections[0] ?? ""); setNewSec(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: CS.accent, fontSize: "0.75rem", fontFamily: "var(--font-dm-sans)", whiteSpace: "nowrap" }}>← {lang === "es" ? "volver" : "back"}</button>
            </div>
          ) : (
            <select
              value={section}
              onChange={(e) => setSection(e.target.value)}
              style={FIELD}
            >
              {sections.map((s) => <option key={s} value={s}>{s}</option>)}
              <option value="__new__">{lang === "es" ? "+ Nuevo capítulo" : "+ New chapter"}</option>
            </select>
          )}
        </div>

        {/* Textarea */}
        <textarea
          autoFocus={sections.length > 0}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={lang === "es" ? "Pega aquí el contenido de Excel (Ctrl+V)…" : "Paste Excel content here (Ctrl+V)…"}
          rows={5}
          style={{
            ...FIELD,
            resize: "vertical",
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "0.75rem",
            lineHeight: 1.6,
            flexShrink: 0,
          }}
        />

        {/* Header-row toggle */}
        <label className="flex items-center gap-2 text-sm font-dm-sans shrink-0" style={{ color: CS.muted, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={hasHeader}
            onChange={(e) => setHasHeader(e.target.checked)}
            style={{ accentColor: CS.accent, cursor: "pointer" }}
          />
          {lang === "es" ? "La primera fila es encabezado (ignorar)" : "First row is a header (skip it)"}
        </label>

        {/* Preview */}
        {parsed.length > 0 && (
          <div className="flex-1 overflow-y-auto min-h-0">
            <p className="text-xs font-dm-sans font-semibold mb-2" style={{ color: CS.muted }}>
              {lang === "es"
                ? `Vista previa — ${parsed.length} partida${parsed.length !== 1 ? "s" : ""} detectada${parsed.length !== 1 ? "s" : ""}:`
                : `Preview — ${parsed.length} row${parsed.length !== 1 ? "s" : ""} detected:`}
            </p>
            <div className="rounded-[8px] overflow-hidden" style={{ border: `1px solid ${CS.border}` }}>
              <table className="w-full text-xs font-dm-sans">
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: `1px solid ${CS.border}` }}>
                    {(["#",
                      lang === "es" ? "Descripción" : "Description",
                      lang === "es" ? "Unidad" : "Unit",
                      lang === "es" ? "Cantidad" : "Qty",
                      lang === "es" ? "P.U." : "Unit Price",
                      "Total",
                    ] as string[]).map((h) => (
                      <th key={h} className="px-3 py-2 text-left"
                        style={{ color: CS.muted, fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => {
                    const rowTotal = row.quantity * row.unit_price;
                    return (
                      <tr key={i} style={{
                        borderBottom: `1px solid ${CS.border}`,
                        background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
                      }}>
                        <td className="px-3 py-1.5" style={{ color: CS.muted, width: 28 }}>{i + 1}</td>
                        <td className="px-3 py-1.5 max-w-[180px]" style={{ color: CS.text }}>
                          <span className="truncate block">{row.description}</span>
                        </td>
                        <td className="px-3 py-1.5" style={{ color: CS.muted }}>{row.unit ?? "—"}</td>
                        <td className="px-3 py-1.5 text-right" style={{ color: CS.text }}>{row.quantity.toLocaleString()}</td>
                        <td className="px-3 py-1.5 text-right" style={{ color: CS.text }}>{row.unit_price.toLocaleString()}</td>
                        <td className="px-3 py-1.5 text-right font-semibold"
                          style={{ color: rowTotal > 0 ? CS.accent : CS.muted }}>
                          {rowTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                  {parsed.length > 15 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-2 text-center"
                        style={{ color: CS.muted, fontSize: "0.7rem" }}>
                        {lang === "es" ? `… y ${parsed.length - 15} más` : `… and ${parsed.length - 15} more`}
                      </td>
                    </tr>
                  )}
                  <tr style={{ background: "rgba(249,115,22,0.04)", borderTop: `1px solid ${CS.border}` }}>
                    <td colSpan={5} className="px-3 py-2 text-right text-xs font-semibold" style={{ color: CS.muted }}>
                      {lang === "es" ? "Total importado:" : "Import total:"}
                    </td>
                    <td className="px-3 py-2 text-right font-syne font-bold text-sm" style={{ color: CS.accent }}>
                      {grandImportTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-2 justify-end shrink-0 pt-1">
          <button onClick={onClose}
            className="px-4 py-2 rounded-[10px] text-sm font-medium font-dm-sans"
            style={{ border: `1px solid ${CS.border}`, background: "transparent", color: CS.muted, cursor: "pointer" }}>
            {t("cancel", lang)}
          </button>
          <button onClick={handleImport} disabled={saving || parsed.length === 0 || !effectiveSec}
            className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-semibold font-dm-sans"
            style={{
              background: CS.accent, color: "#fff", border: "none",
              cursor: saving || parsed.length === 0 || !effectiveSec ? "not-allowed" : "pointer",
              opacity: saving || parsed.length === 0 || !effectiveSec ? 0.5 : 1,
            }}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {lang === "es"
              ? `Importar ${parsed.length} partida${parsed.length !== 1 ? "s" : ""}`
              : `Import ${parsed.length} row${parsed.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Budget Library Modal ─────────────────────────────────────────────────────

function BudgetLibraryModal({ language, onInsert, onClose }:
  { language: Locale; onInsert: (entry: MaterialEntry) => void; onClose: () => void }
) {
  const [tab, setTab] = useState<MaterialCategory>("materials");
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filtered = MATERIALS_DB.filter((e) => e.category === tab && e.name.toLowerCase().includes(query.toLowerCase()));
  const tabs: MaterialCategory[] = ["materials", "labor", "equipment"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex flex-col w-full" style={{ maxWidth: 560, maxHeight: "80vh", background: CS.surface, border: `1px solid ${CS.border}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}>
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: `1px solid ${CS.border}` }}>
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" style={{ color: CS.accent }} />
            <span className="font-syne font-bold text-base" style={{ color: CS.text }}>{language === "es" ? "Base de Precios" : "Price Library"}</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: CS.muted }}><X className="h-4 w-4" /></button>
        </div>
        <div className="flex shrink-0" style={{ borderBottom: `1px solid ${CS.border}` }}>
          {tabs.map((cat) => {
            const cfg = CATEGORY_LABELS[cat]; const active = tab === cat;
            return <button key={cat} onClick={() => setTab(cat)} className="flex-1 py-2.5 text-xs font-semibold font-dm-sans"
              style={{ background: active ? "rgba(255,255,255,0.04)" : "transparent", color: active ? cfg.color : CS.muted, border: "none", borderBottom: active ? `2px solid ${cfg.color}` : "2px solid transparent", cursor: "pointer", marginBottom: -1 }}>
              {language === "es" ? cfg.es : cfg.en}
            </button>;
          })}
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 shrink-0" style={{ borderBottom: `1px solid ${CS.border}`, background: "rgba(255,255,255,0.02)" }}>
          <Search className="h-3.5 w-3.5 shrink-0" style={{ color: CS.muted }} />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={language === "es" ? "Buscar..." : "Search..."}
            className="flex-1 bg-transparent text-sm font-dm-sans outline-none" style={{ color: CS.text }} />
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? <p className="text-center py-10 text-sm font-dm-sans" style={{ color: CS.muted }}>{language === "es" ? "Sin resultados." : "No results."}</p>
            : <table className="w-full text-sm font-dm-sans"><thead className="sticky top-0" style={{ background: CS.surface }}>
              <tr style={{ borderBottom: `1px solid ${CS.border}` }}>
                <th className="text-left px-4 py-2 text-xs font-semibold" style={{ color: CS.muted }}>{language === "es" ? "Concepto" : "Description"}</th>
                <th className="text-left px-2 py-2 text-xs font-semibold w-16" style={{ color: CS.muted }}>{language === "es" ? "Unidad" : "Unit"}</th>
                <th className="text-right px-4 py-2 text-xs font-semibold w-28" style={{ color: CS.muted }}>Precio</th>
              </tr></thead><tbody>{filtered.map((entry) => (
                <tr key={entry.id} className="group cursor-pointer" style={{ borderBottom: `1px solid ${CS.border}` }}
                  onClick={() => { onInsert(entry); onClose(); }}>
                  <td className="px-4 py-2.5 group-hover:text-white transition-colors" style={{ color: CS.text }}>{entry.name}</td>
                  <td className="px-2 py-2.5" style={{ color: CS.muted }}>{entry.unit}</td>
                  <td className="px-4 py-2.5 text-right font-semibold" style={{ color: CS.accent }}>${entry.unit_price.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
                </tr>))}</tbody></table>}
        </div>
      </div>
    </div>
  );
}

// ─── APU Detail Panel ─────────────────────────────────────────────────────────

function APUDetailPanel({ row, apuItem, language, fmt, onClose, onNavigateToImport }:
  { row: BudgetRow; apuItem: ApuItem | null; language: Locale;
    fmt: (n: number) => string; onClose: () => void; onNavigateToImport: () => void }
) {
  const { projectSettings } = useWorkspace();
  const lang = language;

  const SECTION_COLORS: Record<MaterialCategory, string> = {
    materials: "#60a5fa",
    labor: "#4ade80",
    equipment: "#fb923c",
  };

  function SectionTable({ section, rows }: { section: MaterialCategory; rows: ApuLineItem[] }) {
    const cfg = CATEGORY_LABELS[section];
    const color = SECTION_COLORS[section];
    const subtotal = rows.reduce((s, r) => s + r.qty * r.unit_price, 0);
    if (rows.length === 0) return null;
    return (
      <div style={{ marginBottom: "1rem" }}>
        <div className="flex items-center justify-between px-3 py-1.5"
          style={{ borderTop: `2px solid ${color}`, borderBottom: `1px solid ${CS.border}`, background: "rgba(255,255,255,0.02)" }}>
          <span className="text-xs font-semibold font-dm-sans uppercase tracking-wider" style={{ color }}>{lang === "es" ? cfg.es : cfg.en}</span>
          <span className="text-xs font-semibold font-dm-sans" style={{ color: CS.text }}>{fmt(subtotal)}</span>
        </div>
        <table className="w-full text-xs font-dm-sans">
          <thead><tr style={{ borderBottom: `1px solid ${CS.border}` }}>
            <th className="text-left px-3 py-1.5 text-[10px] font-semibold" style={{ color: CS.muted }}>{lang === "es" ? "Concepto" : "Description"}</th>
            <th className="text-center px-2 py-1.5 text-[10px] font-semibold w-10" style={{ color: CS.muted }}>Und.</th>
            <th className="text-right px-2 py-1.5 text-[10px] font-semibold w-12" style={{ color: CS.muted }}>Cant.</th>
            <th className="text-right px-2 py-1.5 text-[10px] font-semibold w-16" style={{ color: CS.muted }}>P.U.</th>
            <th className="text-right px-3 py-1.5 text-[10px] font-semibold w-18" style={{ color: CS.muted }}>Parcial</th>
          </tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${CS.border}`, background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)" }}>
              <td className="px-3 py-1.5" style={{ color: CS.text }}>{r.name}</td>
              <td className="px-2 py-1.5 text-center" style={{ color: CS.muted }}>{r.unit}</td>
              <td className="px-2 py-1.5 text-right" style={{ color: CS.text }}>{r.qty}</td>
              <td className="px-2 py-1.5 text-right" style={{ color: CS.text }}>{fmt(r.unit_price)}</td>
              <td className="px-3 py-1.5 text-right font-semibold" style={{ color: CS.text }}>{fmt(r.qty * r.unit_price)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    );
  }

  function CostRow({ label, pct, value, bold, isAccent, indent }:
    { label: string; pct?: number; value: number; bold?: boolean; isAccent?: boolean; indent?: boolean }
  ) {
    return (
      <div className="flex items-center justify-between py-1"
        style={{ paddingLeft: indent ? 16 : 0, borderBottom: `1px solid ${CS.border}` }}>
        <span className="text-xs font-dm-sans" style={{ color: bold ? CS.text : CS.muted }}>
          {label}{pct !== undefined && pct > 0 ? ` (${pct}%)` : ""}
        </span>
        <span className="text-xs font-dm-sans font-semibold" style={{ color: isAccent ? CS.accent : CS.text, fontWeight: bold ? 700 : 500 }}>
          {fmt(value)}
        </span>
      </div>
    );
  }

  const draft: EditorDraft = apuItem ? {
    id: apuItem.id, code: apuItem.code, description: apuItem.description, unit: apuItem.unit,
    category: apuItem.category ?? null,
    materials: (apuItem.materials as ApuLineItem[]) ?? [],
    labor: (apuItem.labor as ApuLineItem[]) ?? [],
    equipment: (apuItem.equipment as ApuLineItem[]) ?? [],
  } : { id: null, code: "", description: "", unit: "", category: null, materials: [], labor: [], equipment: [] };

  const c = apuItem ? calcCostsDetailed(draft, projectSettings) : null;

  return (
    <div
      className="fixed right-0 z-30 flex flex-col overflow-hidden"
      style={{
        top: 116, // below navbar (56px) + tab bar (60px)
        bottom: 0,
        width: 400,
        background: CS.surface,
        borderLeft: `1px solid ${CS.border}`,
        boxShadow: "-8px 0 32px rgba(0,0,0,0.3)",
      }}
    >
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: `1px solid ${CS.border}`, background: "rgba(255,255,255,0.02)" }}>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-dm-sans font-semibold uppercase tracking-wider mb-0.5" style={{ color: CS.muted }}>
            {lang === "es" ? "Detalle APU" : "APU Detail"}
          </p>
          <p className="text-sm font-dm-sans font-semibold truncate" style={{ color: CS.text }}>
            {row.description}
          </p>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: CS.muted, marginLeft: 12 }}>
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Panel body */}
      <div className="flex-1 overflow-y-auto" style={{ background: CS.bg }}>
        {!apuItem ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center">
            <p className="text-sm font-dm-sans" style={{ color: CS.muted }}>
              {lang === "es"
                ? "No hay APU vinculado a esta partida. Importa uno desde la pestaña APU o crea uno nuevo."
                : "No APU linked to this row. Import one from the APU tab or create a new one."}
            </p>
            <button onClick={onNavigateToImport}
              className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-semibold font-dm-sans"
              style={{ background: CS.accent, color: "#fff", border: "none", cursor: "pointer" }}>
              <Import className="h-4 w-4" />
              {lang === "es" ? "Importar APU" : "Import APU"}
            </button>
          </div>
        ) : (
          <div className="px-0 py-0">
            {/* APU header info */}
            <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${CS.border}` }}>
              <div>
                <code className="text-xs font-mono" style={{ color: CS.accent }}>{apuItem.code}</code>
                <p className="text-xs font-dm-sans mt-0.5" style={{ color: CS.muted }}>{apuItem.unit}</p>
              </div>
            </div>

            {/* Section tables */}
            <div style={{ padding: "0.75rem 0" }}>
              <SectionTable section="materials" rows={(apuItem.materials as ApuLineItem[]) ?? []} />
              <SectionTable section="labor"     rows={(apuItem.labor     as ApuLineItem[]) ?? []} />
              <SectionTable section="equipment" rows={(apuItem.equipment as ApuLineItem[]) ?? []} />
            </div>

            {/* Cost breakdown */}
            {c && (
              <div className="px-4 pb-4" style={{ borderTop: `1px solid ${CS.border}` }}>
                <p className="text-xs font-syne font-bold uppercase tracking-wider pt-3 pb-2" style={{ color: CS.muted }}>
                  {lang === "es" ? "Cálculo de Precio" : "Price Calculation"}
                </p>

                <CostRow label={lang === "es" ? "Costo Directo (CD)" : "Direct Cost (CD)"} value={c.directCost} bold />

                {projectSettings.ggen.pct  > 0 && <CostRow label={projectSettings.ggen.label  || "Gastos generales"} pct={projectSettings.ggen.pct}  value={c.ggenVal}  indent />}
                {projectSettings.pgas1.pct > 0 && <CostRow label={projectSettings.pgas1.label || "pgas1"}            pct={projectSettings.pgas1.pct} value={c.pgas1Val} indent />}
                {projectSettings.pgas2.pct > 0 && <CostRow label={projectSettings.pgas2.label || "pgas2"}            pct={projectSettings.pgas2.pct} value={c.pgas2Val} indent />}

                <CostRow label={lang === "es" ? "Costo Neto (CN)" : "Net Cost (CN)"} value={c.netCost} bold />

                {projectSettings.util.pct > 0 && <CostRow label={projectSettings.util.label || "Utilidad"} pct={projectSettings.util.pct} value={c.utilVal} indent />}

                <CostRow label={lang === "es" ? "Precio de Venta (PV)" : "Selling Price (PV)"} value={c.sellingPrice} bold />

                {projectSettings.tot1.pct > 0 && <CostRow label={projectSettings.tot1.label || "Impuesto 1"} pct={projectSettings.tot1.pct} value={c.tot1Val} indent />}
                {projectSettings.tot2.pct > 0 && <CostRow label={projectSettings.tot2.label || "Impuesto 2"} pct={projectSettings.tot2.pct} value={c.tot2Val} indent />}

                <div className="mt-3 p-3 rounded-xl"
                  style={{ background: "rgba(249,115,22,0.1)", border: `1px solid rgba(249,115,22,0.25)` }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-syne font-bold" style={{ color: CS.text }}>
                      {lang === "es" ? "PRECIO UNITARIO FINAL" : "FINAL UNIT PRICE"}
                    </span>
                    <span className="font-syne font-bold text-2xl" style={{ color: CS.accent }}>
                      {fmt(c.finalPrice)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Chapter context menu ─────────────────────────────────────────────────────

interface ContextMenuState {
  section: string;
  x: number;
  y: number;
}

function ChapterContextMenu({ menu, language, clipboard, onClose, onAddActivities, onNewGroup, onEdit, onCopy, onPaste, onApproveAll, onDelete }:
  { menu: ContextMenuState; language: Locale; clipboard: string | null;
    onClose: () => void; onAddActivities: () => void; onNewGroup: () => void;
    onEdit: () => void; onCopy: () => void; onPaste: () => void; onApproveAll: () => void; onDelete: () => void }
) {
  const lang = language;
  useEffect(() => {
    function onClick() { onClose(); }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    setTimeout(() => { document.addEventListener("click", onClick); document.addEventListener("keydown", onKey); }, 0);
    return () => { document.removeEventListener("click", onClick); document.removeEventListener("keydown", onKey); };
  }, [onClose]);

  const items = [
    { icon: <Plus className="h-3.5 w-3.5" />, label: lang === "es" ? "Agregar actividades" : "Add activities", action: onAddActivities },
    { icon: <Plus className="h-3.5 w-3.5" />, label: lang === "es" ? "Nuevo grupo" : "New group", action: onNewGroup },
    { icon: <Pencil className="h-3.5 w-3.5" />, label: lang === "es" ? "Editar" : "Edit", action: onEdit },
    { icon: <Copy className="h-3.5 w-3.5" />, label: lang === "es" ? "Copiar capítulo" : "Copy chapter", action: onCopy },
    { icon: <ClipboardPaste className="h-3.5 w-3.5" />, label: lang === "es" ? "Pegar capítulo" : "Paste chapter", action: onPaste, disabled: !clipboard },
    { icon: <CheckSquare className="h-3.5 w-3.5" />, label: lang === "es" ? "Aprobar todas" : "Approve all", action: onApproveAll },
    null, // divider
    { icon: <Trash2 className="h-3.5 w-3.5" />, label: lang === "es" ? "Eliminar" : "Delete", action: onDelete, danger: true },
  ];

  return (
    <div
      className="fixed z-50 flex flex-col py-1 rounded-xl overflow-hidden"
      style={{
        left: menu.x, top: menu.y,
        background: CS.surface, border: `1px solid ${CS.border}`,
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        minWidth: 200,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, i) =>
        item === null ? (
          <div key={i} style={{ height: 1, background: CS.border, margin: "4px 0" }} />
        ) : (
          <button
            key={i}
            onClick={item.action}
            disabled={item.disabled}
            className="flex items-center gap-2.5 px-4 py-2 text-sm font-dm-sans text-left w-full transition-colors"
            style={{
              background: "none", border: "none", cursor: item.disabled ? "not-allowed" : "pointer",
              color: item.danger ? "#ef4444" : item.disabled ? CS.muted : CS.text,
              opacity: item.disabled ? 0.4 : 1,
            }}
            onMouseEnter={(e) => !item.disabled && ((e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "none")}
          >
            <span style={{ color: item.danger ? "#ef4444" : CS.muted }}>{item.icon}</span>
            {item.label}
          </button>
        )
      )}
    </div>
  );
}

// ─── Row context menu ─────────────────────────────────────────────────────────

interface RowContextMenuState {
  rowId: string;
  x: number;
  y: number;
}

function RowContextMenu({ menu, sections, currentSection, language, onClose, onMoveToSection, onDuplicate, onDelete }:
  { menu: RowContextMenuState; sections: string[]; currentSection: string; language: Locale;
    onClose: () => void; onMoveToSection: (section: string) => void;
    onDuplicate: () => void; onDelete: () => void; }
) {
  const lang = language;
  const otherSections = sections.filter((s) => s !== currentSection);

  useEffect(() => {
    function onClick() { onClose(); }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    setTimeout(() => { document.addEventListener("click", onClick); document.addEventListener("keydown", onKey); }, 0);
    return () => { document.removeEventListener("click", onClick); document.removeEventListener("keydown", onKey); };
  }, [onClose]);

  const itemStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 8,
    width: "100%", padding: "7px 14px", border: "none",
    background: "transparent", cursor: "pointer",
    fontSize: "0.8125rem", fontFamily: "var(--font-dm-sans)",
    textAlign: "left", color: CS.text,
  };

  return (
    <div
      className="fixed z-50 flex flex-col py-1.5 rounded-xl overflow-hidden"
      style={{
        left: menu.x, top: menu.y,
        background: CS.surface, border: `1px solid ${CS.border}`,
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        minWidth: 210,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button style={itemStyle}
        onClick={() => { onDuplicate(); onClose(); }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}>
        <Copy className="h-3.5 w-3.5" style={{ color: CS.muted }} />
        {lang === "es" ? "Duplicar fila" : "Duplicate row"}
      </button>

      {otherSections.length > 0 && (
        <>
          <div style={{ height: 1, background: CS.border, margin: "4px 8px" }} />
          <p className="px-4 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider font-dm-sans" style={{ color: CS.muted }}>
            {lang === "es" ? "Mover a capítulo" : "Move to chapter"}
          </p>
          {otherSections.map((sec) => (
            <button
              key={sec}
              style={itemStyle}
              onClick={() => { onMoveToSection(sec); onClose(); }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: CS.muted, flexShrink: 0 }}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <span className="truncate" style={{ maxWidth: 150 }}>{sec}</span>
            </button>
          ))}
        </>
      )}

      <div style={{ height: 1, background: CS.border, margin: "4px 8px" }} />
      <button style={{ ...itemStyle, color: "#ef4444" }}
        onClick={() => { onDelete(); onClose(); }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.08)")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}>
        <Trash2 className="h-3.5 w-3.5" />
        {lang === "es" ? "Eliminar fila" : "Delete row"}
      </button>
    </div>
  );
}

// ─── SortableChapterHeader ────────────────────────────────────────────────────

function SortableChapterHeader({ section, secTotal, fmt, lang, isEditing, editDraft, isDragging: isDraggingProp,
  onContextMenu, onEditChange, onEditBlur, onEditKeyDown }:
  { section: string; secTotal: number; fmt: (n: number) => string; lang: Locale;
    isEditing: boolean; editDraft: string; isDragging?: boolean;
    onContextMenu: (e: React.MouseEvent) => void;
    onEditChange: (v: string) => void; onEditBlur: () => void;
    onEditKeyDown: (e: React.KeyboardEvent) => void; }
) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging: isSortDragging,
  } = useSortable({ id: `chapter:${section}` });

  const dragging = isDraggingProp || isSortDragging;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: dragging ? 0.5 : 1,
    zIndex: dragging ? 20 : undefined,
    position: "relative",
  };

  return (
    <tr ref={setNodeRef} style={style} onContextMenu={onContextMenu}>
      <td
        colSpan={11}
        style={{
          padding: "0",
          background: "rgba(249,115,22,0.07)",
          borderTop: `2px solid rgba(249,115,22,0.25)`,
          borderBottom: `1px solid rgba(249,115,22,0.15)`,
          cursor: "context-menu",
        }}
      >
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Chapter drag handle */}
            <button
              {...attributes}
              {...listeners}
              tabIndex={-1}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-center shrink-0 touch-none"
              style={{
                width: 20, height: 20, background: "none", border: "none",
                cursor: dragging ? "grabbing" : "grab",
                color: "var(--cs-accent)", opacity: 0.5,
              }}
              aria-label={lang === "es" ? "Arrastrar para reordenar capítulo" : "Drag to reorder chapter"}
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
            {isEditing ? (
              <div className="flex items-center gap-2 flex-1" onClick={(e) => e.stopPropagation()}>
                <input
                  autoFocus
                  value={editDraft}
                  onChange={(e) => onEditChange(e.target.value)}
                  onBlur={onEditBlur}
                  onKeyDown={onEditKeyDown}
                  className="font-syne font-bold text-xs uppercase tracking-wider bg-transparent outline-none border-b flex-1"
                  style={{ color: CS.accent, borderColor: CS.accent }}
                />
              </div>
            ) : (
              <span className="font-syne font-bold text-xs uppercase tracking-wider truncate" style={{ color: CS.accent }}>{section}</span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-semibold font-dm-sans" style={{ color: CS.accent }}>{fmt(secTotal)}</span>
            <span className="text-[10px] font-dm-sans opacity-40" style={{ color: CS.muted }}>⋯</span>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ─── SortableBudgetRow ────────────────────────────────────────────────────────

interface SortableRowProps {
  row: BudgetRow;
  globalRowNum: number;
  isSelected: boolean;
  isEven: boolean;
  isDimmed?: boolean;
  lang: Locale;
  fmt: (n: number) => string;
  onSelect: () => void;
  onDelete: (id: string) => void;
  onDuplicate: (row: BudgetRow) => void;
  onCellSave: (id: string, field: EditableField, val: string) => void;
  onContextMenu: (e: React.MouseEvent, rowId: string) => void;
}

function SortableBudgetRow({
  row, globalRowNum, isSelected, isEven, isDimmed, lang, fmt,
  onSelect, onDelete, onDuplicate, onCellSave, onContextMenu,
}: SortableRowProps) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: row.id });

  const rowTotal = row.total ?? row.quantity * row.unit_price;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    borderBottom: `1px solid var(--cs-border)`,
    background: isDragging
      ? "rgba(249,115,22,0.08)"
      : isSelected
        ? "rgba(249,115,22,0.06)"
        : isEven ? "rgba(255,255,255,0.015)" : "transparent",
    outline: isSelected ? `1px solid rgba(249,115,22,0.2)` : undefined,
    opacity: isDragging ? 0.85 : isDimmed ? 0.28 : 1,
    zIndex: isDragging ? 9 : undefined,
    position: "relative",
  };

  return (
    <tr ref={setNodeRef} style={style} className="group cursor-pointer"
      onClick={onSelect}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, row.id); }}>
      {/* Drag handle */}
      <td style={{ padding: "7px 4px", textAlign: "center", width: 28 }}>
        <button
          {...attributes}
          {...listeners}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity touch-none"
          style={{
            width: 20, height: 20, background: "none", border: "none",
            cursor: "grab", color: "var(--cs-muted)", margin: "0 auto",
          }}
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      </td>
      <td style={{ padding: "7px 10px", textAlign: "center", fontSize: "0.7rem", color: "var(--cs-muted)" }}>
        {globalRowNum}
      </td>
      <td style={{ padding: "7px 10px" }}>
        <InlineCell field="code" rawValue={row.code ?? ""}
          displayValue={<code className="text-xs font-mono" style={{ color: "var(--cs-accent)" }}>{row.code ?? "—"}</code>}
          onSave={(v) => onCellSave(row.id, "code", v)} />
      </td>
      <td style={{ padding: "7px 10px", color: "var(--cs-text)", fontSize: "0.8125rem" }}>
        <InlineCell field="description" rawValue={row.description}
          displayValue={<>
            {row.description}
            {row.apu_item_id && (
              <span className="ml-1.5 text-[10px] rounded-full px-1.5 py-px" style={{ background: "rgba(96,165,250,0.1)", color: "#60a5fa" }}>APU</span>
            )}
          </>}
          onSave={(v) => onCellSave(row.id, "description", v)} />
      </td>
      <td style={{ padding: "7px 10px", color: "var(--cs-muted)", fontSize: "0.8125rem" }}>
        <InlineCell field="unit" rawValue={row.unit ?? ""}
          displayValue={<span>{row.unit ?? "—"}</span>}
          onSave={(v) => onCellSave(row.id, "unit", v)} />
      </td>
      <td style={{ padding: "7px 10px", textAlign: "right" }}>
        <InlineCell field="quantity" rawValue={String(row.quantity)}
          displayValue={<span style={{ fontSize: "0.8125rem", color: "var(--cs-text)" }}>{row.quantity.toLocaleString()}</span>}
          onSave={(v) => onCellSave(row.id, "quantity", v)} />
      </td>
      <td style={{ padding: "7px 10px", textAlign: "right" }}>
        <InlineCell field="unit_price" rawValue={String(row.unit_price)}
          displayValue={<span style={{ fontSize: "0.8125rem", color: "var(--cs-text)" }}>{fmt(row.unit_price)}</span>}
          onSave={(v) => onCellSave(row.id, "unit_price", v)} />
      </td>
      <td style={{ padding: "7px 10px", textAlign: "right" }}>
        <span className="font-semibold" style={{ fontSize: "0.8125rem", color: rowTotal > 0 ? "var(--cs-text)" : "var(--cs-muted)" }}>{fmt(rowTotal)}</span>
      </td>
      <td style={{ padding: "6px 10px" }}>
        <InlineCell field="status" rawValue={row.status}
          displayValue={<StatusPill status={row.status as StatusKey} language={lang} />}
          onSave={(v) => onCellSave(row.id, "status", v)} />
      </td>
      <td style={{ padding: "7px 10px" }}>
        <InlineCell field="assignee" rawValue={row.assignee ?? ""}
          displayValue={<span className="flex items-center gap-1.5"><AssigneeAvatar name={row.assignee} />{row.assignee && <span style={{ fontSize: "0.75rem", color: "var(--cs-muted)" }}>{row.assignee.split(/\s+/)[0]}</span>}</span>}
          onSave={(v) => onCellSave(row.id, "assignee", v)} />
      </td>
      <td style={{ padding: "7px 8px" }}>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button type="button" onClick={(e) => { e.stopPropagation(); onDuplicate(row); }}
            title={lang === "es" ? "Duplicar fila" : "Duplicate row"}
            className="flex items-center justify-center rounded"
            style={{ width: 26, height: 26, background: "none", border: "none", cursor: "pointer", color: "var(--cs-muted)" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "var(--cs-text)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "var(--cs-muted)")}>
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(row.id); }}
            title={lang === "es" ? "Eliminar fila" : "Delete row"}
            className="flex items-center justify-center rounded"
            style={{ width: 26, height: 26, background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Budget → Gantt status sync (DB trigger handles task creation) ────────────
// The DB trigger on budget_rows automatically creates gantt_tasks.
// This helper only syncs status changes to existing gantt tasks.

const BUDGET_TO_GANTT_STATUS: Record<string, "approved" | "in-review" | "pending"> = {
  pending: "pending",
  "in-review": "in-review",
  approved: "approved",
};

async function syncGanttStatus(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  budgetRow: { description: string; section: string },
  newStatus: string,
): Promise<void> {
  const ganttStatus = BUDGET_TO_GANTT_STATUS[newStatus];
  if (!ganttStatus) return;
  await supabase
    .from("gantt_tasks")
    .update({ status: ganttStatus })
    .eq("project_id", projectId)
    .eq("name", budgetRow.description)
    .eq("budget_section", budgetRow.section)
    .eq("is_chapter", false);
}

// ─── Main BudgetTab ───────────────────────────────────────────────────────────

interface BudgetTabProps {
  initialRows: BudgetRow[];
  apuItems: ApuItem[];
  onCountChange?: (n: number) => void;
}

export default function BudgetTab({ initialRows: _initialRows, apuItems: initialApuItems, onCountChange }: BudgetTabProps) {
  const { projectId, language, fmt, setActiveTab, userId, budgetRows: rows, setBudgetRows: setRows } = useWorkspace();
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const supabase = createClient();
  const lang = language as Locale;

  const isGhostRow = useCallback((r: { description: string; code?: string | null; quantity: number; unit_price: number }) => {
    const desc = r.description.trim();
    return (
      (desc === "(empty)" || desc === "(vacío)" || desc === "") &&
      (r.code === "—" || r.code === null || r.code === undefined || r.code === "") &&
      r.quantity === 0 && r.unit_price === 0
    );
  }, []);

  // Fetch fresh rows from DB once on first mount (picks up rows from other tabs like APU → Budget)
  const hasFetched = useRef(false);
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    supabase.from("budget_rows").select("*").eq("project_id", projectId).order("sort_order")
      .then(({ data }) => {
        if (!data) return;
        const fresh = (data as BudgetRow[])
          .filter((r) => !isGhostRow(r))
          .map((r) => ({ ...r, section: r.section.trim() }));
        setRows(fresh);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [apuItems]                    = useState<ApuItem[]>(initialApuItems);
  const [showAdd, setShowAdd]         = useState(false);
  const [showImport, setShowImport]   = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showPaste, setShowPaste]     = useState(false);
  const [showAPULibrary, setShowAPULibrary] = useState(false);
  const [addPrefill, setAddPrefill]   = useState<{ name: string; unit: string; unit_price: number } | null>(null);

  function refetchBudgetRows() {
    supabase.from("budget_rows").select("*").eq("project_id", projectId).order("sort_order")
      .then(({ data }) => {
        if (!data) return;
        const fresh = (data as BudgetRow[])
          .filter((r) => !isGhostRow(r))
          .map((r) => ({ ...r, section: r.section.trim() }));
        setRows(fresh);
      });
  }

  // APU detail panel
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  // Search / filter
  const [budgetSearch, setBudgetSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "in-review" | "approved">("all");

  // Row context menu
  const [rowContextMenu, setRowContextMenu] = useState<RowContextMenuState | null>(null);

  // Chapter context menu
  const [contextMenu, setContextMenu]   = useState<ContextMenuState | null>(null);
  const [clipboard, setClipboard]       = useState<string | null>(null); // copied section name
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editSectionDraft, setEditSectionDraft] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteRowConfirm, setDeleteRowConfirm] = useState<string | null>(null);

  // Add Activities modal
  const [addActivitiesSection, setAddActivitiesSection] = useState<string | null>(null);
  const [newGroupModal, setNewGroupModal] = useState(false);
  const [newGroupName, setNewGroupName]   = useState("");

  // Explicit section ordering — persisted via row sort_order
  const [sectionOrder, setSectionOrder] = useState<string[]>(() =>
    Array.from(new Set(rows.map((r) => r.section)))
  );
  // Keep sectionOrder in sync when rows change (new sections added, sections deleted)
  useEffect(() => {
    setSectionOrder((prev) => {
      const current = Array.from(new Set(rows.map((r) => r.section)));
      // Keep existing order for known sections, append new ones at the end
      const ordered = prev.filter((s) => current.includes(s));
      const newSections = current.filter((s) => !ordered.includes(s));
      if (newSections.length === 0 && ordered.length === current.length) return prev;
      return [...ordered, ...newSections];
    });
  }, [rows]);
  const sections = sectionOrder;
  const grandTotal = rows.reduce((s, r) => s + (r.total ?? r.quantity * r.unit_price), 0);

  // Filtered rows (for search/highlight)
  const q = budgetSearch.trim().toLowerCase();
  const filteredRows = rows.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (!q) return true;
    return (
      r.description.toLowerCase().includes(q) ||
      (r.code ?? "").toLowerCase().includes(q) ||
      r.section.toLowerCase().includes(q) ||
      (r.assignee ?? "").toLowerCase().includes(q)
    );
  });
  const isFiltering = q || statusFilter !== "all";
  const filteredIds = isFiltering ? new Set(filteredRows.map((r) => r.id)) : null;

  const selectedRow = rows.find((r) => r.id === selectedRowId) ?? null;
  const linkedApuItem = selectedRow?.apu_item_id
    ? (apuItems.find((a) => a.id === selectedRow.apu_item_id) ?? null)
    : null;

  // ── Realtime ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase.channel(`budget:${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "budget_rows", filter: `project_id=eq.${projectId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newRow = { ...(payload.new as BudgetRow), section: (payload.new as BudgetRow).section.trim() };
            // Skip ghost rows
            if (isGhostRow(newRow)) return;
            setRows((prev) => {
              if (prev.some((r) => r.id === newRow.id)) return prev;
              toast(lang === "es" ? "Nueva partida en tiempo real" : "New row received", "info");
              return [...prev, newRow].sort((a, b) => a.sort_order - b.sort_order);
            });
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as BudgetRow;
            setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
          } else if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as { id: string }).id;
            setRows((prev) => prev.filter((r) => r.id !== deletedId));
          }
        }
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { onCountChange?.(rows.length); }, [rows.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clean up ghost rows from DB on mount
  useEffect(() => {
    const ghosts = _initialRows.filter((r: BudgetRow) => isGhostRow(r));
    if (ghosts.length > 0) {
      ghosts.forEach((g: BudgetRow) => supabase.from("budget_rows").delete().eq("id", g.id));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Drag-to-reorder (chapters + rows within section) ──────────────────
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeId = String(active.id);
      const overId = String(over.id);

      // ─── Chapter reorder ─────────────────────────────────────────────
      if (activeId.startsWith("chapter:") && overId.startsWith("chapter:")) {
        const activeSec = activeId.replace("chapter:", "");
        const overSec = overId.replace("chapter:", "");
        const oldIdx = sectionOrder.indexOf(activeSec);
        const newIdx = sectionOrder.indexOf(overSec);
        if (oldIdx === -1 || newIdx === -1) return;

        const newOrder = arrayMove(sectionOrder, oldIdx, newIdx);
        setSectionOrder(newOrder);

        // Rebuild sort_order for all rows based on new chapter order
        const allUpdated: BudgetRow[] = [];
        let sortCounter = 0;
        for (const sec of newOrder) {
          const secRows = rows.filter((r) => r.section === sec)
            .sort((a, b) => a.sort_order - b.sort_order);
          for (const r of secRows) {
            allUpdated.push({ ...r, sort_order: sortCounter });
            sortCounter++;
          }
        }
        setRows(allUpdated);

        // Batch persist budget rows + mirror sort to gantt chapters
        await Promise.all([
          ...allUpdated.map((r) =>
            supabase.from("budget_rows").update({ sort_order: r.sort_order }).eq("id", r.id)
          ),
          ...newOrder.map((sec, i) =>
            supabase.from("gantt_tasks").update({ sort_order: i })
              .eq("project_id", projectId).eq("budget_section", sec).eq("is_chapter", true)
          ),
        ]);
        return;
      }

      // ─── Row reorder within section ──────────────────────────────────
      const activeRow = rows.find((r) => r.id === activeId);
      const overRow   = rows.find((r) => r.id === overId);
      if (!activeRow || !overRow || activeRow.section !== overRow.section) return;

      const sectionRows = rows.filter((r) => r.section === activeRow.section)
        .sort((a, b) => a.sort_order - b.sort_order);
      const oldIdx = sectionRows.findIndex((r) => r.id === activeId);
      const newIdx = sectionRows.findIndex((r) => r.id === overId);
      const reordered = arrayMove(sectionRows, oldIdx, newIdx);

      // Rebuild sort_order for all rows maintaining chapter order
      const allUpdated: BudgetRow[] = [];
      let sortCounter = 0;
      for (const sec of sectionOrder) {
        const secRows = sec === activeRow.section
          ? reordered
          : rows.filter((r) => r.section === sec).sort((a, b) => a.sort_order - b.sort_order);
        for (const r of secRows) {
          allUpdated.push({ ...r, sort_order: sortCounter });
          sortCounter++;
        }
      }
      setRows(allUpdated);

      // Persist changed budget rows + mirror sort_order to gantt child tasks
      const changed = reordered.map((r) => {
        const globalIdx = allUpdated.findIndex((u) => u.id === r.id);
        return { id: r.id, sort_order: allUpdated[globalIdx].sort_order, description: r.description, section: r.section };
      });
      await Promise.all([
        ...changed.map((r) =>
          supabase.from("budget_rows").update({ sort_order: r.sort_order }).eq("id", r.id)
        ),
        ...changed.map((r) =>
          supabase.from("gantt_tasks").update({ sort_order: r.sort_order })
            .eq("project_id", projectId).eq("name", r.description).eq("budget_section", r.section).eq("is_chapter", false)
        ),
      ]);
    },
    [rows, sectionOrder, supabase, projectId, setRows]
  );

  // ── Inline cell save ──────────────────────────────────────────────────────
  const handleCellSave = useCallback(
    async (rowId: string, field: EditableField, rawVal: string) => {
      // Optimistic update
      const prevRows = rows;
      setRows((prev) => prev.map((r) => {
        if (r.id !== rowId) return r;
        const next = { ...r };
        if (field === "code")       next.code = rawVal.trim() || null;
        if (field === "description") next.description = rawVal.trim() || "";
        if (field === "unit")       next.unit = rawVal.trim() || null;
        if (field === "quantity")   { next.quantity = parseFloat(rawVal) || 0; next.total = next.quantity * next.unit_price; }
        if (field === "unit_price") { next.unit_price = parseFloat(rawVal) || 0; next.total = next.quantity * next.unit_price; }
        if (field === "status")     next.status = rawVal as StatusKey;
        if (field === "assignee")   next.assignee = rawVal.trim() || null;
        return next;
      }));

      // Send ONLY the single field being updated — nothing else
      let error: { message: string } | null = null;
      if (field === "status") {
        ({ error } = await supabase.from("budget_rows").update({ status: rawVal as "pending" | "in-review" | "approved" }).eq("id", rowId));
      } else if (field === "code") {
        ({ error } = await supabase.from("budget_rows").update({ code: rawVal.trim() || null }).eq("id", rowId));
      } else if (field === "description") {
        ({ error } = await supabase.from("budget_rows").update({ description: rawVal.trim() || "" }).eq("id", rowId));
      } else if (field === "unit") {
        ({ error } = await supabase.from("budget_rows").update({ unit: rawVal.trim() || null }).eq("id", rowId));
      } else if (field === "quantity") {
        ({ error } = await supabase.from("budget_rows").update({ quantity: parseFloat(rawVal) || 0 }).eq("id", rowId));
      } else if (field === "unit_price") {
        ({ error } = await supabase.from("budget_rows").update({ unit_price: parseFloat(rawVal) || 0 }).eq("id", rowId));
      } else if (field === "assignee") {
        ({ error } = await supabase.from("budget_rows").update({ assignee: rawVal.trim() || null }).eq("id", rowId));
      }

      if (error) {
        console.error("[budget_rows PATCH error]", { rowId, field, rawVal, error });
        setRows(prevRows);
        toast(lang === "es" ? "Error al guardar" : "Failed to save", "error");
        return;
      }

      // Sync status to gantt
      if (field === "status") {
        const row = rows.find((r) => r.id === rowId);
        if (row) syncGanttStatus(supabase, projectId, { description: row.description, section: row.section }, rawVal);
      }
    },
    [supabase, projectId, rows, lang, toast, setRows]
  );

  // ── Row delete ────────────────────────────────────────────────────────────
  function handleDelete(id: string) {
    setDeleteRowConfirm(id);
    setRowContextMenu(null);
  }

  async function confirmDeleteRow(id: string) {
    setDeleteRowConfirm(null);
    setRows((prev) => prev.filter((r) => r.id !== id));
    if (selectedRowId === id) setSelectedRowId(null);
    await supabase.from("budget_rows").delete().eq("id", id);
  }

  async function handleDuplicateRow(source: BudgetRow) {
    const maxOrder = rows.reduce((m, r) => Math.max(m, r.sort_order), 0);
    const payload: BudgetRowInsert = {
      project_id:  projectId,
      apu_item_id: source.apu_item_id,
      section:     source.section,
      code:        source.code ?? undefined,
      description: source.description,
      unit:        source.unit ?? undefined,
      quantity:    source.quantity,
      unit_price:  source.unit_price,
      status:      source.status,
      assignee:    source.assignee ?? undefined,
      sort_order:  maxOrder + 1,
    };
    const { data, error } = await supabase.from("budget_rows").insert(payload).select().single();
    if (!error && data) {
      setRows((prev) => {
        const idx = prev.findIndex((r) => r.id === source.id);
        const next = [...prev];
        next.splice(idx + 1, 0, data as BudgetRow);
        return next;
      });
      setSelectedRowId((data as BudgetRow).id);
      toast(lang === "es" ? "Fila duplicada" : "Row duplicated", "success");
    }
  }

  // ── Chapter actions ───────────────────────────────────────────────────────
  function handleChapterCtxMenu(e: React.MouseEvent, section: string) {
    e.preventDefault();
    e.stopPropagation();
    const _rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    // Position the menu near the click, but keep it on screen
    const x = Math.min(e.clientX, window.innerWidth - 220);
    const y = Math.min(e.clientY, window.innerHeight - 280);
    setContextMenu({ section, x, y });
  }

  async function handleRenameSection(oldName: string, newName: string) {
    if (!newName.trim() || newName === oldName) { setEditingSection(null); return; }
    const trimmed = newName.trim();
    setRows((prev) => prev.map((r) => r.section === oldName ? { ...r, section: trimmed } : r));
    setEditingSection(null);
    // Batch update all rows in this section
    await supabase.from("budget_rows").update({ section: trimmed }).eq("project_id", projectId).eq("section", oldName);
  }

  async function handleApproveSection(section: string) {
    const toApprove = rows.filter((r) => r.section === section && r.status !== "approved");
    if (!toApprove.length) {
      toast(lang === "es" ? "Todas las partidas ya están aprobadas" : "All rows already approved", "info");
      setContextMenu(null);
      return;
    }
    const ids = toApprove.map((r) => r.id);
    setRows((prev) => prev.map((r) => ids.includes(r.id) ? { ...r, status: "approved" as const } : r));
    await supabase.from("budget_rows").update({ status: "approved" }).in("id", ids);
    // Sync all statuses to gantt
    for (const row of toApprove) syncGanttStatus(supabase, projectId, { description: row.description, section: row.section }, "approved");
    toast(
      lang === "es"
        ? `${toApprove.length} partida${toApprove.length > 1 ? "s" : ""} aprobada${toApprove.length > 1 ? "s" : ""}`
        : `${toApprove.length} row${toApprove.length > 1 ? "s" : ""} approved`,
      "success"
    );
    setContextMenu(null);
  }

  function handleCopySection(section: string) {
    setClipboard(section);
    toast(lang === "es" ? `Capítulo "${section}" copiado` : `Chapter "${section}" copied`, "info");
    setContextMenu(null);
  }

  async function handlePasteSection(afterSection: string) {
    if (!clipboard) return;
    const srcRows = rows.filter((r) => r.section === clipboard);
    if (srcRows.length === 0) { setContextMenu(null); return; }
    const newName = `${clipboard} (copia)`;
    const payloads: BudgetRowInsert[] = srcRows.map((r, i) => ({
      project_id: projectId, apu_item_id: r.apu_item_id,
      section: newName, code: r.code, description: r.description,
      unit: r.unit, quantity: r.quantity, unit_price: r.unit_price,
      status: r.status, assignee: r.assignee, sort_order: rows.length + i,
    }));
    const { data } = await supabase.from("budget_rows").insert(payloads).select();
    if (data) setRows((prev) => {
      // Insert after the target section's rows
      const targetIdx = prev.findLastIndex((r) => r.section === afterSection);
      const next = [...prev];
      next.splice(targetIdx + 1, 0, ...(data as BudgetRow[]));
      return next;
    });
    setContextMenu(null);
  }

  async function handleDeleteSection(section: string) {
    const idsToDelete = rows.filter((r) => r.section === section).map((r) => r.id);
    setRows((prev) => prev.filter((r) => r.section !== section));
    if (selectedRowId && idsToDelete.includes(selectedRowId)) setSelectedRowId(null);
    await supabase.from("budget_rows").delete().in("id", idsToDelete);
    setDeleteConfirm(null);
  }

  async function handleNewGroup() {
    if (!newGroupName.trim()) { setNewGroupModal(false); return; }
    const trimmedName = newGroupName.trim();
    // Create a placeholder row for the new empty group — use a descriptive name so it's not filtered as ghost
    const payload: BudgetRowInsert = {
      project_id: projectId, section: trimmedName,
      description: lang === "es" ? "Nueva partida" : "New item",
      code: null, quantity: 0, unit_price: 0,
      sort_order: rows.length, status: "pending",
    };
    const { data } = await supabase.from("budget_rows").insert(payload).select().single();
    if (data) {
      setRows((prev) => [...prev, data as BudgetRow]);
    }
    setNewGroupModal(false);
    setNewGroupName("");
    setContextMenu(null);
  }

  // ── Row context menu ──────────────────────────────────────────────────────
  function handleRowCtxMenu(e: React.MouseEvent, rowId: string) {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth  - 230);
    const y = Math.min(e.clientY, window.innerHeight - 200);
    setRowContextMenu({ rowId, x, y });
    setContextMenu(null); // close chapter menu if open
  }

  async function handleMoveRowToSection(rowId: string, targetSection: string) {
    setRows((prev) => prev.map((r) => r.id === rowId ? { ...r, section: targetSection } : r));
    await supabase.from("budget_rows").update({ section: targetSection }).eq("id", rowId);
    toast(
      lang === "es" ? `Fila movida a "${targetSection}"` : `Row moved to "${targetSection}"`,
      "success"
    );
  }

  // ── CSV export ───────────────────────────────────────────────────────────
  function handleCSVExport() {
    const headers = [
      lang === "es" ? "Capítulo" : "Chapter",
      lang === "es" ? "Código" : "Code",
      lang === "es" ? "Descripción" : "Description",
      lang === "es" ? "Unidad" : "Unit",
      lang === "es" ? "Cantidad" : "Quantity",
      lang === "es" ? "P.U." : "Unit Price",
      lang === "es" ? "Total" : "Total",
      lang === "es" ? "Estatus" : "Status",
      lang === "es" ? "Responsable" : "Assignee",
    ];
    const dataRows = rows.map((r) => [
      r.section,
      r.code ?? "",
      r.description,
      r.unit ?? "",
      r.quantity,
      r.unit_price,
      r.total ?? r.quantity * r.unit_price,
      r.status,
      r.assignee ?? "",
    ]);
    const csv = [headers, ...dataRows]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `presupuesto-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Paste import callback ─────────────────────────────────────────────────
  function handlePasteImport(newRows: BudgetRow[]) {
    setRows((prev) => {
      const updated = [...prev, ...newRows];
      return updated;
    });
    // DB trigger on budget_rows creates gantt tasks automatically
    toast(
      lang === "es"
        ? `${newRows.length} partida${newRows.length !== 1 ? "s" : ""} importada${newRows.length !== 1 ? "s" : ""}`
        : `${newRows.length} row${newRows.length !== 1 ? "s" : ""} imported`,
      "success"
    );
  }

  // ── Print report ──────────────────────────────────────────────────────────
  function handlePrintReport() {
    const win = window.open("", "_blank", "width=1000,height=720,menubar=yes");
    if (!win) return;

    const statusLabel = (s: string) =>
      lang === "es"
        ? ({ approved: "Aprobado", "in-review": "En revisión", pending: "Pendiente" }[s] ?? s)
        : ({ approved: "Approved", "in-review": "Under Review", pending: "Pending" }[s] ?? s);

    const statusColor = (s: string) =>
      ({ approved: "#10b981", "in-review": "#f59e0b", pending: "#60a5fa" }[s] ?? "#6b7280");

    const secs = Array.from(new Set(rows.map((r) => r.section)));
    let rowNum = 0;

    const rowsHtml = secs.map((sec) => {
      const secRows = rows.filter((r) => r.section === sec);
      const secTotal = secRows.reduce((s, r) => s + (r.total ?? r.quantity * r.unit_price), 0);
      const secPct = grandTotal > 0 ? ((secTotal / grandTotal) * 100).toFixed(1) : "0.0";
      const dataRows = secRows.map((row) => {
        rowNum++;
        const total = row.total ?? row.quantity * row.unit_price;
        const sColor = statusColor(row.status);
        return `<tr>
          <td style="text-align:center;color:#6b7280">${rowNum}</td>
          <td><code style="font-family:monospace;color:#f97316;font-size:10px">${row.code ?? ""}</code></td>
          <td>${row.description}</td>
          <td style="text-align:center;color:#6b7280">${row.unit ?? ""}</td>
          <td style="text-align:right">${row.quantity.toLocaleString()}</td>
          <td style="text-align:right">${fmt(row.unit_price)}</td>
          <td style="text-align:right;font-weight:600">${fmt(total)}</td>
          <td style="text-align:center;font-size:9.5px;white-space:nowrap">
            <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${sColor};vertical-align:middle;margin-right:3px"></span>${statusLabel(row.status)}
          </td>
          <td style="color:#6b7280;font-size:10px;white-space:nowrap">${row.assignee ?? ""}</td>
        </tr>`;
      }).join("");
      return `<tr style="background:#fff7ed">
        <td colspan="9" style="padding:6px 8px;font-weight:700;font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:#c2410c;border-top:2px solid #fed7aa">
          <span>${sec}</span>
          <span style="float:right;font-weight:400;font-size:10px;color:#9a3412">${secPct}% &nbsp;·&nbsp; ${fmt(secTotal)}</span>
        </td>
      </tr>${dataRows}`;
    }).join("");

    const approvedCount  = rows.filter((r) => r.status === "approved").length;
    const reviewCount    = rows.filter((r) => r.status === "in-review").length;
    const pendingCount   = rows.filter((r) => r.status === "pending").length;

    const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8"/>
  <title>${lang === "es" ? "Presupuesto de Obra" : "Construction Budget"} — ConstruSheet</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,-apple-system,sans-serif;font-size:11px;color:#111827;padding:24px}
    h1{font-size:18px;font-weight:700;margin-bottom:2px}
    .meta{font-size:10px;color:#6b7280;margin-bottom:10px}
    .stats{display:flex;gap:12px;margin-bottom:14px;flex-wrap:wrap}
    .stat{border:1px solid #e5e7eb;border-radius:8px;padding:8px 14px;min-width:110px}
    .stat-label{font-size:9.5px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em}
    .stat-value{font-size:17px;font-weight:700;color:#111827}
    .stat-value.accent{color:#f97316}
    table{width:100%;border-collapse:collapse;font-size:10.5px}
    th{background:#f97316;color:#fff;padding:4px 7px;text-align:left;font-size:9.5px;font-weight:600;text-transform:uppercase}
    th:nth-child(5),th:nth-child(6),th:nth-child(7){text-align:right}
    th:nth-child(4),th:nth-child(8){text-align:center}
    td{padding:4px 7px;border-bottom:1px solid #f3f4f6;vertical-align:middle}
    tr:nth-child(even) td{background:#f9fafb}
    .total-row td{background:#fff7ed!important;font-weight:700;border-top:2px solid #fed7aa!important}
    .footer{margin-top:14px;font-size:10px;color:#9ca3af;display:flex;justify-content:space-between}
    @media print{body{padding:12px}.footer{position:fixed;bottom:0;left:24px;right:24px}}
  </style>
</head>
<body>
  <h1>ConstruSheet — ${lang === "es" ? "Presupuesto de Obra" : "Construction Budget"}</h1>
  <div class="meta">${lang === "es" ? "Generado" : "Generated"}: ${new Date().toLocaleDateString(lang === "es" ? "es-MX" : "en-US", { year: "numeric", month: "long", day: "numeric" })} &nbsp;·&nbsp; ${rows.length} ${lang === "es" ? "partidas" : "rows"} · ${secs.length} ${lang === "es" ? "capítulos" : "chapters"}</div>

  <div class="stats">
    <div class="stat">
      <div class="stat-label">${lang === "es" ? "Total" : "Total"}</div>
      <div class="stat-value accent">${fmt(grandTotal)}</div>
    </div>
    <div class="stat">
      <div class="stat-label">${lang === "es" ? "Aprobadas" : "Approved"}</div>
      <div class="stat-value" style="color:#22c55e">${approvedCount}</div>
    </div>
    <div class="stat">
      <div class="stat-label">${lang === "es" ? "En revisión" : "Under Review"}</div>
      <div class="stat-value" style="color:#fbbf24">${reviewCount}</div>
    </div>
    <div class="stat">
      <div class="stat-label">${lang === "es" ? "Pendientes" : "Pending"}</div>
      <div class="stat-value" style="color:#60a5fa">${pendingCount}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:28px">#</th>
        <th style="width:60px">${lang === "es" ? "Código" : "Code"}</th>
        <th>${lang === "es" ? "Descripción" : "Description"}</th>
        <th style="width:44px">${lang === "es" ? "Unid." : "Unit"}</th>
        <th style="width:58px">${lang === "es" ? "Cant." : "Qty"}</th>
        <th style="width:78px">${lang === "es" ? "P.U." : "Unit Price"}</th>
        <th style="width:78px">Total</th>
        <th style="width:82px">${lang === "es" ? "Estatus" : "Status"}</th>
        <th style="width:90px">${lang === "es" ? "Responsable" : "Assignee"}</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="6" style="text-align:right;font-size:10px;color:#92400e;text-transform:uppercase">
          ${lang === "es" ? "Total del Presupuesto" : "Budget Total"}
        </td>
        <td style="text-align:right;font-size:13px;color:#f97316">${fmt(grandTotal)}</td>
        <td colspan="2"></td>
      </tr>
    </tfoot>
  </table>
  <div class="footer"><span>ConstruSheet</span><span>${new Date().toISOString().slice(0, 10)}</span></div>
  <script>setTimeout(()=>{window.print();},400)<\/script>
</body>
</html>`;
    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const thStyle: React.CSSProperties = {
    padding: "8px 10px", textAlign: "left", fontSize: "0.7rem", fontWeight: 600,
    textTransform: "uppercase", letterSpacing: "0.05em", color: CS.muted,
    background: "rgba(255,255,255,0.03)", borderBottom: `1px solid ${CS.border}`, whiteSpace: "nowrap",
  };

  // Adjust main content right margin when APU panel is open
  const panelOpen = !!selectedRowId;

  return (
    <>
    <ToolbarPortal>
      <ToolbarGroup label={lang === "es" ? "Exportar" : "Export"}>
        <TBtn onClick={handleCSVExport} disabled={rows.length === 0}>
          <Download className="h-3.5 w-3.5" /> CSV
        </TBtn>
        <TBtn onClick={handlePrintReport} disabled={rows.length === 0}>
          <FileText className="h-3.5 w-3.5" /> PDF
        </TBtn>
      </ToolbarGroup>
      <ToolbarSep />
      <ToolbarGroup label={lang === "es" ? "Importar" : "Import"}>
        <TBtn onClick={() => setShowPaste(true)}>
          <ClipboardPaste className="h-3.5 w-3.5" /> {lang === "es" ? "Pegar Excel" : "Paste Excel"}
        </TBtn>
        <TBtn onClick={() => setShowImport(true)}>
          <ArrowDownToLine className="h-3.5 w-3.5" /> {lang === "es" ? "Importar APU" : "Import APU"}
        </TBtn>
      </ToolbarGroup>
      <ToolbarSep />
      <TBtnPrimary onClick={() => setShowAdd(true)}>
        <Plus className="h-3.5 w-3.5" /> {lang === "es" ? "+ Agregar" : "+ Add Item"}
      </TBtnPrimary>
    </ToolbarPortal>
    <div className="flex flex-col gap-4" style={{ paddingRight: panelOpen ? 408 : 0, transition: "padding-right 200ms ease" }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-syne font-bold text-lg" style={{ color: CS.text }}>
            {lang === "es" ? "Presupuesto de Obra" : "Construction Budget"}
          </h2>
          <p className="text-xs font-dm-sans mt-0.5" style={{ color: CS.muted }}>
            {q ? (
              <>
                <span style={{ color: CS.accent, fontWeight: 600 }}>{filteredRows.length}</span>
                {" "}{lang === "es" ? "de" : "of"}{" "}
                {rows.length} {lang === "es" ? "partidas" : "rows"}
              </>
            ) : (
              <>
                {rows.length} {lang === "es" ? "partidas" : "rows"} · {sections.length} {lang === "es" ? "capítulos" : "chapters"}
                {rows.length > 0 && (() => {
                  const approved = rows.filter((r) => r.status === "approved");
                  const approvedTotal = approved.reduce((s, r) => s + (r.total ?? r.quantity * r.unit_price), 0);
                  const approvedPct = grandTotal > 0 ? Math.round((approvedTotal / grandTotal) * 100) : 0;
                  if (approved.length === 0) return null;
                  return (
                    <>
                      {" · "}
                      <span style={{ color: "#22c55e", fontWeight: 600 }}>
                        {fmt(approvedTotal)} {lang === "es" ? "aprobado" : "approved"} ({approvedPct}%)
                      </span>
                    </>
                  );
                })()}
              </>
            )}
            {!q && (
              <span className="ml-2 text-[10px] rounded-full px-1.5 py-px" style={{ background: "rgba(96,165,250,0.12)", color: "#60a5fa" }}>
                {lang === "es" ? "Clic derecho en capítulo para opciones" : "Right-click chapter for options"}
              </span>
            )}
          </p>
        </div>
        {/* Buttons moved to ContextualToolbar via portal */}
      </div>

      {/* ── Search bar ─────────────────────────────────────── */}
      {rows.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1" style={{ minWidth: 200, maxWidth: 380 }}>
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none"
              style={{ color: CS.muted }}
            />
            <input
              value={budgetSearch}
              onChange={(e) => setBudgetSearch(e.target.value)}
              placeholder={lang === "es" ? "Buscar partida, código, capítulo…" : "Search row, code, chapter…"}
              className="w-full font-dm-sans text-sm"
              style={{
                padding: "0.4rem 2rem 0.4rem 2.125rem",
                borderRadius: 10,
                border: `1px solid ${CS.border}`,
                background: "rgba(255,255,255,0.04)",
                color: CS.text,
                outline: "none",
              }}
            />
            {budgetSearch && (
              <button
                type="button"
                onClick={() => setBudgetSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2"
                style={{ background: "none", border: "none", cursor: "pointer", color: CS.muted, padding: 2 }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {/* Status filter pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {([
              { key: "all",        label: lang === "es" ? "Todos"       : "All"          },
              { key: "pending",    label: lang === "es" ? "Pendiente"   : "Pending",      color: "#60a5fa" },
              { key: "in-review",  label: lang === "es" ? "En revisión" : "Under Review", color: "#f59e0b" },
              { key: "approved",   label: lang === "es" ? "Aprobado"    : "Approved",     color: "#10b981" },
            ] as { key: typeof statusFilter; label: string; color?: string }[]).map(({ key, label, color }) => {
              const active = statusFilter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatusFilter(key)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium font-dm-sans transition-colors"
                  style={{
                    border: active ? `1px solid ${color ?? CS.accent}` : `1px solid ${CS.border}`,
                    background: active ? `${color ?? CS.accent}18` : "transparent",
                    color: active ? (color ?? CS.accent) : CS.muted,
                    cursor: "pointer",
                  }}
                >
                  {color && active && <span className="rounded-full shrink-0" style={{ width: 5, height: 5, background: color, display: "inline-block" }} />}
                  {label}
                </button>
              );
            })}
          </div>

          {isFiltering && (
            <span className="text-xs font-dm-sans" style={{ color: CS.muted }}>
              {filteredRows.length} {lang === "es" ? "resultado(s)" : "result(s)"}
            </span>
          )}
        </div>
      )}

      {/* ── Approval status bar ────────────────────────────── */}
      {rows.length > 0 && (() => {
        const approved = rows.filter((r) => r.status === "approved");
        const review   = rows.filter((r) => r.status === "in-review");
        const pending  = rows.filter((r) => r.status === "pending");
        const valOf = (arr: BudgetRow[]) =>
          arr.reduce((s, r) => s + (r.total ?? r.quantity * r.unit_price), 0);
        const vApproved = valOf(approved);
        const vReview   = valOf(review);
        const vPending  = valOf(pending);
        const total     = vApproved + vReview + vPending || 1;
        const pApproved = (vApproved / total) * 100;
        const pReview   = (vReview   / total) * 100;
        const pPending  = (vPending  / total) * 100;

        const segments = [
          { pct: pApproved, color: "#10b981", label: lang === "es" ? "Aprobado"    : "Approved",     count: approved.length, value: vApproved },
          { pct: pReview,   color: "#f59e0b", label: lang === "es" ? "En revisión" : "Under Review", count: review.length,   value: vReview   },
          { pct: pPending,  color: "#60a5fa", label: lang === "es" ? "Pendiente"   : "Pending",      count: pending.length,  value: vPending  },
        ];

        return (
          <div className="flex flex-col gap-2 rounded-[10px] p-3"
            style={{ border: `1px solid ${CS.border}`, background: "rgba(255,255,255,0.015)" }}>
            {/* Segmented bar */}
            <div className="flex rounded-full overflow-hidden" style={{ height: 6, gap: 2 }}>
              {segments.map(({ pct, color, label }) => (
                pct > 0 && (
                  <div key={label} style={{ width: `${pct}%`, background: color, borderRadius: 9999, transition: "width 0.4s ease" }} />
                )
              ))}
            </div>
            {/* Labels */}
            <div className="flex items-center gap-4 flex-wrap">
              {segments.map(({ color, label, count, value }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className="rounded-full shrink-0" style={{ width: 6, height: 6, background: color, display: "inline-block" }} />
                  <span className="text-xs font-dm-sans" style={{ color: CS.muted }}>
                    {label}
                    <span className="ml-1 font-semibold" style={{ color: CS.text }}>{count}</span>
                    <span className="ml-1 opacity-60">{fmt(value)}</span>
                  </span>
                </div>
              ))}
              <span className="ml-auto text-xs font-dm-sans font-semibold" style={{ color: CS.accent }}>
                {pApproved.toFixed(0)}% {lang === "es" ? "aprobado" : "approved"}
              </span>
            </div>
          </div>
        );
      })()}

      {/* ── Empty state ────────────────────────────────────── */}
      {rows.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 rounded-[10px] text-center gap-4"
          style={{ border: `1.5px dashed ${CS.border}` }}>
          <p className="font-syne font-bold text-base" style={{ color: CS.text }}>{lang === "es" ? "Sin partidas presupuestales" : "No budget rows yet"}</p>
          <p className="text-sm font-dm-sans max-w-xs" style={{ color: CS.muted }}>
            {lang === "es" ? "Agrega partidas manualmente o importa desde los APUs del proyecto." : "Add rows manually or import from the project's APU items."}
          </p>
          <div className="flex gap-2 flex-wrap justify-center">
            <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-semibold font-dm-sans"
              style={{ background: CS.accent, color: "#fff", border: "none", cursor: "pointer" }}>
              <Plus className="h-4 w-4" />{lang === "es" ? "Agregar Partida" : "Add Row"}
            </button>
            <button onClick={() => setShowImport(true)} className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-medium font-dm-sans"
              style={{ border: `1px solid ${CS.border}`, background: "transparent", color: CS.muted, cursor: "pointer" }}>
              <Import className="h-4 w-4" />{lang === "es" ? "Importar APU" : "Import APU"}
            </button>
            <button onClick={() => setShowLibrary(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-medium font-dm-sans"
              style={{ border: `1px solid ${CS.border}`, background: "transparent", color: CS.muted, cursor: "pointer" }}>
              {lang === "es" ? "Importar desde Biblioteca" : "Import from Library"}
            </button>
            <button onClick={() => setShowPaste(true)} className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-medium font-dm-sans"
              style={{ border: `1px solid ${CS.border}`, background: "transparent", color: CS.muted, cursor: "pointer" }}>
              <ClipboardPaste className="h-4 w-4" />{lang === "es" ? "Pegar Excel" : "Paste Excel"}
            </button>
          </div>
        </div>
      )}

      {/* ── Budget table ───────────────────────────────────── */}
      {rows.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="rounded-[10px] overflow-hidden" style={{ border: `1px solid ${CS.border}` }}>
          <div className="overflow-x-auto">
            <table className="w-full font-dm-sans" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 28 }} />
                  <th style={{ ...thStyle, width: 36, textAlign: "center" }}>#</th>
                  <th style={{ ...thStyle, width: 70 }}>{lang === "es" ? "Código" : "Code"}</th>
                  <th style={thStyle}>{lang === "es" ? "Descripción" : "Description"}</th>
                  <th style={{ ...thStyle, width: 60 }}>{lang === "es" ? "Unidad" : "Unit"}</th>
                  <th style={{ ...thStyle, textAlign: "right", width: 80 }}>{lang === "es" ? "Cantidad" : "Qty"}</th>
                  <th style={{ ...thStyle, textAlign: "right", width: 110 }}>{lang === "es" ? "P.U." : "Unit Price"}</th>
                  <th style={{ ...thStyle, textAlign: "right", width: 110 }}>Total</th>
                  <th style={{ ...thStyle, width: 100 }}>{lang === "es" ? "Estatus" : "Status"}</th>
                  <th style={{ ...thStyle, width: 130 }}>{lang === "es" ? "Responsable" : "Assignee"}</th>
                  <th style={{ ...thStyle, width: 40 }} />
                </tr>
              </thead>
              <SortableContext items={sections.map((s) => `chapter:${s}`)} strategy={verticalListSortingStrategy}>
                  <tbody>
                    {sections.map((sec, secIdx) => {
                      const secRows = rows.filter((r) => r.section === sec)
                        .sort((a, b) => a.sort_order - b.sort_order);
                      // When a filter is active, skip sections that have no visible rows
                      if (filteredIds !== null && !secRows.some((r) => filteredIds.has(r.id))) return null;
                      const visibleRows = filteredIds !== null ? secRows.filter((r) => filteredIds.has(r.id)) : secRows;
                      const secTotal = visibleRows.reduce((s, r) => s + (r.total ?? r.quantity * r.unit_price), 0);
                      const secStartNum = sections.slice(0, secIdx).reduce(
                        (acc, s) => acc + rows.filter((r) => r.section === s).length, 0
                      );

                      return (
                        <Fragment key={sec}>
                          {/* ── Sortable chapter header row ── */}
                          <SortableChapterHeader
                            section={sec}
                            secTotal={secTotal}
                            fmt={fmt}
                            lang={lang}
                            isEditing={editingSection === sec}
                            editDraft={editSectionDraft}
                            onContextMenu={(e) => handleChapterCtxMenu(e, sec)}
                            onEditChange={(v) => setEditSectionDraft(v)}
                            onEditBlur={() => handleRenameSection(sec, editSectionDraft)}
                            onEditKeyDown={(e) => {
                              if (e.key === "Enter") handleRenameSection(sec, editSectionDraft);
                              if (e.key === "Escape") setEditingSection(null);
                            }}
                          />

                          {/* ── Sortable data rows ── */}
                          <SortableContext items={secRows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                            {secRows.map((row, rowIdx) => {
                              const globalRowNum = secStartNum + rowIdx + 1;
                              return (
                                <SortableBudgetRow
                                  key={row.id}
                                  row={row}
                                  globalRowNum={globalRowNum}
                                  isSelected={row.id === selectedRowId}
                                  isEven={globalRowNum % 2 === 0}
                                  isDimmed={filteredIds !== null && !filteredIds.has(row.id)}
                                  lang={lang}
                                  fmt={fmt}
                                  onSelect={() => setSelectedRowId(row.id === selectedRowId ? null : row.id)}
                                  onDelete={handleDelete}
                                  onDuplicate={handleDuplicateRow}
                                  onCellSave={handleCellSave}
                                  onContextMenu={handleRowCtxMenu}
                                />
                              );
                            })}
                          </SortableContext>
                        </Fragment>
                      );
                    })}
                  </tbody>
                </SortableContext>

              <tfoot>
                <tr>
                  <td colSpan={7} style={{ padding: "10px 12px", textAlign: "right", fontFamily: "var(--font-dm-sans)", fontSize: "0.8125rem", fontWeight: 600, color: CS.muted, background: "rgba(249,115,22,0.05)", borderTop: `1px solid rgba(249,115,22,0.2)` }}>
                    {lang === "es" ? "TOTAL DEL PRESUPUESTO" : "BUDGET TOTAL"}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", background: "rgba(249,115,22,0.05)", borderTop: `1px solid rgba(249,115,22,0.2)` }}>
                    <span className="font-syne font-bold text-lg" style={{ color: CS.accent }}>
                      {fmt(filteredIds !== null
                        ? filteredRows.reduce((s, r) => s + (r.total ?? r.quantity * r.unit_price), 0)
                        : grandTotal)}
                    </span>
                    {filteredIds !== null && (
                      <span className="ml-2 text-xs font-dm-sans" style={{ color: CS.muted, opacity: 0.7 }}>
                        / {fmt(grandTotal)}
                      </span>
                    )}
                  </td>
                  <td colSpan={3} style={{ background: "rgba(249,115,22,0.05)", borderTop: `1px solid rgba(249,115,22,0.2)` }} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        </DndContext>
      )}

      {/* ── APU Detail Panel ───────────────────────────────── */}
      {selectedRowId && selectedRow && (
        <APUDetailPanel
          row={selectedRow}
          apuItem={linkedApuItem}
          language={lang}
          fmt={fmt}
          onClose={() => setSelectedRowId(null)}
          onNavigateToImport={() => { setSelectedRowId(null); setShowImport(true); }}
        />
      )}

      {/* ── Row context menu ───────────────────────────────────── */}
      {rowContextMenu && (() => {
        const targetRow = rows.find((r) => r.id === rowContextMenu.rowId);
        if (!targetRow) return null;
        return (
          <RowContextMenu
            menu={rowContextMenu}
            sections={sections}
            currentSection={targetRow.section}
            language={lang}
            onClose={() => setRowContextMenu(null)}
            onMoveToSection={(sec) => handleMoveRowToSection(rowContextMenu.rowId, sec)}
            onDuplicate={() => handleDuplicateRow(targetRow)}
            onDelete={() => handleDelete(rowContextMenu.rowId)}
          />
        );
      })()}

      {/* ── Chapter context menu ────────────────────────────── */}
      {contextMenu && (
        <ChapterContextMenu
          menu={contextMenu}
          language={lang}
          clipboard={clipboard}
          onClose={() => setContextMenu(null)}
          onAddActivities={() => { setAddActivitiesSection(contextMenu.section); setContextMenu(null); }}
          onNewGroup={() => { setNewGroupModal(true); setContextMenu(null); }}
          onEdit={() => { setEditingSection(contextMenu.section); setEditSectionDraft(contextMenu.section); setContextMenu(null); }}
          onCopy={() => handleCopySection(contextMenu.section)}
          onPaste={() => handlePasteSection(contextMenu.section)}
          onApproveAll={() => handleApproveSection(contextMenu.section)}
          onDelete={() => { setDeleteConfirm(contextMenu.section); setContextMenu(null); }}
        />
      )}

      {/* ── Delete chapter confirmation ─────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
          <div className="flex flex-col gap-4 p-6 rounded-2xl" style={{ background: CS.surface, border: `1px solid ${CS.border}`, maxWidth: 380, width: "100%" }}>
            <div className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" style={{ color: "#ef4444" }} />
              <span className="font-syne font-bold text-base" style={{ color: CS.text }}>{lang === "es" ? "Eliminar capítulo" : "Delete chapter"}</span>
            </div>
            <p className="text-sm font-dm-sans" style={{ color: CS.muted }}>
              {lang === "es"
                ? `¿Eliminar "${deleteConfirm}" y todas sus partidas? Esta acción no se puede deshacer.`
                : `Delete "${deleteConfirm}" and all its rows? This cannot be undone.`}
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-[10px] text-sm font-medium font-dm-sans"
                style={{ border: `1px solid ${CS.border}`, background: "transparent", color: CS.muted, cursor: "pointer" }}>
                {lang === "es" ? "Cancelar" : "Cancel"}
              </button>
              <button onClick={() => handleDeleteSection(deleteConfirm!)} className="px-4 py-2 rounded-[10px] text-sm font-semibold font-dm-sans"
                style={{ background: "#ef4444", color: "#fff", border: "none", cursor: "pointer" }}>
                {lang === "es" ? "Eliminar" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete row confirmation ────────────────────────── */}
      {deleteRowConfirm && (() => {
        const targetRow = rows.find((r) => r.id === deleteRowConfirm);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
            <div className="flex flex-col gap-4 p-6 rounded-2xl" style={{ background: CS.surface, border: `1px solid ${CS.border}`, maxWidth: 380, width: "100%" }}>
              <div className="flex items-center gap-2">
                <Trash2 className="h-5 w-5" style={{ color: "#ef4444" }} />
                <span className="font-syne font-bold text-base" style={{ color: CS.text }}>{lang === "es" ? "Eliminar partida" : "Delete row"}</span>
              </div>
              <p className="text-sm font-dm-sans" style={{ color: CS.muted }}>
                {lang === "es"
                  ? `¿Eliminar "${targetRow?.description ?? targetRow?.code ?? "esta partida"}"? Esta acción no se puede deshacer.`
                  : `Delete "${targetRow?.description ?? targetRow?.code ?? "this row"}"? This cannot be undone.`}
              </p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setDeleteRowConfirm(null)} className="px-4 py-2 rounded-[10px] text-sm font-medium font-dm-sans"
                  style={{ border: `1px solid ${CS.border}`, background: "transparent", color: CS.muted, cursor: "pointer" }}>
                  {lang === "es" ? "Cancelar" : "Cancel"}
                </button>
                <button onClick={() => confirmDeleteRow(deleteRowConfirm!)} className="px-4 py-2 rounded-[10px] text-sm font-semibold font-dm-sans"
                  style={{ background: "#ef4444", color: "#fff", border: "none", cursor: "pointer" }}>
                  {lang === "es" ? "Eliminar" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── New Group modal ─────────────────────────────────── */}
      {newGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
          <div className="flex flex-col gap-4 p-6 rounded-2xl" style={{ background: CS.surface, border: `1px solid ${CS.border}`, maxWidth: 400, width: "100%" }}>
            <span className="font-syne font-bold text-base" style={{ color: CS.text }}>{lang === "es" ? "Nuevo grupo / capítulo" : "New group / chapter"}</span>
            <input autoFocus value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="01 · TRABAJOS PRELIMINARES"
              onKeyDown={(e) => { if (e.key === "Enter") handleNewGroup(); if (e.key === "Escape") setNewGroupModal(false); }}
              className="text-sm font-dm-sans px-3 py-2 rounded-lg"
              style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${CS.border}`, color: CS.text, outline: "none" }} />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setNewGroupModal(false)} className="px-4 py-2 rounded-[10px] text-sm font-medium font-dm-sans"
                style={{ border: `1px solid ${CS.border}`, background: "transparent", color: CS.muted, cursor: "pointer" }}>{lang === "es" ? "Cancelar" : "Cancel"}</button>
              <button onClick={handleNewGroup} disabled={!newGroupName.trim()} className="px-4 py-2 rounded-[10px] text-sm font-semibold font-dm-sans"
                style={{ background: CS.accent, color: "#fff", border: "none", cursor: !newGroupName.trim() ? "not-allowed" : "pointer", opacity: !newGroupName.trim() ? 0.5 : 1 }}>
                {lang === "es" ? "Crear" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Activities Modal ────────────────────────────── */}
      {addActivitiesSection && (
        <AddActivitiesModal
          projectId={projectId}
          language={lang}
          apuItems={apuItems}
          targetSection={addActivitiesSection}
          rowCount={rows.length}
          onSaved={(newRows) => {
            setRows((prev) => [...prev, ...newRows]);
            // DB trigger creates gantt tasks
          }}
          onClose={() => setAddActivitiesSection(null)}
          onCreateNew={() => { setAddActivitiesSection(null); setActiveTab("apu"); }}
        />
      )}

      {/* ── Add item modal ──────────────────────────────────── */}
      {showAdd && (
        <AddItemModal
          projectId={projectId} language={lang}
          sections={sections.length > 0 ? sections : []}
          rowCount={rows.length} fmt={fmt}
          prefill={addPrefill ?? undefined}
          onSaved={(row) => {
            setRows((p) => [...p, row]);
            // DB trigger creates gantt task
          }}
          onClose={() => { setShowAdd(false); setAddPrefill(null); }}
        />
      )}

      {/* ── Paste Excel modal ───────────────────────────────── */}
      {showPaste && (
        <PasteBudgetModal
          projectId={projectId} language={lang}
          sections={sections.length > 0 ? sections : [lang === "es" ? "General" : "General"]}
          rowCount={rows.length}
          onSaved={handlePasteImport}
          onClose={() => setShowPaste(false)}
        />
      )}

      {/* ── Import APU modal ────────────────────────────────── */}
      {showImport && (
        <ImportAPUModal
          projectId={projectId} language={lang}
          sections={sections.length > 0 ? sections : []}
          rowCount={rows.length}
          onSaved={(row) => {
            setRows((p) => [...p, row]);
            // DB trigger creates gantt task
          }}
          onClose={() => setShowImport(false)}
        />
      )}

      {/* ── APU Library modal ──────────────────────────────── */}
      <APULibraryModal
        isOpen={showAPULibrary}
        onClose={() => setShowAPULibrary(false)}
        projectId={projectId}
        budgetId={projectId}
        userId={userId}
        onSuccess={() => {
          refetchBudgetRows();
        }}
      />

      {/* ── Library modal ───────────────────────────────────── */}
      {showLibrary && (
        <BudgetLibraryModal
          language={lang}
          onInsert={(entry) => {
            setAddPrefill({ name: entry.name, unit: entry.unit, unit_price: entry.unit_price });
            setShowLibrary(false);
            setShowAdd(true);
          }}
          onClose={() => setShowLibrary(false)}
        />
      )}
    </div>
    </>
  );
}

// ─── ImportAPUModal (retained from original) ─────────────────────────────────

function ImportAPUModal({ projectId, language, sections, rowCount, onSaved, onClose }:
  { projectId: string; language: Locale; sections: string[]; rowCount: number;
    onSaved: (row: BudgetRow) => void; onClose: () => void }
) {
  const supabase = createClient();
  const [apuItems, setApuItems] = useState<ApuItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [query, setQuery]       = useState("");
  const [section, setSection]   = useState(sections[0] ?? "");
  const [newSec, setNewSec]     = useState("");
  const [importing, setImporting] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("apu_items").select("*").eq("project_id", projectId).order("code")
      .then(({ data }) => { setApuItems((data as ApuItem[]) ?? []); setLoading(false); });
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const effectiveSec = section === "__new__" ? newSec.trim() : section.trim();
  const filtered = apuItems.filter((a) =>
    a.description.toLowerCase().includes(query.toLowerCase()) || a.code.toLowerCase().includes(query.toLowerCase())
  );

  async function handleImport(apu: ApuItem) {
    if (!effectiveSec) return;
    setImporting(apu.id);
    const payload: BudgetRowInsert = {
      project_id: projectId, apu_item_id: apu.id, section: effectiveSec,
      code: apu.code, description: apu.description, unit: apu.unit,
      quantity: 0, unit_price: apu.selling_price, status: "pending", sort_order: rowCount,
    };
    const { data, error } = await supabase.from("budget_rows").insert(payload).select().single();
    setImporting(null);
    if (!error && data) { onSaved(data as BudgetRow); onClose(); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full flex flex-col" style={{ maxWidth: 560, maxHeight: "85vh", background: CS.surface, border: `1px solid ${CS.border}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}>
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: `1px solid ${CS.border}` }}>
          <div className="flex items-center gap-2">
            <Import className="h-4 w-4" style={{ color: CS.accent }} />
            <span className="font-syne font-bold text-base" style={{ color: CS.text }}>{language === "es" ? "Importar desde APU" : "Import from APU"}</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: CS.muted }}><X className="h-4 w-4" /></button>
        </div>
        <div className="px-5 py-3 shrink-0" style={{ borderBottom: `1px solid ${CS.border}` }}>
          <label style={{ ...LBL, marginBottom: 6 }}>{language === "es" ? "Insertar en sección:" : "Insert into section:"}</label>
          {section === "__new__" ? (
            <div className="flex gap-2 items-center">
              <input style={{ ...FIELD, flex: 1 }} value={newSec} onChange={(e) => setNewSec(e.target.value)} placeholder={language === "es" ? "ej. 01 · TRABAJOS PRELIMINARES" : "e.g. 01 · PRELIMINARY WORKS"} autoFocus />
              <button onClick={() => { setSection(sections[0] ?? ""); setNewSec(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: CS.accent, fontSize: "0.75rem", fontFamily: "var(--font-dm-sans)", whiteSpace: "nowrap" }}>← {language === "es" ? "volver" : "back"}</button>
            </div>
          ) : (
            <select style={FIELD} value={section} onChange={(e) => setSection(e.target.value)}>
              {sections.map((s) => <option key={s} value={s}>{s}</option>)}
              <option value="__new__">{language === "es" ? "+ Nueva sección..." : "+ New section..."}</option>
            </select>
          )}
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 shrink-0" style={{ borderBottom: `1px solid ${CS.border}`, background: "rgba(255,255,255,0.02)" }}>
          <Search className="h-3.5 w-3.5 shrink-0" style={{ color: CS.muted }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={language === "es" ? "Buscar concepto o código..." : "Search..."}
            className="flex-1 bg-transparent text-sm font-dm-sans outline-none" style={{ color: CS.text }} />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" style={{ color: CS.muted }} /></div>
            : filtered.length === 0 ? <p className="text-center py-10 text-sm font-dm-sans" style={{ color: CS.muted }}>{language === "es" ? "Sin resultados." : "No results."}</p>
            : <table className="w-full text-sm font-dm-sans"><thead className="sticky top-0" style={{ background: CS.surface }}><tr style={{ borderBottom: `1px solid ${CS.border}` }}>
              <th className="text-left px-4 py-2 text-xs font-semibold" style={{ color: CS.muted, width: 70 }}>Código</th>
              <th className="text-left px-2 py-2 text-xs font-semibold" style={{ color: CS.muted }}>Descripción</th>
              <th className="text-right px-4 py-2 text-xs font-semibold w-28" style={{ color: CS.muted }}>P. Venta</th>
            </tr></thead><tbody>{filtered.map((apu) => (
              <tr key={apu.id} className="group cursor-pointer" style={{ borderBottom: `1px solid ${CS.border}` }} onClick={() => handleImport(apu)}>
                <td className="px-4 py-2.5"><code className="text-xs font-mono" style={{ color: CS.accent }}>{apu.code}</code></td>
                <td className="px-2 py-2.5" style={{ color: CS.text }}>{importing === apu.id ? <span className="flex items-center gap-1.5" style={{ color: CS.accent }}><Loader2 className="h-3 w-3 animate-spin" />{language === "es" ? "Insertando..." : "Inserting..."}</span> : apu.description}</td>
                <td className="px-4 py-2.5 text-right font-semibold" style={{ color: CS.accent }}>{apu.selling_price.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
              </tr>))}</tbody></table>}
        </div>
        <div className="px-4 py-2.5 text-xs font-dm-sans shrink-0" style={{ color: CS.muted, borderTop: `1px solid ${CS.border}`, background: "rgba(255,255,255,0.02)" }}>
          {language === "es" ? "Haz clic en un APU para insertarlo. La cantidad quedará en 0." : "Click an APU to insert it. Quantity will be 0."}
        </div>
      </div>
    </div>
  );
}

