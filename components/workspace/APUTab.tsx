"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Plus, Trash2, Pencil, Loader2, X,
  Search, ArrowLeft, BookOpen,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/context/WorkspaceContext";
import { t } from "@/lib/utils/i18n";
import type { ApuItem, ApuLineItem } from "@/lib/types/database.types";
import {
  MATERIALS_DB, CATEGORY_LABELS,
  type MaterialCategory, type MaterialEntry,
} from "@/lib/data/materials-db";
import type { Locale } from "@/lib/utils/i18n";
import { useAIAPU } from "@/lib/hooks/useAIAPU";

// ─── shared style primitives ──────────────────────────────────────────────────

const CS = {
  surface:  "var(--cs-surface)",
  border:   "var(--cs-border)",
  accent:   "var(--cs-accent)",
  text:     "var(--cs-text)",
  muted:    "var(--cs-muted)",
  bg:       "var(--cs-bg)",
} as const;

const cellInput: React.CSSProperties = {
  background: "transparent",
  border: "none",
  outline: "none",
  color: CS.text,
  fontFamily: "var(--font-dm-sans)",
  fontSize: "0.8125rem",
  width: "100%",
  padding: "0 2px",
};

// ─── types ────────────────────────────────────────────────────────────────────

interface EditorDraft {
  id: string | null;
  code: string;
  description: string;
  unit: string;
  overheadPct: number;
  profitPct: number;
  materials: ApuLineItem[];
  labor: ApuLineItem[];
  equipment: ApuLineItem[];
}

const EMPTY_DRAFT: EditorDraft = {
  id: null,
  code: "",
  description: "",
  unit: "",
  overheadPct: 12,
  profitPct: 5,
  materials: [],
  labor: [],
  equipment: [],
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function itemToDraft(item: ApuItem): EditorDraft {
  return {
    id: item.id,
    code: item.code,
    description: item.description,
    unit: item.unit,
    overheadPct: item.overhead_pct,
    profitPct: item.profit_pct,
    materials: (item.materials as ApuLineItem[]) ?? [],
    labor: (item.labor as ApuLineItem[]) ?? [],
    equipment: (item.equipment as ApuLineItem[]) ?? [],
  };
}

function calcCosts(draft: EditorDraft) {
  const sumArr = (arr: ApuLineItem[]) =>
    arr.reduce((s, r) => s + r.qty * r.unit_price, 0);
  const direct = sumArr(draft.materials) + sumArr(draft.labor) + sumArr(draft.equipment);
  const overhead = direct * draft.overheadPct / 100;
  const profit   = direct * draft.profitPct  / 100;
  return { direct, overhead, profit, selling: direct + overhead + profit };
}


// ─── LibraryModal ─────────────────────────────────────────────────────────────

interface LibraryModalProps {
  language: Locale;
  onInsert: (entry: MaterialEntry, section: MaterialCategory) => void;
  onClose: () => void;
}

function LibraryModal({ language, onInsert, onClose }: LibraryModalProps) {
  const [tab, setTab]     = useState<MaterialCategory>("materials");
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filtered = MATERIALS_DB.filter(
    (e) => e.category === tab &&
      e.name.toLowerCase().includes(query.toLowerCase())
  );

  const tabs: MaterialCategory[] = ["materials", "labor", "equipment"];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="flex flex-col w-full"
        style={{
          maxWidth: 560,
          maxHeight: "80vh",
          background: CS.surface,
          border: `1px solid ${CS.border}`,
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: `1px solid ${CS.border}` }}
        >
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" style={{ color: CS.accent }} />
            <span className="font-syne font-bold text-base" style={{ color: CS.text }}>
              {language === "es" ? "Biblioteca de Precios" : "Price Library"}
            </span>
            <span
              className="text-xs font-dm-sans rounded-full px-2 py-0.5"
              style={{ background: "rgba(249,115,22,0.12)", color: CS.accent }}
            >
              43
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label={language === "es" ? "Cerrar" : "Close"}
            style={{ background: "none", border: "none", cursor: "pointer", color: CS.muted }}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Category tabs */}
        <div className="flex shrink-0" style={{ borderBottom: `1px solid ${CS.border}` }}>
          {tabs.map((cat) => {
            const cfg = CATEGORY_LABELS[cat];
            const active = tab === cat;
            return (
              <button
                key={cat}
                onClick={() => setTab(cat)}
                className="flex-1 py-2.5 text-xs font-semibold font-dm-sans transition-all"
                style={{
                  background: active ? "rgba(255,255,255,0.04)" : "transparent",
                  color: active ? cfg.color : CS.muted,
                  border: "none",
                  borderBottom: active ? `2px solid ${cfg.color}` : "2px solid transparent",
                  cursor: "pointer",
                  marginBottom: -1,
                }}
              >
                {language === "es" ? cfg.es : cfg.en}
                <span
                  className="ml-1.5 rounded-full px-1.5 py-px text-[10px]"
                  style={{
                    background: active ? `${cfg.color}22` : "transparent",
                    color: active ? cfg.color : CS.muted,
                  }}
                >
                  {MATERIALS_DB.filter((e) => e.category === cat).length}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div
          className="flex items-center gap-2 px-4 py-2.5 shrink-0"
          style={{ borderBottom: `1px solid ${CS.border}`, background: "rgba(255,255,255,0.02)" }}
        >
          <Search className="h-3.5 w-3.5 shrink-0" style={{ color: CS.muted }} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={language === "es" ? "Buscar..." : "Search..."}
            className="flex-1 bg-transparent text-sm font-dm-sans outline-none"
            style={{ color: CS.text }}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              style={{ background: "none", border: "none", cursor: "pointer", color: CS.muted }}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Items list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p
              className="text-center py-10 text-sm font-dm-sans"
              style={{ color: CS.muted }}
            >
              {language === "es" ? "Sin resultados." : "No results."}
            </p>
          ) : (
            <table className="w-full text-sm font-dm-sans">
              <thead className="sticky top-0" style={{ background: CS.surface }}>
                <tr style={{ borderBottom: `1px solid ${CS.border}` }}>
                  <th
                    className="text-left px-4 py-2 text-xs font-semibold"
                    style={{ color: CS.muted }}
                  >
                    {language === "es" ? "Concepto" : "Description"}
                  </th>
                  <th
                    className="text-left px-2 py-2 text-xs font-semibold w-16"
                    style={{ color: CS.muted }}
                  >
                    {language === "es" ? "Unidad" : "Unit"}
                  </th>
                  <th
                    className="text-right px-4 py-2 text-xs font-semibold w-28"
                    style={{ color: CS.muted }}
                  >
                    {language === "es" ? "Precio Ref." : "Ref. Price"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <tr
                    key={entry.id}
                    className="group cursor-pointer"
                    style={{ borderBottom: `1px solid ${CS.border}` }}
                    onClick={() => { onInsert(entry, tab); onClose(); }}
                  >
                    <td
                      className="px-4 py-2.5 group-hover:text-white transition-colors"
                      style={{ color: CS.text }}
                    >
                      {entry.name}
                    </td>
                    <td
                      className="px-2 py-2.5"
                      style={{ color: CS.muted }}
                    >
                      {entry.unit}
                    </td>
                    <td
                      className="px-4 py-2.5 text-right font-semibold transition-colors"
                      style={{ color: CS.accent }}
                    >
                      ${entry.unit_price.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer hint */}
        <div
          className="px-4 py-2.5 text-xs font-dm-sans shrink-0"
          style={{ color: CS.muted, borderTop: `1px solid ${CS.border}`, background: "rgba(255,255,255,0.02)" }}
        >
          {language === "es"
            ? "Precios de referencia en MXN. Haz clic en cualquier ítem para insertarlo."
            : "Reference prices in MXN. Click any item to insert it."}
        </div>
      </div>
    </div>
  );
}

// ─── AIModal ──────────────────────────────────────────────────────────────────

interface AIModalProps {
  onFill: (draft: Partial<EditorDraft>) => void;
  onClose: () => void;
}

function AIModal({ onFill, onClose }: AIModalProps) {
  const { language, currency, unitSys } = useWorkspace();
  const [prompt, setPrompt] = useState("");
  const { generate, isLoading, error } = useAIAPU();

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape" && !isLoading) onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isLoading, onClose]);

  async function handleSubmit() {
    if (!prompt.trim() || isLoading) return;
    const result = await generate({ prompt: prompt.trim(), language, currency, unitSys });
    if (!result) return; // error state is set by the hook

    onFill({
      code:        result.code        ?? "",
      description: result.description ?? "",
      unit:        result.unit        ?? "",
      overheadPct: result.overhead_pct ?? 12,
      profitPct:   result.profit_pct   ?? 5,
      materials:   result.materials   ?? [],
      labor:       result.labor       ?? [],
      equipment:   result.equipment   ?? [],
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && !isLoading && onClose()}
    >
      <div
        className="flex flex-col w-full gap-4"
        style={{
          maxWidth: 520,
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
            <span style={{ color: CS.accent, fontSize: 18, lineHeight: 1 }}>✦</span>
            <span className="font-syne font-bold text-base" style={{ color: CS.text }}>
              {language === "es" ? "Generar APU con IA" : "Generate APU with AI"}
            </span>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            aria-label={language === "es" ? "Cerrar" : "Close"}
            style={{ background: "none", border: "none", cursor: isLoading ? "not-allowed" : "pointer", color: CS.muted }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Prompt */}
        <div>
          <label
            className="block text-xs font-medium font-dm-sans mb-2"
            style={{ color: CS.muted }}
          >
            {language === "es"
              ? "Describe el concepto de obra:"
              : "Describe the construction activity:"}
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isLoading}
            rows={3}
            placeholder={
              language === "es"
                ? "Ej: Colado de losa de concreto f'c 210 kg/cm², incluye cimbra y cura..."
                : "E.g: Concrete slab f'c 210 kg/cm² including formwork and curing..."
            }
            className="w-full rounded-lg text-sm font-dm-sans resize-none"
            style={{
              padding: "0.6rem 0.75rem",
              border: `1px solid ${CS.border}`,
              background: "rgba(255,255,255,0.04)",
              color: CS.text,
              outline: "none",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
            }}
          />
          <p className="text-xs mt-1 font-dm-sans" style={{ color: CS.muted }}>
            {language === "es" ? "⌘ Enter para enviar" : "⌘ Enter to submit"}
          </p>
        </div>

        {/* Loading indicator */}
        {isLoading && (
          <div
            className="flex items-center gap-3 rounded-lg px-4 py-3"
            style={{ background: "rgba(249,115,22,0.08)", border: `1px solid rgba(249,115,22,0.2)` }}
          >
            <Loader2 className="h-4 w-4 animate-spin shrink-0" style={{ color: CS.accent }} />
            <span className="text-sm font-dm-sans" style={{ color: CS.accent }}>
              {language === "es" ? "Analizando concepto de obra…" : "Analyzing construction activity…"}
            </span>
          </div>
        )}

        {error && (
          <p className="text-sm font-dm-sans" style={{ color: "#ef4444" }}>{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-[10px] text-sm font-medium font-dm-sans"
            style={{
              border: `1px solid ${CS.border}`,
              background: "transparent",
              color: CS.muted,
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.5 : 1,
            }}
          >
            {t("cancel", language)}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || !prompt.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-semibold font-dm-sans"
            style={{
              background: CS.accent,
              color: "#fff",
              border: "none",
              cursor: isLoading || !prompt.trim() ? "not-allowed" : "pointer",
              opacity: isLoading || !prompt.trim() ? 0.6 : 1,
            }}
          >
            {isLoading ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" />
                {language === "es" ? "Generando..." : "Generating..."}</>
            ) : (
              <><span style={{ fontSize: 14 }}>✦</span>
                {language === "es" ? "Generar" : "Generate"}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SectionTable ─────────────────────────────────────────────────────────────

interface SectionTableProps {
  section: MaterialCategory;
  rows: ApuLineItem[];
  language: Locale;
  fmt: (n: number) => string;
  onChange: (rows: ApuLineItem[]) => void;
  onOpenLibrary: () => void;
}

function SectionTable({ section, rows, language, fmt, onChange, onOpenLibrary }: SectionTableProps) {
  const cfg = CATEGORY_LABELS[section];
  const label = language === "es" ? cfg.es : cfg.en;
  const subtotal = rows.reduce((s, r) => s + r.qty * r.unit_price, 0);

  function addRow() {
    onChange([...rows, { name: "", unit: "", qty: 1, unit_price: 0 }]);
  }

  function updateRow(i: number, field: keyof ApuLineItem, val: string | number) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)));
  }

  function removeRow(i: number) {
    onChange(rows.filter((_, idx) => idx !== i));
  }

  return (
    <div style={{ marginBottom: "1.25rem" }}>
      {/* Section header */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{
          background: "rgba(255,255,255,0.03)",
          borderTop: `2px solid ${cfg.color}`,
          borderBottom: `1px solid ${CS.border}`,
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="rounded-full"
            style={{ width: 8, height: 8, background: cfg.color, display: "inline-block" }}
          />
          <span
            className="text-xs font-semibold font-dm-sans uppercase tracking-wider"
            style={{ color: cfg.color }}
          >
            {label}
          </span>
          {rows.length > 0 && (
            <span
              className="text-xs font-dm-sans rounded-full px-2 py-px"
              style={{ background: `${cfg.color}18`, color: cfg.color }}
            >
              {rows.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {rows.length > 0 && (
            <span className="text-xs font-semibold font-dm-sans" style={{ color: CS.text }}>
              {fmt(subtotal)}
            </span>
          )}
          <button
            type="button"
            onClick={onOpenLibrary}
            className="flex items-center gap-1 text-xs font-dm-sans transition-colors"
            style={{ background: "none", border: "none", cursor: "pointer", color: CS.muted }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = CS.text)}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = CS.muted)}
          >
            <BookOpen className="h-3 w-3" />
            {language === "es" ? "Biblioteca" : "Library"}
          </button>
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1 text-xs font-dm-sans"
            style={{ background: "none", border: "none", cursor: "pointer", color: cfg.color }}
          >
            <Plus className="h-3 w-3" />
            {language === "es" ? "Agregar" : "Add row"}
          </button>
        </div>
      </div>

      {/* Table */}
      {rows.length > 0 ? (
        <table className="w-full text-sm font-dm-sans">
          <thead>
            <tr style={{ borderBottom: `1px solid ${CS.border}` }}>
              {["Descripción / Description", "Unidad", "Cant.", "P.U.", "Parcial", ""].map((h, i) => (
                <th
                  key={i}
                  className={`py-2 text-xs font-semibold ${i > 1 ? "text-right" : "text-left"} ${i === 0 ? "pl-4" : "px-3"}`}
                  style={{ color: CS.muted }}
                >
                  {i < 5 ? h : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const partial = row.qty * row.unit_price;
              return (
                <tr
                  key={i}
                  className="group"
                  style={{
                    borderBottom: `1px solid ${CS.border}`,
                    background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
                  }}
                >
                  <td className="pl-4 pr-2 py-2" style={{ minWidth: 180 }}>
                    <input
                      style={cellInput}
                      value={row.name}
                      placeholder={language === "es" ? "Concepto..." : "Description..."}
                      onChange={(e) => updateRow(i, "name", e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2" style={{ width: 70 }}>
                    <input
                      style={cellInput}
                      value={row.unit}
                      placeholder="m³"
                      onChange={(e) => updateRow(i, "unit", e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2" style={{ width: 80 }}>
                    <input
                      style={{ ...cellInput, textAlign: "right" }}
                      type="number"
                      min={0}
                      step="any"
                      value={row.qty || ""}
                      placeholder="0"
                      onChange={(e) => updateRow(i, "qty", parseFloat(e.target.value) || 0)}
                    />
                  </td>
                  <td className="px-3 py-2" style={{ width: 100 }}>
                    <input
                      style={{ ...cellInput, textAlign: "right" }}
                      type="number"
                      min={0}
                      step="any"
                      value={row.unit_price || ""}
                      placeholder="0.00"
                      onChange={(e) => updateRow(i, "unit_price", parseFloat(e.target.value) || 0)}
                    />
                  </td>
                  <td
                    className="px-3 py-2 text-right font-semibold"
                    style={{ width: 110, color: partial > 0 ? CS.text : CS.muted }}
                  >
                    {fmt(partial)}
                  </td>
                  <td className="px-3 py-2" style={{ width: 36 }}>
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      className="flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{
                        width: 24, height: 24,
                        background: "none", border: "none",
                        cursor: "pointer", color: "#ef4444",
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <div
          className="px-4 py-3 text-xs font-dm-sans"
          style={{ color: CS.muted, borderBottom: `1px solid ${CS.border}` }}
        >
          {language === "es"
            ? "Sin renglones. Haz clic en Agregar o usa la Biblioteca."
            : "No rows. Click Add or use the Library."}
        </div>
      )}
    </div>
  );
}

// ─── CostSummary ──────────────────────────────────────────────────────────────

interface CostSummaryProps {
  draft: EditorDraft;
  fmt: (n: number) => string;
  language: Locale;
  onChange: (patch: Partial<Pick<EditorDraft, "overheadPct" | "profitPct">>) => void;
}

function CostSummary({ draft, fmt, language, onChange }: CostSummaryProps) {
  const { direct, overhead, profit, selling } = calcCosts(draft);

  const pctInput: React.CSSProperties = {
    width: 52,
    padding: "2px 6px",
    borderRadius: 6,
    border: `1px solid ${CS.border}`,
    background: "rgba(255,255,255,0.06)",
    color: CS.text,
    fontFamily: "var(--font-dm-sans)",
    fontSize: "0.8125rem",
    textAlign: "right",
    outline: "none",
  };

  const col = (label: string, value: string, sub?: React.ReactNode, big?: boolean) => (
    <div className="flex flex-col items-end gap-0.5">
      <p className="text-xs font-dm-sans" style={{ color: CS.muted }}>{label}</p>
      {sub && <div className="flex items-center gap-1">{sub}</div>}
      <p
        className={`font-dm-sans font-bold ${big ? "text-xl" : "text-sm"}`}
        style={{ color: big ? CS.accent : CS.text }}
      >
        {value}
      </p>
    </div>
  );

  return (
    <div
      className="flex items-end justify-end gap-8 px-5 py-4 shrink-0 flex-wrap"
      style={{
        borderTop: `1px solid ${CS.border}`,
        background: "rgba(249,115,22,0.04)",
      }}
    >
      {col(
        language === "es" ? "Costo Directo" : "Direct Cost",
        fmt(direct),
      )}

      <div className="w-px self-stretch" style={{ background: CS.border }} />

      {col(
        language === "es" ? "Gastos Generales" : "Overheads",
        fmt(overhead),
        <>
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={draft.overheadPct}
            onChange={(e) => onChange({ overheadPct: parseFloat(e.target.value) || 0 })}
            style={pctInput}
          />
          <span className="text-xs font-dm-sans" style={{ color: CS.muted }}>%</span>
        </>,
      )}

      {col(
        language === "es" ? "Utilidad" : "Profit",
        fmt(profit),
        <>
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={draft.profitPct}
            onChange={(e) => onChange({ profitPct: parseFloat(e.target.value) || 0 })}
            style={pctInput}
          />
          <span className="text-xs font-dm-sans" style={{ color: CS.muted }}>%</span>
        </>,
      )}

      <div className="w-px self-stretch" style={{ background: CS.border }} />

      {col(
        language === "es" ? "Precio de Venta" : "Selling Price",
        fmt(selling),
        undefined,
        true,
      )}
    </div>
  );
}

// ─── APUEditor ────────────────────────────────────────────────────────────────

interface APUEditorProps {
  initialDraft: EditorDraft;
  language: Locale;
  currency: string;
  fmt: (n: number) => string;
  projectId: string;
  onSaved: (item: ApuItem) => void;
  onCancel: () => void;
}

function APUEditor({
  initialDraft, language, currency: _currency, fmt, projectId, onSaved, onCancel,
}: APUEditorProps) {
  const supabase = createClient();
  const [draft, setDraft]         = useState<EditorDraft>(initialDraft);
  const [saving, setSaving]       = useState(false);
  const [showLibrary, setShowLib] = useState(false);
  const [showAI, setShowAI]       = useState(false);
  const [libSection, setLibSection] = useState<MaterialCategory>("materials");

  // Patch helpers
  const patch = useCallback(
    (p: Partial<EditorDraft>) => setDraft((d) => ({ ...d, ...p })),
    []
  );

  function openLibraryFor(section: MaterialCategory) {
    setLibSection(section);
    setShowLib(true);
  }

  function handleLibInsert(entry: MaterialEntry, _cat?: MaterialCategory) {
    const row: ApuLineItem = { name: entry.name, unit: entry.unit, qty: 1, unit_price: entry.unit_price };
    const key = libSection; // use the section that opened the library
    patch({ [key]: [...(draft[key] as ApuLineItem[]), row] });
  }

  function handleAIFill(filled: Partial<EditorDraft>) {
    patch(filled);
  }

  async function handleSave() {
    if (!draft.code.trim() || !draft.description.trim() || !draft.unit.trim()) return;
    setSaving(true);
    const { direct, selling } = calcCosts(draft);
    const payload = {
      project_id:   projectId,
      code:         draft.code.trim(),
      description:  draft.description.trim(),
      unit:         draft.unit.trim(),
      materials:    draft.materials,
      labor:        draft.labor,
      equipment:    draft.equipment,
      direct_cost:  direct,
      overhead_pct: draft.overheadPct,
      profit_pct:   draft.profitPct,
      selling_price: selling,
    };

    let result;
    if (draft.id) {
      result = await supabase
        .from("apu_items")
        .update(payload)
        .eq("id", draft.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from("apu_items")
        .insert(payload)
        .select()
        .single();
    }

    setSaving(false);
    if (!result.error && result.data) onSaved(result.data as ApuItem);
  }

  const headerInput: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)",
    border: `1px solid ${CS.border}`,
    borderRadius: 8,
    color: CS.text,
    fontFamily: "var(--font-dm-sans)",
    fontSize: "0.8125rem",
    padding: "0.35rem 0.6rem",
    outline: "none",
  };

  const isValid = draft.code.trim() && draft.description.trim() && draft.unit.trim();

  return (
    <div
      className="flex flex-col rounded-[10px] overflow-hidden"
      style={{ border: `1px solid ${CS.border}`, background: CS.surface }}
    >
      {/* ── Editor top bar ─────────────────────────────────── */}
      <div
        className="flex items-center gap-2 px-4 py-3 flex-wrap shrink-0"
        style={{ borderBottom: `1px solid ${CS.border}`, background: "rgba(255,255,255,0.02)" }}
      >
        {/* Back */}
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1.5 text-sm font-dm-sans mr-2"
          style={{ background: "none", border: "none", cursor: "pointer", color: CS.muted }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = CS.text)}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = CS.muted)}
        >
          <ArrowLeft className="h-4 w-4" />
          {language === "es" ? "Lista" : "List"}
        </button>

        <div className="w-px self-stretch" style={{ background: CS.border }} />

        {/* Code */}
        <input
          style={{ ...headerInput, width: 72, fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}
          value={draft.code}
          onChange={(e) => patch({ code: e.target.value })}
          placeholder="03.01"
        />

        {/* Description */}
        <input
          style={{ ...headerInput, flex: 1, minWidth: 160 }}
          value={draft.description}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder={language === "es" ? "Descripción del concepto *" : "Description *"}
        />

        {/* Unit */}
        <input
          style={{ ...headerInput, width: 68 }}
          value={draft.unit}
          onChange={(e) => patch({ unit: e.target.value })}
          placeholder="m³"
        />

        <div className="flex-1" />

        {/* AI Suggest */}
        <button
          type="button"
          onClick={() => setShowAI(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-dm-sans transition-colors"
          style={{
            background: "rgba(249,115,22,0.1)",
            border: `1px solid rgba(249,115,22,0.3)`,
            color: CS.accent,
            cursor: "pointer",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(249,115,22,0.18)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(249,115,22,0.1)")}
        >
          <span style={{ fontSize: 13 }}>✦</span>
          {language === "es" ? "Sugerir con IA" : "AI Suggest"}
        </button>

        {/* Save */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !isValid}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold font-dm-sans"
          style={{
            background: CS.accent,
            color: "#fff",
            border: "none",
            cursor: saving || !isValid ? "not-allowed" : "pointer",
            opacity: saving || !isValid ? 0.6 : 1,
          }}
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {t("save", language)}
        </button>
      </div>

      {/* ── Section tables ─────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto" style={{ background: CS.bg }}>
        <SectionTable
          section="materials"
          rows={draft.materials}
          language={language}
          fmt={fmt}
          onChange={(rows) => patch({ materials: rows })}
          onOpenLibrary={() => openLibraryFor("materials")}
        />
        <SectionTable
          section="labor"
          rows={draft.labor}
          language={language}
          fmt={fmt}
          onChange={(rows) => patch({ labor: rows })}
          onOpenLibrary={() => openLibraryFor("labor")}
        />
        <SectionTable
          section="equipment"
          rows={draft.equipment}
          language={language}
          fmt={fmt}
          onChange={(rows) => patch({ equipment: rows })}
          onOpenLibrary={() => openLibraryFor("equipment")}
        />
      </div>

      {/* ── Cost summary ───────────────────────────────────── */}
      <CostSummary
        draft={draft}
        fmt={fmt}
        language={language}
        onChange={(p) => patch(p)}
      />

      {/* ── Modals ─────────────────────────────────────────── */}
      {showLibrary && (
        <LibraryModal
          language={language}
          onInsert={handleLibInsert}
          onClose={() => setShowLib(false)}
        />
      )}
      {showAI && (
        <AIModal
          onFill={handleAIFill}
          onClose={() => setShowAI(false)}
        />
      )}
    </div>
  );
}

// ─── APU list row ─────────────────────────────────────────────────────────────

interface APUListRowProps {
  item: ApuItem;
  language: Locale;
  fmt: (n: number) => string;
  onEdit: () => void;
  onDelete: () => void;
}

function APUListRow({ item, language: _language, fmt, onEdit, onDelete }: APUListRowProps) {
  const [deleting, setDeleting] = useState(false);
  const supabase = createClient();

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    setDeleting(true);
    await supabase.from("apu_items").delete().eq("id", item.id);
    onDelete();
  }

  return (
    <tr
      className="group cursor-pointer"
      style={{ borderBottom: `1px solid ${CS.border}` }}
      onClick={onEdit}
    >
      <td className="px-4 py-3">
        <code className="text-xs font-mono" style={{ color: CS.accent }}>
          {item.code}
        </code>
      </td>
      <td className="px-3 py-3 max-w-xs">
        <span className="text-sm font-dm-sans truncate block" style={{ color: CS.text }}>
          {item.description}
        </span>
      </td>
      <td className="px-3 py-3">
        <span className="text-xs font-dm-sans" style={{ color: CS.muted }}>
          {item.unit}
        </span>
      </td>
      <td className="px-3 py-3 text-right">
        <span className="text-sm font-dm-sans" style={{ color: CS.text }}>
          {fmt(item.direct_cost)}
        </span>
      </td>
      <td className="px-3 py-3 text-right">
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-xs font-dm-sans" style={{ color: CS.muted }}>
            GG {item.overhead_pct}% · U {item.profit_pct}%
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-sm font-semibold font-dm-sans" style={{ color: CS.accent }}>
          {fmt(item.selling_price)}
        </span>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="flex items-center justify-center rounded-lg"
            style={{
              width: 28, height: 28,
              background: "none",
              border: `1px solid ${CS.border}`,
              cursor: "pointer", color: CS.muted,
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = CS.text)}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = CS.muted)}
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center justify-center rounded-lg"
            style={{
              width: 28, height: 28,
              background: "none",
              border: `1px solid transparent`,
              cursor: "pointer", color: CS.muted,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "#ef4444";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(239,68,68,0.3)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = CS.muted;
              (e.currentTarget as HTMLButtonElement).style.borderColor = "transparent";
            }}
          >
            {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── APU list view ────────────────────────────────────────────────────────────

interface APUListProps {
  items: ApuItem[];
  language: Locale;
  fmt: (n: number) => string;
  onNew: () => void;
  onEdit: (item: ApuItem) => void;
  onDelete: (id: string) => void;
  onAI: () => void;
  onLibrary: () => void;
}

function APUList({ items, language, fmt, onNew, onEdit, onDelete, onAI, onLibrary }: APUListProps) {
  const totalSelling = items.reduce((s, i) => s + i.selling_price, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-syne font-bold text-lg" style={{ color: CS.text }}>
            {language === "es" ? "Análisis de Precio Unitario" : "Unit Price Analysis"}
          </h2>
          <p className="text-xs font-dm-sans mt-0.5" style={{ color: CS.muted }}>
            {items.length} {language === "es" ? "análisis registrados" : "analyses on record"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Library shortcut */}
          <button
            type="button"
            onClick={onLibrary}
            aria-label={language === "es" ? "Abrir biblioteca de precios" : "Open price library"}
            className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-sm font-medium font-dm-sans transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cs-accent)]"
            style={{
              border: `1px solid ${CS.border}`,
              background: "transparent",
              color: CS.muted,
              cursor: "pointer",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = CS.text)}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = CS.muted)}
          >
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            {language === "es" ? "Biblioteca" : "Library"}
          </button>

          {/* AI button */}
          <button
            type="button"
            onClick={onAI}
            aria-label={language === "es" ? "Generar APU con IA" : "Generate APU with AI"}
            className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-sm font-semibold font-dm-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cs-accent)]"
            style={{
              background: "rgba(249,115,22,0.1)",
              border: `1px solid rgba(249,115,22,0.3)`,
              color: CS.accent,
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 15 }}>✦</span>
            {language === "es" ? "Sugerir con IA" : "AI Suggest"}
          </button>

          {/* New APU */}
          <button
            type="button"
            onClick={onNew}
            aria-label={language === "es" ? "Nuevo APU" : "New APU"}
            className="flex items-center gap-2 px-3 py-2 rounded-[10px] text-sm font-semibold font-dm-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cs-accent)]"
            style={{ background: CS.accent, color: "#fff", border: "none", cursor: "pointer" }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {language === "es" ? "Nuevo APU" : "New APU"}
          </button>
        </div>
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <div
          className="flex flex-col items-center justify-center py-20 rounded-[10px] text-center gap-4"
          style={{ border: `1.5px dashed ${CS.border}` }}
        >
          <p className="font-syne font-bold text-base" style={{ color: CS.text }}>
            {language === "es" ? "No hay APUs" : "No APU items"}
          </p>
          <p className="text-sm font-dm-sans max-w-xs" style={{ color: CS.muted }}>
            {language === "es"
              ? "Crea uno manualmente o usa IA para generarlo desde una descripción."
              : "Create one manually or use AI to generate it from a description."}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onNew}
              className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-semibold font-dm-sans"
              style={{ background: CS.accent, color: "#fff", border: "none", cursor: "pointer" }}
            >
              <Plus className="h-4 w-4" />
              {language === "es" ? "Nuevo APU" : "New APU"}
            </button>
            <button
              onClick={onAI}
              className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-semibold font-dm-sans"
              style={{
                background: "rgba(249,115,22,0.1)",
                border: `1px solid rgba(249,115,22,0.3)`,
                color: CS.accent,
                cursor: "pointer",
              }}
            >
              <span>✦</span>
              {language === "es" ? "Usar IA" : "Use AI"}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {items.length > 0 && (
        <div
          className="rounded-[10px] overflow-hidden"
          style={{ border: `1px solid ${CS.border}` }}
        >
          <div className="overflow-x-auto">
            <table className="w-full font-dm-sans">
              <thead>
                <tr
                  className="text-xs font-semibold"
                  style={{
                    borderBottom: `1px solid ${CS.border}`,
                    background: "rgba(255,255,255,0.03)",
                    color: CS.muted,
                  }}
                >
                  <th className="text-left px-4 py-3 w-20">
                    {language === "es" ? "Código" : "Code"}
                  </th>
                  <th className="text-left px-3 py-3">
                    {language === "es" ? "Descripción" : "Description"}
                  </th>
                  <th className="text-left px-3 py-3 w-20">
                    {language === "es" ? "Unidad" : "Unit"}
                  </th>
                  <th className="text-right px-3 py-3 w-32">
                    {language === "es" ? "Costo Directo" : "Direct Cost"}
                  </th>
                  <th className="text-right px-3 py-3 w-32">
                    {language === "es" ? "GG / Util." : "OH / Profit"}
                  </th>
                  <th className="text-right px-4 py-3 w-32">
                    {language === "es" ? "Precio Venta" : "Selling Price"}
                  </th>
                  <th className="px-3 py-3 w-20" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <APUListRow
                    key={item.id}
                    item={item}
                    language={language}
                    fmt={fmt}
                    onEdit={() => onEdit(item)}
                    onDelete={() => onDelete(item.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer total */}
          <div
            className="flex items-center justify-between px-5 py-3"
            style={{
              borderTop: `1px solid ${CS.border}`,
              background: "rgba(249,115,22,0.04)",
            }}
          >
            <span className="text-sm font-dm-sans" style={{ color: CS.muted }}>
              {language === "es" ? "Total precio de venta" : "Total selling price"}
            </span>
            <span className="font-syne font-bold text-xl" style={{ color: CS.accent }}>
              {fmt(totalSelling)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main APUTab export ───────────────────────────────────────────────────────

type View =
  | { kind: "list" }
  | { kind: "editor"; draft: EditorDraft };

interface APUTabProps {
  initialItems: ApuItem[];
}

export default function APUTab({ initialItems }: APUTabProps) {
  const { projectId, language, currency, fmt } = useWorkspace();
  const [items, setItems]   = useState<ApuItem[]>(initialItems);
  const [view, setView]     = useState<View>({ kind: "list" });
  const [showLibrary, setShowLibrary] = useState(false);
  const [showAI, setShowAI]           = useState(false);

  function openNew() {
    setView({ kind: "editor", draft: { ...EMPTY_DRAFT } });
  }

  function openEdit(item: ApuItem) {
    setView({ kind: "editor", draft: itemToDraft(item) });
  }

  function handleSaved(saved: ApuItem) {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setView({ kind: "list" });
  }

  function handleDelete(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  // "AI Suggest" from list → open editor pre-filled
  function handleListAI() {
    // Open AI modal; on fill, open editor with the result
    setShowAI(true);
  }

  function handleAIFillFromList(filled: Partial<EditorDraft>) {
    setView({ kind: "editor", draft: { ...EMPTY_DRAFT, ...filled } });
  }

  if (view.kind === "editor") {
    return (
      <>
        <APUEditor
          initialDraft={view.draft}
          language={language}
          currency={currency}
          fmt={fmt}
          projectId={projectId}
          onSaved={handleSaved}
          onCancel={() => setView({ kind: "list" })}
        />
      </>
    );
  }

  return (
    <>
      <APUList
        items={items}
        language={language}
        fmt={fmt}
        onNew={openNew}
        onEdit={openEdit}
        onDelete={handleDelete}
        onAI={handleListAI}
        onLibrary={() => setShowLibrary(true)}
      />

      {showLibrary && (
        <LibraryModal
          language={language}
          onInsert={() => {}}  // no-op from list view
          onClose={() => setShowLibrary(false)}
        />
      )}

      {showAI && (
        <AIModal
          onFill={(filled) => {
            setShowAI(false);
            handleAIFillFromList(filled);
          }}
          onClose={() => setShowAI(false)}
        />
      )}
    </>
  );
}
