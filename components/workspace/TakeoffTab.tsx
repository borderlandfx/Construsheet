"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Plus, Trash2, Loader2, X, Download, ArrowRight, GripVertical, ClipboardPaste, FileText, Search } from "lucide-react";
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
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/context/WorkspaceContext";
import { t } from "@/lib/utils/i18n";
import { useToast } from "@/lib/context/ToastContext";
import type { TakeoffItem, TakeoffItemInsert } from "@/lib/types/database.types";
import type { Locale } from "@/lib/utils/i18n";

// ─── Design tokens ────────────────────────────────────────────────────────────

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

// ─── Add Element Modal ────────────────────────────────────────────────────────

interface AddElementModalProps {
  projectId: string;
  language: Locale;
  itemCount: number;
  onSaved: (item: TakeoffItem) => void;
  onClose: () => void;
}

function AddElementModal({ projectId, language, itemCount, onSaved, onClose }: AddElementModalProps) {
  const supabase = createClient();
  const [saving, setSaving]           = useState(false);
  const [savedCount, setSavedCount]   = useState(0);
  const elementRef                    = useRef<HTMLInputElement>(null);
  const [element, setElement]         = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit]               = useState("");
  const [quantity, setQuantity]       = useState("");
  const [notes, setNotes]             = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const [qtyPreview, setQtyPreview] = useState<number | null>(null);

  function resetFields() {
    setElement(""); setDescription(""); setUnit(""); setQuantity(""); setNotes(""); setQtyPreview(null);
    setTimeout(() => elementRef.current?.focus(), 50);
  }

  async function handleSave(andAnother = false) {
    if (!element.trim()) return;
    setSaving(true);
    const resolvedQty = safeEval(quantity) ?? (parseFloat(quantity) || 0);
    const payload: TakeoffItemInsert = {
      project_id:  projectId,
      element:     element.trim(),
      description: description.trim() || null,
      unit:        unit.trim() || null,
      quantity:    resolvedQty,
      notes:       notes.trim() || null,
      sort_order:  itemCount + savedCount,
    };
    const { data, error } = await supabase
      .from("takeoff_items")
      .insert(payload)
      .select()
      .single();
    setSaving(false);
    if (!error && data) {
      onSaved(data as TakeoffItem);
      if (andAnother) { setSavedCount((c) => c + 1); resetFields(); }
      else onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full flex flex-col gap-4 overflow-y-auto"
        style={{
          maxWidth: 520, maxHeight: "90vh",
          background: CS.surface,
          border: `1px solid ${CS.border}`,
          borderRadius: 16, padding: "1.5rem",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-syne font-bold text-base" style={{ color: CS.text }}>
              {language === "es" ? "Nuevo Elemento" : "New Element"}
            </span>
            {savedCount > 0 && (
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: CS.accent + "22", color: CS.accent }}
              >
                {savedCount} {language === "es" ? "guardados" : "saved"}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: CS.muted }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div>
          <label style={LBL}>{language === "es" ? "Elemento *" : "Element *"}</label>
          <input
            ref={elementRef}
            style={FIELD}
            value={element}
            onChange={(e) => setElement(e.target.value)}
            placeholder={language === "es" ? "Ej: Losa de concreto, Columna C1..." : "E.g: Concrete slab, Column C1..."}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.ctrlKey) handleSave(true);
              else if (e.key === "Enter") handleSave(false);
            }}
          />
        </div>

        <div>
          <label style={LBL}>{language === "es" ? "Descripción" : "Description"}</label>
          <input
            style={FIELD}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={language === "es" ? "Detalle adicional..." : "Additional detail..."}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={LBL}>{language === "es" ? "Unidad" : "Unit"}</label>
            <input
              style={FIELD}
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="m², m³, ml..."
            />
          </div>
          <div>
            <label style={LBL}>
              {language === "es" ? "Cantidad" : "Quantity"}
              {qtyPreview !== null && /[+\-*/×÷(]/.test(quantity) && (
                <span style={{ marginLeft: 6, color: CS.accent, fontWeight: 700 }}>
                  = {qtyPreview.toLocaleString()}
                </span>
              )}
            </label>
            <input
              style={FIELD}
              type="text"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => {
                setQuantity(e.target.value);
                setQtyPreview(safeEval(e.target.value));
              }}
              placeholder={language === "es" ? "ej: 5.5 × 4 × 2" : "e.g. 5.5 × 4 × 2"}
            />
          </div>
        </div>

        <div>
          <label style={LBL}>{language === "es" ? "Notas" : "Notes"}</label>
          <input
            style={FIELD}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={language === "es" ? "Observaciones..." : "Observations..."}
          />
        </div>

        <div className="flex gap-2 justify-end shrink-0 flex-wrap">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-[10px] text-sm font-medium font-dm-sans"
            style={{ border: `1px solid ${CS.border}`, background: "transparent", color: CS.muted, cursor: "pointer" }}
          >
            {savedCount > 0 ? (language === "es" ? "Listo" : "Done") : t("cancel", language)}
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving || !element.trim()}
            className="px-4 py-2 rounded-[10px] text-sm font-medium font-dm-sans"
            style={{
              border: `1px solid ${CS.accent}`, background: "transparent", color: CS.accent,
              cursor: saving || !element.trim() ? "not-allowed" : "pointer",
              opacity: saving || !element.trim() ? 0.5 : 1,
            }}
            title="Ctrl+Enter"
          >
            + {language === "es" ? "Guardar y agregar otro" : "Save & add another"}
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={saving || !element.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-semibold font-dm-sans"
            style={{
              background: CS.accent, color: "#fff", border: "none",
              cursor: saving || !element.trim() ? "not-allowed" : "pointer",
              opacity: saving || !element.trim() ? 0.6 : 1,
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

// ─── Confirm Clear Modal ──────────────────────────────────────────────────────

interface ConfirmClearModalProps {
  language: Locale;
  count: number;
  onConfirm: () => void;
  onClose: () => void;
}

function ConfirmClearModal({ language, count, onConfirm, onClose }: ConfirmClearModalProps) {
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
        className="w-full flex flex-col gap-4"
        style={{
          maxWidth: 400,
          background: CS.surface,
          border: `1px solid ${CS.border}`,
          borderRadius: 16, padding: "1.5rem",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        <div className="flex items-center justify-between">
          <span className="font-syne font-bold text-base" style={{ color: CS.text }}>
            {language === "es" ? "¿Limpiar tabla?" : "Clear table?"}
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: CS.muted }}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm font-dm-sans" style={{ color: CS.muted }}>
          {language === "es"
            ? `Se eliminarán los ${count} elementos del cubicaje. Esta acción no se puede deshacer.`
            : `This will permanently delete all ${count} takeoff elements. This cannot be undone.`}
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-[10px] text-sm font-medium font-dm-sans"
            style={{ border: `1px solid ${CS.border}`, background: "transparent", color: CS.muted, cursor: "pointer" }}
          >
            {language === "es" ? "Cancelar" : "Cancel"}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-[10px] text-sm font-semibold font-dm-sans"
            style={{ background: "#ef4444", color: "#fff", border: "none", cursor: "pointer" }}
          >
            {language === "es" ? "Sí, limpiar" : "Yes, clear"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Safe math expression evaluator ──────────────────────────────────────────

function safeEval(expr: string): number | null {
  // Replace common alternate symbols
  const cleaned = expr
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/,/g, ".")
    .trim();
  // Only allow digits, whitespace, and math operators/parens
  if (!/^[\d\s+\-*/^.()\n]+$/.test(cleaned)) return null;
  if (cleaned === "" || cleaned === "0") return 0;
  try {
    // eslint-disable-next-line no-new-func
    const result = new Function(`"use strict"; return (${cleaned})`)() as unknown;
    if (typeof result !== "number" || !isFinite(result) || result < 0) return null;
    return Math.round(result * 1000) / 1000;
  } catch {
    return null;
  }
}

// ─── InlineCell ───────────────────────────────────────────────────────────────

type TakeoffField = "element" | "description" | "unit" | "quantity" | "notes";

function InlineCell({
  field, displayValue, rawValue, onSave,
}: {
  field: TakeoffField;
  displayValue: string;
  rawValue: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(rawValue);
  const [preview, setPreview] = useState<number | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  function start() {
    setDraft(rawValue);
    setPreview(null);
    setEditing(true);
    setTimeout(() => { ref.current?.focus(); ref.current?.select(); }, 0);
  }

  function commit() {
    if (field === "quantity") {
      const evaled = safeEval(draft);
      onSave(evaled !== null ? String(evaled) : (parseFloat(draft) || 0).toString());
    } else {
      onSave(draft);
    }
    setEditing(false);
    setPreview(null);
  }

  function handleChange(val: string) {
    setDraft(val);
    if (field === "quantity") {
      setPreview(safeEval(val));
    }
  }

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.06)",
    border: `1px solid ${CS.accent}`,
    borderRadius: 4, color: CS.text,
    fontFamily: "var(--font-dm-sans)",
    fontSize: "0.8125rem", outline: "none",
    width: "100%", padding: "1px 4px",
  };

  if (editing && field === "quantity") {
    const isFormula = /[+\-*/×÷(]/.test(draft);
    return (
      <div style={{ position: "relative" }}>
        <input
          ref={ref}
          value={draft}
          type="text"
          inputMode="decimal"
          onChange={(e) => handleChange(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          placeholder="ej: 5.5 × 4 × 2"
          style={{ ...inputStyle, minWidth: 140 }}
        />
        {isFormula && preview !== null && (
          <span
            style={{
              position: "absolute",
              right: 4, top: "50%", transform: "translateY(-50%)",
              fontSize: "0.7rem", fontWeight: 700,
              color: CS.accent, pointerEvents: "none",
            }}
          >
            = {preview.toLocaleString()}
          </span>
        )}
      </div>
    );
  }

  if (editing) {
    return (
      <input
        ref={ref}
        value={draft}
        type="text"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        style={inputStyle}
      />
    );
  }
  return (
    <span
      onDoubleClick={start}
      title={field === "quantity" ? "Double-click to edit (supports formulas like 5×4×3)" : "Double-click to edit"}
      style={{ cursor: "default", minWidth: 20, display: "inline-block" }}
    >
      {displayValue}
    </span>
  );
}

// ─── SortableTakeoffRow ───────────────────────────────────────────────────────

interface SortableTakeoffRowProps {
  item: TakeoffItem;
  idx: number;
  lang: Locale;
  onCellSave: (id: string, field: TakeoffField, raw: string) => void;
  onDelete: (id: string) => void;
  onSendToBudget: (item: TakeoffItem) => void;
}

function SortableTakeoffRow({ item, idx, lang, onCellSave, onDelete, onSendToBudget }: SortableTakeoffRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const rowStyle: React.CSSProperties = {
    borderBottom: `1px solid ${CS.border}`,
    background: isDragging
      ? "rgba(249,115,22,0.06)"
      : idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
    transform: CSS.Transform.toString(transform),
    transition: transition ?? undefined,
    opacity: isDragging ? 0.75 : 1,
    position: "relative" as const,
    zIndex: isDragging ? 10 : "auto" as const,
  };

  return (
    <tr ref={setNodeRef} style={rowStyle} className="group">
      {/* Drag handle */}
      <td style={{ padding: "7px 6px", textAlign: "center", width: 28 }}>
        <button
          type="button"
          {...attributes}
          {...listeners}
          style={{
            background: "none",
            border: "none",
            cursor: "grab",
            color: CS.muted,
            padding: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 4,
            opacity: 0.4,
          }}
          className="group-hover:opacity-100 transition-opacity"
          aria-label={lang === "es" ? "Arrastrar para reordenar" : "Drag to reorder"}
          tabIndex={-1}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      </td>
      {/* # */}
      <td style={{ padding: "7px 10px", textAlign: "center", fontSize: "0.7rem", color: CS.muted, width: 36 }}>
        {idx + 1}
      </td>
      {/* Element */}
      <td style={{ padding: "7px 10px", color: CS.text, fontSize: "0.8125rem", fontWeight: 500 }}>
        <InlineCell field="element" rawValue={item.element} displayValue={item.element}
          onSave={(v) => onCellSave(item.id, "element", v)} />
      </td>
      {/* Description */}
      <td style={{ padding: "7px 10px", color: CS.muted, fontSize: "0.8125rem" }}>
        <InlineCell field="description" rawValue={item.description ?? ""} displayValue={item.description ?? "—"}
          onSave={(v) => onCellSave(item.id, "description", v)} />
      </td>
      {/* Unit */}
      <td style={{ padding: "7px 10px", color: CS.muted, fontSize: "0.8125rem" }}>
        <InlineCell field="unit" rawValue={item.unit ?? ""} displayValue={item.unit ?? "—"}
          onSave={(v) => onCellSave(item.id, "unit", v)} />
      </td>
      {/* Quantity */}
      <td style={{ padding: "7px 10px", textAlign: "right", fontSize: "0.8125rem", color: CS.text, fontWeight: 600 }}>
        <InlineCell field="quantity" rawValue={String(item.quantity)}
          displayValue={item.quantity.toLocaleString()}
          onSave={(v) => onCellSave(item.id, "quantity", v)} />
      </td>
      {/* Notes */}
      <td style={{ padding: "7px 10px", color: CS.muted, fontSize: "0.8125rem" }}>
        <InlineCell field="notes" rawValue={item.notes ?? ""} displayValue={item.notes ?? "—"}
          onSave={(v) => onCellSave(item.id, "notes", v)} />
      </td>
      {/* Actions */}
      <td style={{ padding: "7px 8px" }}>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => onSendToBudget(item)}
            className="flex items-center gap-1 rounded px-1.5 py-1"
            style={{
              background: "rgba(249,115,22,0.1)",
              border: "1px solid rgba(249,115,22,0.25)",
              cursor: "pointer",
              color: CS.accent,
              fontSize: "0.65rem",
              fontWeight: 600,
              fontFamily: "var(--font-dm-sans)",
              whiteSpace: "nowrap",
            }}
            title={lang === "es" ? "Enviar al presupuesto" : "Send to budget"}
          >
            <ArrowRight className="h-3 w-3" />
            {lang === "es" ? "Presupuesto" : "Budget"}
          </button>
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="flex items-center justify-center rounded"
            style={{
              width: 26, height: 26,
              background: "none", border: "none",
              cursor: "pointer", color: "#ef4444",
            }}
            aria-label={lang === "es" ? "Eliminar elemento" : "Delete element"}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── PasteImportModal ─────────────────────────────────────────────────────────

interface PasteImportModalProps {
  projectId: string;
  language: Locale;
  startOrder: number;
  onSaved: (items: TakeoffItem[]) => void;
  onClose: () => void;
}

function PasteImportModal({ projectId, language, startOrder, onSaved, onClose }: PasteImportModalProps) {
  const supabase = createClient();
  const [raw, setRaw] = useState("");
  const [hasHeader, setHasHeader] = useState(true);
  const [saving, setSaving] = useState(false);
  const lang = language;

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
      const rawQty = (cols[3] ?? "").replace(/,/g, ".").trim();
      return {
        element:     cols[0]?.trim() ?? "",
        description: cols[1]?.trim() || null,
        unit:        cols[2]?.trim() || null,
        quantity:    parseFloat(rawQty) || 0,
        notes:       cols[4]?.trim() || null,
      };
    }).filter((r) => r.element);
  }, [raw, hasHeader]);

  async function handleImport() {
    if (!parsed.length) return;
    setSaving(true);
    const payloads: TakeoffItemInsert[] = parsed.map((row, i) => ({
      project_id:  projectId,
      element:     row.element,
      description: row.description,
      unit:        row.unit,
      quantity:    row.quantity,
      notes:       row.notes,
      sort_order:  startOrder + i,
    }));
    const { data, error } = await supabase.from("takeoff_items").insert(payloads).select();
    setSaving(false);
    if (!error && data) { onSaved(data as TakeoffItem[]); onClose(); }
  }

  const preview = parsed.slice(0, 15);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full flex flex-col gap-4"
        style={{
          maxWidth: 640, maxHeight: "90vh",
          background: CS.surface, border: `1px solid ${CS.border}`,
          borderRadius: 16, padding: "1.5rem",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between shrink-0 gap-3">
          <div>
            <span className="font-syne font-bold text-base" style={{ color: CS.text }}>
              {lang === "es" ? "Pegar desde Excel" : "Paste from Excel"}
            </span>
            <p className="text-xs font-dm-sans mt-0.5" style={{ color: CS.muted }}>
              {lang === "es"
                ? "Copia celdas y pega aquí. Columnas esperadas: Elemento · Descripción · Unidad · Cantidad · Notas"
                : "Copy cells and paste here. Expected columns: Element · Description · Unit · Quantity · Notes"}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: CS.muted, flexShrink: 0 }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Textarea */}
        <textarea
          autoFocus
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={lang === "es" ? "Pega aquí el contenido de Excel (Ctrl+V)…" : "Paste Excel content here (Ctrl+V)…"}
          rows={6}
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
        <label
          className="flex items-center gap-2 text-sm font-dm-sans shrink-0"
          style={{ color: CS.muted, cursor: "pointer" }}
        >
          <input
            type="checkbox"
            checked={hasHeader}
            onChange={(e) => setHasHeader(e.target.checked)}
            style={{ accentColor: CS.accent, cursor: "pointer" }}
          />
          {lang === "es" ? "La primera fila es encabezado (ignorar)" : "First row is a header (skip it)"}
        </label>

        {/* Preview table */}
        {parsed.length > 0 && (
          <div className="flex-1 overflow-y-auto min-h-0">
            <p className="text-xs font-dm-sans font-semibold mb-2" style={{ color: CS.muted }}>
              {lang === "es"
                ? `Vista previa — ${parsed.length} fila${parsed.length !== 1 ? "s" : ""} detectada${parsed.length !== 1 ? "s" : ""}:`
                : `Preview — ${parsed.length} row${parsed.length !== 1 ? "s" : ""} detected:`}
            </p>
            <div className="rounded-[8px] overflow-hidden" style={{ border: `1px solid ${CS.border}` }}>
              <table className="w-full text-xs font-dm-sans">
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: `1px solid ${CS.border}` }}>
                    {(["#",
                      lang === "es" ? "Elemento" : "Element",
                      lang === "es" ? "Unidad" : "Unit",
                      lang === "es" ? "Cantidad" : "Qty",
                    ] as string[]).map((h) => (
                      <th key={h} className="px-3 py-2 text-left"
                        style={{ color: CS.muted, fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} style={{
                      borderBottom: `1px solid ${CS.border}`,
                      background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
                    }}>
                      <td className="px-3 py-1.5" style={{ color: CS.muted, width: 30 }}>{i + 1}</td>
                      <td className="px-3 py-1.5" style={{ color: CS.text }}>{row.element}</td>
                      <td className="px-3 py-1.5" style={{ color: CS.muted }}>{row.unit ?? "—"}</td>
                      <td className="px-3 py-1.5 text-right font-semibold"
                        style={{ color: row.quantity > 0 ? CS.accent : CS.muted }}>
                        {row.quantity.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {parsed.length > 15 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-center"
                        style={{ color: CS.muted, fontSize: "0.7rem" }}>
                        {lang === "es" ? `… y ${parsed.length - 15} más` : `… and ${parsed.length - 15} more`}
                      </td>
                    </tr>
                  )}
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
            {lang === "es" ? "Cancelar" : "Cancel"}
          </button>
          <button onClick={handleImport} disabled={saving || parsed.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-semibold font-dm-sans"
            style={{
              background: CS.accent, color: "#fff", border: "none",
              cursor: saving || parsed.length === 0 ? "not-allowed" : "pointer",
              opacity: saving || parsed.length === 0 ? 0.5 : 1,
            }}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {lang === "es"
              ? `Importar ${parsed.length} fila${parsed.length !== 1 ? "s" : ""}`
              : `Import ${parsed.length} row${parsed.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TakeoffTab ───────────────────────────────────────────────────────────────

interface TakeoffTabProps {
  initialItems: TakeoffItem[];
  onCountChange?: (n: number) => void;
}

export default function TakeoffTab({ initialItems, onCountChange }: TakeoffTabProps) {
  const supabase = createClient();
  const { projectId, language, setActiveTab } = useWorkspace();
  const { toast } = useToast();
  const lang = language as Locale;

  const [items, setItems]               = useState<TakeoffItem[]>(initialItems);
  const [showAdd, setShowAdd]           = useState(false);
  const [showClear, setShowClear]       = useState(false);
  const [showPaste, setShowPaste]       = useState(false);
  const [_clearing, setClearing]         = useState(false);
  const [sendingAll, setSendingAll]     = useState(false);
  const [search, setSearch]             = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // ── Realtime ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase.channel(`takeoff:${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "takeoff_items", filter: `project_id=eq.${projectId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newItem = payload.new as TakeoffItem;
            setItems((prev) => {
              if (prev.some((i) => i.id === newItem.id)) return prev;
              toast(lang === "es" ? "Nuevo elemento en tiempo real" : "New element received", "info");
              return [...prev, newItem].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
            });
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as TakeoffItem;
            setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
          } else if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as { id: string }).id;
            setItems((prev) => prev.filter((i) => i.id !== deletedId));
          }
        }
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { onCountChange?.(items.length); }, [items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((i) => i.id === active.id);
    const newIdx = items.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(items, oldIdx, newIdx);
    setItems(reordered);
    await Promise.all(
      reordered.map((item, i) =>
        supabase.from("takeoff_items").update({ sort_order: i }).eq("id", item.id)
      )
    );
  }

  // Search filter
  const filteredItems = search.trim()
    ? items.filter((i) => {
        const q = search.toLowerCase();
        return (
          i.element.toLowerCase().includes(q) ||
          (i.description ?? "").toLowerCase().includes(q) ||
          (i.unit ?? "").toLowerCase().includes(q) ||
          (i.notes ?? "").toLowerCase().includes(q)
        );
      })
    : items;

  // Unit summary: aggregate quantities grouped by unit
  const unitSummary = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const item of items) {
      const u = (item.unit ?? "").trim() || (lang === "es" ? "(sin unidad)" : "(no unit)");
      const prev = map.get(u) ?? { total: 0, count: 0 };
      map.set(u, { total: prev.total + item.quantity, count: prev.count + 1 });
    }
    return Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [items, lang]);

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

  async function handleCellSave(id: string, field: TakeoffField, raw: string) {
    const value = field === "quantity" ? (parseFloat(raw) || 0) : (raw.trim() || null);
    setItems((prev) => prev.map((it) => it.id === id ? { ...it, [field]: value } : it));
    await supabase.from("takeoff_items").update({ [field]: value }).eq("id", id);
  }

  function handleDelete(id: string) {
    setDeleteConfirm(id);
  }

  async function confirmDelete(id: string) {
    setDeleteConfirm(null);
    setItems((prev) => prev.filter((i) => i.id !== id));
    await supabase.from("takeoff_items").delete().eq("id", id);
  }

  async function handleClearAll() {
    setClearing(true);
    await supabase.from("takeoff_items").delete().eq("project_id", projectId);
    setItems([]);
    setClearing(false);
    setShowClear(false);
  }

  function handleExportCSV() {
    const headers = [
      "#",
      lang === "es" ? "Elemento" : "Element",
      lang === "es" ? "Descripción" : "Description",
      lang === "es" ? "Unidad" : "Unit",
      lang === "es" ? "Cantidad" : "Quantity",
      lang === "es" ? "Notas" : "Notes",
    ];
    const rows = items.map((item, i) => [
      i + 1,
      item.element,
      item.description ?? "",
      item.unit ?? "",
      item.quantity,
      item.notes ?? "",
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `takeoff-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handlePrintTakeoff() {
    const win = window.open("", "_blank", "width=960,height=720,menubar=yes");
    if (!win) return;

    // Group by unit for summary footer
    const byUnit = items.reduce<Map<string, number>>((m, item) => {
      const u = (item.unit ?? "").trim() || (lang === "es" ? "(sin unidad)" : "(no unit)");
      m.set(u, (m.get(u) ?? 0) + item.quantity);
      return m;
    }, new Map());
    const unitSummaryRows = Array.from(byUnit.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([u, total]) =>
        `<tr><td colspan="2" style="color:#6b7280">${u}</td><td style="text-align:right;font-weight:600;color:#f97316">${total.toLocaleString(undefined, { maximumFractionDigits: 3 })}</td><td></td><td></td></tr>`
      ).join("");

    const dataRows = items.map((item, i) =>
      `<tr>
        <td style="text-align:center;color:#6b7280">${i + 1}</td>
        <td style="font-weight:500">${item.element}</td>
        <td>${item.description ?? ""}</td>
        <td style="text-align:center;color:#6b7280">${item.unit ?? ""}</td>
        <td style="text-align:right;font-weight:600">${item.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
        <td style="color:#6b7280;font-size:10px">${item.notes ?? ""}</td>
      </tr>`
    ).join("");

    const totalQty = items.reduce((s, i) => s + i.quantity, 0);

    const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8"/>
  <title>${lang === "es" ? "Cubicación" : "Quantity Takeoff"} — ConstruSheet</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,-apple-system,sans-serif;font-size:11px;color:#111827;padding:24px}
    h1{font-size:18px;font-weight:700;margin-bottom:2px}
    h2{font-size:11px;font-weight:700;margin:16px 0 6px;color:#f97316;text-transform:uppercase;letter-spacing:.06em}
    .meta{font-size:10px;color:#6b7280;margin-bottom:14px}
    table{width:100%;border-collapse:collapse;font-size:10.5px}
    th{background:#f97316;color:#fff;padding:5px 7px;text-align:left;font-size:9.5px;font-weight:600;text-transform:uppercase}
    th:nth-child(1),th:nth-child(4),th:nth-child(5){text-align:center}
    td{padding:4px 7px;border-bottom:1px solid #f3f4f6;vertical-align:top}
    tr:nth-child(even) td{background:#f9fafb}
    .summary-hdr td{background:#fff7ed!important;font-weight:700;border-top:2px solid #fed7aa;color:#c2410c;font-size:9.5px;text-transform:uppercase;padding:5px 7px}
    .total-row td{background:#fff7ed!important;font-weight:700;border-top:2px solid #fed7aa}
    .footer{margin-top:14px;font-size:10px;color:#9ca3af;display:flex;justify-content:space-between}
    @media print{body{padding:12px}}
  </style>
</head>
<body>
  <h1>ConstruSheet — ${lang === "es" ? "Cubicación / Generadores de Cantidad" : "Quantity Takeoff"}</h1>
  <div class="meta">${lang === "es" ? "Generado" : "Generated"}: ${new Date().toLocaleDateString(lang === "es" ? "es-MX" : "en-US", { year: "numeric", month: "long", day: "numeric" })} &nbsp;·&nbsp; ${items.length} ${lang === "es" ? "elementos" : "elements"}</div>
  <table>
    <thead>
      <tr>
        <th style="width:28px">#</th>
        <th style="width:140px">${lang === "es" ? "Elemento" : "Element"}</th>
        <th>${lang === "es" ? "Descripción" : "Description"}</th>
        <th style="width:50px">${lang === "es" ? "Unidad" : "Unit"}</th>
        <th style="width:80px">${lang === "es" ? "Cantidad" : "Quantity"}</th>
        <th style="width:120px">${lang === "es" ? "Notas" : "Notes"}</th>
      </tr>
    </thead>
    <tbody>
      ${dataRows}
      <tr class="total-row">
        <td colspan="4" style="text-align:right;font-size:10px;color:#92400e;text-transform:uppercase">
          ${lang === "es" ? "Total de cantidades" : "Total quantities"}
        </td>
        <td style="text-align:right;font-size:13px;color:#f97316">${totalQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
        <td></td>
      </tr>
    </tbody>
  </table>

  ${byUnit.size > 1 ? `
  <h2>${lang === "es" ? "Resumen por unidad" : "Summary by unit"}</h2>
  <table>
    <thead>
      <tr>
        <th colspan="2">${lang === "es" ? "Unidad" : "Unit"}</th>
        <th style="text-align:right">${lang === "es" ? "Cant. total" : "Total qty"}</th>
        <th style="width:60px">${lang === "es" ? "Elementos" : "Elements"}</th>
        <th></th>
      </tr>
    </thead>
    <tbody>${unitSummaryRows}</tbody>
  </table>` : ""}

  <div class="footer"><span>ConstruSheet</span><span>${new Date().toISOString().slice(0, 10)}</span></div>
  <script>setTimeout(()=>{window.print();},400)<\/script>
</body>
</html>`;
    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  function handlePasteImport(newItems: TakeoffItem[]) {
    setItems((prev) => [...prev, ...newItems]);
    toast(
      lang === "es"
        ? `${newItems.length} elemento${newItems.length !== 1 ? "s" : ""} importado${newItems.length !== 1 ? "s" : ""}`
        : `${newItems.length} element${newItems.length !== 1 ? "s" : ""} imported`,
      "success"
    );
  }

  async function handleSendAllToBudget() {
    if (!items.length) return;
    setSendingAll(true);
    const section = lang === "es" ? "Cubicación" : "Takeoff";
    const { data: maxRow } = await supabase
      .from("budget_rows")
      .select("sort_order")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: false })
      .limit(1);
    const baseOrder = ((maxRow?.[0]?.sort_order ?? 0) as number) + 1;
    const payload = items.map((item, i) => ({
      project_id:  projectId,
      section,
      description: item.element,
      unit:        item.unit ?? null,
      quantity:    item.quantity,
      unit_price:  0,
      status:      "pending" as const,
      sort_order:  baseOrder + i,
    }));
    const { error } = await supabase.from("budget_rows").insert(payload);
    setSendingAll(false);
    if (!error) {
      toast(
        lang === "es"
          ? `${items.length} elementos enviados al presupuesto`
          : `${items.length} elements sent to budget`,
        "success"
      );
      setActiveTab("budget");
    }
  }

  async function handleSendToBudget(item: TakeoffItem) {
    const section = lang === "es" ? "Cubicación" : "Takeoff";
    const { data: maxRow } = await supabase
      .from("budget_rows")
      .select("sort_order")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: false })
      .limit(1);
    const nextOrder = ((maxRow?.[0]?.sort_order ?? 0) as number) + 1;
    const { error } = await supabase.from("budget_rows").insert({
      project_id:  projectId,
      section,
      description: item.element,
      unit:        item.unit ?? null,
      quantity:    item.quantity,
      unit_price:  0,
      status:      "pending" as const,
      sort_order:  nextOrder,
    });
    if (!error) {
      toast(
        lang === "es"
          ? `"${item.element}" agregado al presupuesto`
          : `"${item.element}" added to budget`,
        "success"
      );
      setActiveTab("budget");
    }
  }

  return (
    <>
    <ToolbarPortal>
      <ToolbarGroup label={lang === "es" ? "Exportar" : "Export"}>
        <TBtn onClick={handleExportCSV} disabled={items.length === 0}>
          <Download className="h-3.5 w-3.5" /> CSV
        </TBtn>
        <TBtn onClick={handlePrintTakeoff} disabled={items.length === 0}>
          <FileText className="h-3.5 w-3.5" /> PDF
        </TBtn>
      </ToolbarGroup>
      <ToolbarSep />
      <ToolbarGroup label={lang === "es" ? "Herramientas" : "Tools"}>
        <TBtn onClick={() => setShowPaste(true)}>
          <ClipboardPaste className="h-3.5 w-3.5" /> {lang === "es" ? "Importar cantidades" : "Import quantities"}
        </TBtn>
      </ToolbarGroup>
      <ToolbarSep />
      <TBtnPrimary onClick={() => setShowAdd(true)}>
        <Plus className="h-3.5 w-3.5" /> {lang === "es" ? "Nueva partida" : "New item"}
      </TBtnPrimary>
    </ToolbarPortal>
    <div className="flex flex-col gap-4">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-syne font-bold text-lg" style={{ color: CS.text }}>
            {lang === "es" ? "Cubicación / Cantidades" : "Quantity Takeoff"}
          </h2>
          <p className="text-xs font-dm-sans mt-0.5" style={{ color: CS.muted }}>
            {items.length} {lang === "es" ? "elementos" : "elements"}
            {items.length > 0 && (() => {
              const totalQty = items.reduce((s, i) => s + i.quantity, 0);
              const units = new Set(items.map((i) => (i.unit ?? "").trim()).filter(Boolean)).size;
              return (
                <>
                  {" · "}
                  <span style={{ color: CS.text, fontWeight: 600 }}>
                    {totalQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                  {" "}
                  {lang === "es" ? "cant. total" : "total qty"}
                  {units > 0 && ` · ${units} ${lang === "es" ? "unidades" : "units"}`}
                </>
              );
            })()}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          {items.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-[10px]"
              style={{ border: `1px solid ${CS.border}`, background: "transparent", minWidth: 180 }}>
              <Search className="h-3.5 w-3.5 shrink-0" style={{ color: CS.muted }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={lang === "es" ? "Buscar elementos..." : "Search elements..."}
                className="flex-1 bg-transparent text-sm font-dm-sans outline-none"
                style={{ color: CS.text, minWidth: 0 }}
              />
              {search && (
                <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: CS.muted, padding: 0, lineHeight: 1 }}>
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          {/* Send all to budget */}
          <button
            type="button"
            onClick={handleSendAllToBudget}
            disabled={items.length === 0 || sendingAll}
            aria-label={lang === "es" ? "Enviar todo al presupuesto" : "Send all to budget"}
            className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-sm font-medium font-dm-sans"
            style={{
              border: `1px solid ${items.length === 0 ? CS.border : "rgba(249,115,22,0.35)"}`,
              background: items.length === 0 ? "transparent" : "rgba(249,115,22,0.08)",
              color: items.length === 0 ? CS.muted : CS.accent,
              cursor: items.length === 0 || sendingAll ? "not-allowed" : "pointer",
              opacity: items.length === 0 ? 0.45 : 1,
            }}
            onMouseEnter={(e) => { if (items.length > 0 && !sendingAll) (e.currentTarget as HTMLButtonElement).style.background = "rgba(249,115,22,0.16)"; }}
            onMouseLeave={(e) => { if (items.length > 0) (e.currentTarget as HTMLButtonElement).style.background = "rgba(249,115,22,0.08)"; }}
          >
            {sendingAll
              ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
            {lang === "es" ? "Enviar todo" : "Send all"}
          </button>

          {/* Buttons moved to ContextualToolbar via portal */}
        </div>
      </div>

      {/* ── Empty state ──────────────────────────────────────── */}
      {items.length === 0 && (
        <div
          className="flex flex-col items-center justify-center py-20 rounded-[10px] text-center gap-4"
          style={{ border: `1.5px dashed ${CS.border}` }}
        >
          <p className="font-syne font-bold text-base" style={{ color: CS.text }}>
            {lang === "es" ? "Sin elementos de cubicación" : "No takeoff elements yet"}
          </p>
          <p className="text-sm font-dm-sans max-w-xs" style={{ color: CS.muted }}>
            {lang === "es"
              ? "Agrega elementos para calcular las cantidades de obra."
              : "Add elements to calculate project quantities."}
          </p>
          <div className="flex gap-2 flex-wrap justify-center">
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-semibold font-dm-sans"
              style={{ background: CS.accent, color: "#fff", border: "none", cursor: "pointer" }}
            >
              <Plus className="h-4 w-4" />
              {lang === "es" ? "Agregar primer elemento" : "Add first element"}
            </button>
            <button
              type="button"
              onClick={() => setShowPaste(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-medium font-dm-sans"
              style={{ border: `1px solid ${CS.border}`, background: "transparent", color: CS.muted, cursor: "pointer" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = CS.text)}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = CS.muted)}
            >
              <ClipboardPaste className="h-4 w-4" />
              {lang === "es" ? "Pegar desde Excel" : "Paste from Excel"}
            </button>
          </div>
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────── */}
      {items.length > 0 && (
        <div
          className="rounded-[10px] overflow-hidden"
          style={{ border: `1px solid ${CS.border}` }}
        >
          {filteredItems.length === 0 ? (
            <div className="flex items-center justify-center py-10 gap-2" style={{ color: CS.muted }}>
              <Search className="h-4 w-4" />
              <span className="text-sm font-dm-sans">
                {lang === "es" ? `Sin resultados para "${search}"` : `No results for "${search}"`}
              </span>
            </div>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full font-dm-sans" style={{ minWidth: 640 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 28, padding: "8px 6px" }} />
                  <th style={{ ...thStyle, width: 36, textAlign: "center" }}>#</th>
                  <th style={thStyle}>{lang === "es" ? "Elemento" : "Element"}</th>
                  <th style={thStyle}>{lang === "es" ? "Descripción" : "Description"}</th>
                  <th style={{ ...thStyle, width: 70 }}>{lang === "es" ? "Unidad" : "Unit"}</th>
                  <th style={{ ...thStyle, width: 100, textAlign: "right" }}>{lang === "es" ? "Cantidad" : "Quantity"}</th>
                  <th style={thStyle}>{lang === "es" ? "Notas" : "Notes"}</th>
                  <th style={{ ...thStyle, width: 80 }} />
                </tr>
              </thead>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={search ? () => {} : handleDragEnd}>
                <SortableContext items={filteredItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                  <tbody>
                    {filteredItems.map((item, idx) => (
                      <SortableTakeoffRow
                        key={item.id}
                        item={item}
                        idx={idx}
                        lang={lang}
                        onCellSave={handleCellSave}
                        onDelete={handleDelete}
                        onSendToBudget={handleSendToBudget}
                      />
                    ))}
                  </tbody>
                </SortableContext>
              </DndContext>

              <tfoot>
                <tr>
                  <td
                    colSpan={8}
                    style={{
                      padding: "8px 12px",
                      textAlign: "right",
                      fontFamily: "var(--font-dm-sans)",
                      fontSize: "0.75rem",
                      color: CS.muted,
                      background: "rgba(255,255,255,0.02)",
                      borderTop: `1px solid ${CS.border}`,
                    }}
                  >
                    {search
                      ? `${filteredItems.length} / ${items.length} ${lang === "es" ? "elementos" : "elements"}`
                      : `${items.length} ${lang === "es" ? "elementos en total" : "total elements"}`}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          )}
        </div>
      )}

      {/* ── Unit summary ─────────────────────────────────────── */}
      {items.length > 1 && unitSummary.length > 0 && (
        <div
          className="rounded-[10px] p-4"
          style={{ border: `1px solid ${CS.border}`, background: "rgba(255,255,255,0.015)" }}
        >
          <p className="text-xs font-syne font-bold uppercase tracking-wider mb-3" style={{ color: CS.muted }}>
            {lang === "es" ? "Resumen por unidad" : "Summary by unit"}
          </p>
          <div className="flex flex-wrap gap-2">
            {unitSummary.map(([unit, { total, count }]) => (
              <div
                key={unit}
                className="flex items-center gap-2 rounded-lg px-3 py-2"
                style={{
                  background: "rgba(249,115,22,0.06)",
                  border: "1px solid rgba(249,115,22,0.18)",
                }}
              >
                <span className="text-xs font-dm-sans font-semibold" style={{ color: CS.accent }}>
                  {unit}
                </span>
                <span className="font-syne font-bold text-sm" style={{ color: CS.text }}>
                  {total.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                </span>
                <span className="text-xs font-dm-sans" style={{ color: CS.muted }}>
                  ({count})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────── */}
      {showAdd && (
        <AddElementModal
          projectId={projectId}
          language={lang}
          itemCount={items.length}
          onSaved={(item) => setItems((p) => [...p, item])}
          onClose={() => setShowAdd(false)}
        />
      )}

      {showClear && (
        <ConfirmClearModal
          language={lang}
          count={items.length}
          onConfirm={handleClearAll}
          onClose={() => setShowClear(false)}
        />
      )}

      {showPaste && (
        <PasteImportModal
          projectId={projectId}
          language={lang}
          startOrder={items.length}
          onSaved={handlePasteImport}
          onClose={() => setShowPaste(false)}
        />
      )}

      {/* ── Delete element confirmation ──────────────────────── */}
      {deleteConfirm && (() => {
        const target = items.find((i) => i.id === deleteConfirm);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
            <div className="flex flex-col gap-4 p-6 rounded-2xl" style={{ background: CS.surface, border: `1px solid ${CS.border}`, maxWidth: 380, width: "100%" }}>
              <div className="flex items-center gap-2">
                <Trash2 className="h-5 w-5" style={{ color: "#ef4444" }} />
                <span className="font-syne font-bold text-base" style={{ color: CS.text }}>{lang === "es" ? "Eliminar elemento" : "Delete element"}</span>
              </div>
              <p className="text-sm font-dm-sans" style={{ color: CS.muted }}>
                {lang === "es"
                  ? `¿Eliminar "${target?.element ?? "este elemento"}"? Esta acción no se puede deshacer.`
                  : `Delete "${target?.element ?? "this element"}"? This cannot be undone.`}
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
