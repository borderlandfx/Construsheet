"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  Plus, Trash2, Pencil, Loader2, X,
  Search, ArrowLeft, BookOpen, Copy, FileText, Download, Sparkles,
  FileSpreadsheet, Info, ChevronRight, ChevronDown, Send,
} from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import {
  ToolbarPortal, ToolbarGroup, ToolbarSep,
  TBtn, TBtnPrimary, TBtnAI,
} from "@/components/workspace/ContextualToolbar";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/context/WorkspaceContext";
import { useToast } from "@/lib/context/ToastContext";
import { t } from "@/lib/utils/i18n";
import type { ApuItem, ApuLineItem, ProjectIndirectCosts } from "@/lib/types/database.types";
import {
  MATERIALS_DB, CATEGORY_LABELS,
  type MaterialCategory, type MaterialEntry,
} from "@/lib/data/materials-db";
import type { Locale } from "@/lib/utils/i18n";
import { useAIAPU } from "@/lib/hooks/useAIAPU";
import { usePlan } from "@/lib/hooks/usePlan";
import UpgradePrompt from "@/components/ui/UpgradePrompt";

// ─── APU Chapter Categories ──────────────────────────────────────────────────

export const CHAPTER_CATEGORIES = [
  { es: "Obras Preliminares",            en: "Preliminary Works" },
  { es: "Movimiento de Tierras",         en: "Earthworks" },
  { es: "Cimentación",                   en: "Foundation" },
  { es: "Estructura",                    en: "Structure" },
  { es: "Estructura Metálica",           en: "Metal Structure" },
  { es: "Albañilería y Mampostería",     en: "Masonry" },
  { es: "Herrería",                      en: "Ironworks" },
  { es: "Carpintería",                   en: "Carpentry" },
  { es: "Acabados",                      en: "Finishes" },
  { es: "Pisos y Suelos",               en: "Floors" },
  { es: "Instalaciones Hidráulicas",     en: "Hydraulic Installations" },
  { es: "Instalaciones de Agua Potable", en: "Plumbing" },
  { es: "Instalaciones Sanitarias",      en: "Sanitary Installations" },
  { es: "Instalaciones de Gas",          en: "Gas Installations" },
  { es: "Instalaciones Eléctricas",      en: "Electrical Installations" },
  { es: "Tableros e Interruptores",      en: "Panels & Switches" },
  { es: "Tubería y Conexiones",          en: "Piping & Connections" },
  { es: "Válvulas y Llaves",             en: "Valves & Faucets" },
  { es: "Instalaciones Especiales",      en: "Special Installations" },
  { es: "Voz y Datos",                   en: "Voice & Data" },
  { es: "Limpieza",                      en: "Cleaning" },
  { es: "Pavimentos",                    en: "Pavements" },
  { es: "Obra Exterior",                 en: "Exterior Works" },
  { es: "Impermeabilizaciones",          en: "Waterproofing" },
  { es: "Aluminio y Vidrio",             en: "Aluminum & Glass" },
  { es: "Pintura",                       en: "Painting" },
  { es: "Mobiliario y Equipo",           en: "Furniture & Equipment" },
  { es: "Equipo Contra Incendio",        en: "Fire Protection" },
  { es: "Soportería",                    en: "Supports" },
  { es: "Pilotes",                       en: "Piles" },
] as const;

// Build lookup map: es name → en name (canonical key is always the es value)
const CATEGORY_EN_MAP: Record<string, string> = {};
for (const c of CHAPTER_CATEGORIES) CATEGORY_EN_MAP[c.es] = c.en;

export function getCategoryLabel(cat: string | null | undefined, lang: Locale): string {
  if (!cat) return "";
  if (lang === "en" && CATEGORY_EN_MAP[cat]) return CATEGORY_EN_MAP[cat];
  return cat;
}

// Stable color palette for category badges
const CAT_COLORS = [
  "#3b82f6","#22c55e","#f97316","#a855f7","#ec4899","#14b8a6","#eab308","#ef4444",
  "#6366f1","#0ea5e9","#d946ef","#f43f5e","#84cc16","#06b6d4","#fb923c","#8b5cf6",
];
function categoryColor(cat: string): string {
  let h = 0;
  for (let i = 0; i < cat.length; i++) h = ((h * 31) + cat.charCodeAt(i)) >>> 0;
  return CAT_COLORS[h % CAT_COLORS.length];
}

// ─── design tokens ────────────────────────────────────────────────────────────

const CS = {
  surface: "var(--cs-surface)",
  border:  "var(--cs-border)",
  accent:  "var(--cs-accent)",
  text:    "var(--cs-text)",
  muted:   "var(--cs-muted)",
  bg:      "var(--cs-bg)",
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

export interface EditorDraft {
  id: string | null;
  code: string;
  description: string;
  unit: string;
  category: string | null;
  materials: ApuLineItem[];
  labor: ApuLineItem[];
  equipment: ApuLineItem[];
}

const EMPTY_DRAFT: EditorDraft = {
  id: null,
  code: "",
  description: "",
  unit: "",
  category: null,
  materials: [],
  labor: [],
  equipment: [],
};

function itemToDraft(item: ApuItem): EditorDraft {
  return {
    id: item.id,
    code: item.code,
    description: item.description,
    unit: item.unit,
    category: item.category ?? null,
    materials: (item.materials as ApuLineItem[]) ?? [],
    labor: (item.labor as ApuLineItem[]) ?? [],
    equipment: (item.equipment as ApuLineItem[]) ?? [],
  };
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

// ─── QtyInput: text input with live formula preview ──────────────────────────

function QtyInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [preview, setPreview] = useState<number | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  function handleFocus() {
    setDraft(value === 0 ? "" : String(value));
    setPreview(null);
    setEditing(true);
    setTimeout(() => { ref.current?.select(); }, 0);
  }

  function handleChange(val: string) {
    setDraft(val);
    setPreview(safeEval(val));
  }

  function handleBlur() {
    const evaled = safeEval(draft);
    onChange(evaled !== null ? evaled : (parseFloat(draft) || 0));
    setEditing(false);
    setPreview(null);
  }

  const isFormula = editing && /[+\-*/×÷(]/.test(draft);

  return (
    <div style={{ position: "relative" }}>
      <input
        ref={ref}
        value={editing ? draft : (value || "")}
        type="text"
        inputMode="decimal"
        placeholder="0"
        onChange={(e) => handleChange(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={(e) => { if (e.key === "Enter") { e.currentTarget.blur(); } }}
        style={{
          ...({ background: "transparent", border: "none", outline: "none", color: "var(--cs-text)", fontFamily: "var(--font-dm-sans)", fontSize: "0.8125rem", width: "100%", padding: "0 2px", textAlign: "right" }),
        }}
      />
      {isFormula && preview !== null && (
        <span style={{
          position: "absolute", right: 0, top: "50%", transform: "translateY(-50%) translateX(calc(100% + 4px))",
          fontSize: "0.65rem", fontWeight: 700, color: "var(--cs-accent)", whiteSpace: "nowrap",
          background: "var(--cs-surface)", border: "1px solid var(--cs-border)", borderRadius: 4,
          padding: "1px 4px", pointerEvents: "none", zIndex: 10,
        }}>
          ={preview}
        </span>
      )}
    </div>
  );
}

// ─── Insucons formula ─────────────────────────────────────────────────────────

export interface CostCalc {
  matSub: number;
  labSub: number;
  eqpSub: number;
  matTotal: number;
  labTotal: number;
  eqpTotal: number;
  directCost: number;
  netCost: number;
  utilVal: number;
  sellingPrice: number;
  tot1Val: number;
  tot2Val: number;
  finalPrice: number;
}

export function calcCostsDetailed(draft: EditorDraft, s: ProjectIndirectCosts): CostCalc {
  const sumArr = (arr: ApuLineItem[]) => arr.reduce((t, r) => t + r.qty * r.unit_price, 0);

  // Step 1-2: Raw subtotals (partials are just qty × unit_price)
  const matSub  = sumArr(draft.materials);
  const labSub  = sumArr(draft.labor);
  const eqpSub  = sumArr(draft.equipment);

  // Step 3: Apply section-level indirect costs to subtotals
  const matTotal = matSub * (1 + s.pmat1.pct / 100 + s.pmat2.pct / 100);
  const labTotal = labSub * (1 + s.pmob1.pct / 100 + s.pmob2.pct / 100);
  const eqpTotal = eqpSub * (1 + s.pmaq1.pct / 100 + s.pmaq2.pct / 100);

  // Step 4: Direct cost
  const directCost = matTotal + labTotal + eqpTotal;

  // Step 5: Net cost = CD × (1 + ggen/100)
  const netCost = directCost * (1 + s.ggen.pct / 100);

  // Step 6: Selling price = CN × (1 + util/100)
  const utilVal      = netCost * s.util.pct / 100;
  const sellingPrice = netCost * (1 + s.util.pct / 100);

  // Step 7: Final unit price = PV × (1 + tot1/100 + tot2/100)
  const tot1Val    = sellingPrice * s.tot1.pct / 100;
  const tot2Val    = sellingPrice * s.tot2.pct / 100;
  const finalPrice = sellingPrice * (1 + s.tot1.pct / 100 + s.tot2.pct / 100);

  return {
    matSub, labSub, eqpSub,
    matTotal, labTotal, eqpTotal,
    directCost, netCost,
    utilVal, sellingPrice, tot1Val, tot2Val, finalPrice,
  };
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
    (e) => e.category === tab && e.name.toLowerCase().includes(query.toLowerCase())
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
          maxWidth: 560, maxHeight: "80vh",
          background: CS.surface, border: `1px solid ${CS.border}`,
          borderRadius: 16, overflow: "hidden",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: `1px solid ${CS.border}` }}>
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" style={{ color: CS.accent }} />
            <span className="font-syne font-bold text-base" style={{ color: CS.text }}>
              {language === "es" ? "Biblioteca de Precios" : "Price Library"}
            </span>
            <span className="text-xs font-dm-sans rounded-full px-2 py-0.5" style={{ background: "rgba(249,115,22,0.12)", color: CS.accent }}>
              {MATERIALS_DB.length}
            </span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: CS.muted }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex shrink-0" style={{ borderBottom: `1px solid ${CS.border}` }}>
          {tabs.map((cat) => {
            const cfg = CATEGORY_LABELS[cat];
            const active = tab === cat;
            return (
              <button key={cat} onClick={() => setTab(cat)}
                className="flex-1 py-2.5 text-xs font-semibold font-dm-sans transition-all"
                style={{
                  background: active ? "rgba(255,255,255,0.04)" : "transparent",
                  color: active ? cfg.color : CS.muted, border: "none",
                  borderBottom: active ? `2px solid ${cfg.color}` : "2px solid transparent",
                  cursor: "pointer", marginBottom: -1,
                }}
              >
                {language === "es" ? cfg.es : cfg.en}
                <span className="ml-1.5 rounded-full px-1.5 py-px text-[10px]"
                  style={{ background: active ? `${cfg.color}22` : "transparent", color: active ? cfg.color : CS.muted }}>
                  {MATERIALS_DB.filter((e) => e.category === cat).length}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 px-4 py-2.5 shrink-0" style={{ borderBottom: `1px solid ${CS.border}`, background: "rgba(255,255,255,0.02)" }}>
          <Search className="h-3.5 w-3.5 shrink-0" style={{ color: CS.muted }} />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={language === "es" ? "Buscar..." : "Search..."}
            className="flex-1 bg-transparent text-sm font-dm-sans outline-none" style={{ color: CS.text }} />
          {query && <button onClick={() => setQuery("")} style={{ background: "none", border: "none", cursor: "pointer", color: CS.muted }}><X className="h-3 w-3" /></button>}
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0
            ? <p className="text-center py-10 text-sm font-dm-sans" style={{ color: CS.muted }}>{language === "es" ? "Sin resultados." : "No results."}</p>
            : (
              <table className="w-full text-sm font-dm-sans">
                <thead className="sticky top-0" style={{ background: CS.surface }}>
                  <tr style={{ borderBottom: `1px solid ${CS.border}` }}>
                    <th className="text-left px-4 py-2 text-xs font-semibold" style={{ color: CS.muted }}>{language === "es" ? "Concepto" : "Description"}</th>
                    <th className="text-left px-2 py-2 text-xs font-semibold w-16" style={{ color: CS.muted }}>{language === "es" ? "Unidad" : "Unit"}</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold w-28" style={{ color: CS.muted }}>{language === "es" ? "Precio Ref." : "Ref. Price"}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((entry) => (
                    <tr key={entry.id} className="group cursor-pointer" style={{ borderBottom: `1px solid ${CS.border}` }}
                      onClick={() => { onInsert(entry, tab); onClose(); }}>
                      <td className="px-4 py-2.5 group-hover:text-white transition-colors" style={{ color: CS.text }}>{entry.name}</td>
                      <td className="px-2 py-2.5" style={{ color: CS.muted }}>{entry.unit}</td>
                      <td className="px-4 py-2.5 text-right font-semibold" style={{ color: CS.accent }}>
                        ${entry.unit_price.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>

        <div className="px-4 py-2.5 text-xs font-dm-sans shrink-0" style={{ color: CS.muted, borderTop: `1px solid ${CS.border}`, background: "rgba(255,255,255,0.02)" }}>
          {language === "es" ? "Precios de referencia en MXN. Haz clic en cualquier ítem para insertarlo." : "Reference prices in MXN. Click any item to insert it."}
        </div>
      </div>
    </div>
  );
}

// ─── AIModal ──────────────────────────────────────────────────────────────────

const AI_STEPS: Record<Locale, string[]> = {
  es: ["Analizando concepto de obra…","Generando relación de materiales…","Calculando mano de obra…","Estimando equipo y maquinaria…","Calculando costos directos…","Verificando precios de mercado…","Aplicando factores de GG y utilidad…"],
  en: ["Analyzing construction activity…","Building materials breakdown…","Calculating labor costs…","Estimating equipment…","Computing direct costs…","Verifying market prices…","Applying overhead & profit factors…"],
};

function AIModal({ onFill, onClose }: { onFill: (d: Partial<EditorDraft>) => void; onClose: () => void }) {
  const { language, currency, unitSys } = useWorkspace();
  const lang = language as Locale;
  const [prompt, setPrompt] = useState("");
  const [stepIdx, setStepIdx] = useState(0);
  const { generate, isLoading, error } = useAIAPU();

  useEffect(() => {
    if (!isLoading) { setStepIdx(0); return; }
    const id = setInterval(() => setStepIdx((i) => (i + 1) % AI_STEPS[lang].length), 1600);
    return () => clearInterval(id);
  }, [isLoading, lang]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape" && !isLoading) onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isLoading, onClose]);

  async function handleSubmit() {
    if (!prompt.trim() || isLoading) return;
    const result = await generate({ prompt: prompt.trim(), language: lang, currency, unitSys });
    if (!result) return;
    onFill({
      code: result.code ?? "", description: result.description ?? "",
      unit: result.unit ?? "",
      materials: result.materials ?? [], labor: result.labor ?? [], equipment: result.equipment ?? [],
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && !isLoading && onClose()}>
      <div className="flex flex-col w-full gap-4"
        style={{ maxWidth: 520, background: CS.surface, border: `1px solid ${CS.border}`, borderRadius: 16, padding: "1.5rem", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span style={{ color: CS.accent, fontSize: 18 }}>✦</span>
            <span className="font-syne font-bold text-base" style={{ color: CS.text }}>{lang === "es" ? "Generar APU con IA" : "Generate APU with AI"}</span>
            <span className="text-[10px] font-dm-sans rounded-full px-2 py-px" style={{ background: "rgba(249,115,22,0.12)", color: CS.accent }}>claude-sonnet</span>
          </div>
          <button onClick={onClose} disabled={isLoading} style={{ background: "none", border: "none", cursor: isLoading ? "not-allowed" : "pointer", color: CS.muted }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {!isLoading && (
          <div>
            <label className="block text-xs font-medium font-dm-sans mb-2" style={{ color: CS.muted }}>
              {lang === "es" ? "Describe el concepto de obra:" : "Describe the construction activity:"}
            </label>
            <textarea autoFocus value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3}
              placeholder={lang === "es" ? "Ej: Colado de losa de concreto f'c 210 kg/cm²…" : "E.g: Concrete slab f'c 3000 psi including formwork, rebar, and curing…"}
              className="w-full rounded-lg text-sm font-dm-sans resize-none"
              style={{ padding: "0.6rem 0.75rem", border: `1px solid ${CS.border}`, background: "rgba(255,255,255,0.04)", color: CS.text, outline: "none" }}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit(); }} />
            <p className="text-xs mt-1 font-dm-sans" style={{ color: CS.muted }}>{lang === "es" ? "⌘ Enter para enviar" : "⌘ Enter to submit"}</p>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col gap-3 rounded-xl px-5 py-5" style={{ background: "rgba(249,115,22,0.06)", border: `1px solid rgba(249,115,22,0.18)` }}>
            <div className="flex items-center gap-3">
              <span className="relative flex shrink-0" style={{ width: 20, height: 20 }}>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-40" style={{ background: CS.accent }} />
                <span className="relative inline-flex rounded-full" style={{ width: 20, height: 20, background: "rgba(249,115,22,0.25)" }}>
                  <Loader2 className="h-3.5 w-3.5 animate-spin m-auto" style={{ color: CS.accent }} />
                </span>
              </span>
              <span className="text-sm font-dm-sans font-medium" style={{ color: CS.accent }}>{AI_STEPS[lang][stepIdx]}</span>
            </div>
            <div className="flex items-center gap-1.5 pl-8">
              {AI_STEPS[lang].map((_, i) => (
                <span key={i} className="rounded-full transition-all duration-300"
                  style={{ width: i === stepIdx ? 16 : 5, height: 5, background: i === stepIdx ? CS.accent : i < stepIdx ? "rgba(249,115,22,0.4)" : "rgba(249,115,22,0.15)" }} />
              ))}
            </div>
          </div>
        )}

        {error && !isLoading && (
          <div className="rounded-lg px-4 py-3 text-sm font-dm-sans" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}>
            <span className="font-semibold">Error: </span>{error}
          </div>
        )}

        {!isLoading && (
          <div className="flex gap-2 justify-end">
            <button onClick={onClose} className="px-4 py-2 rounded-[10px] text-sm font-medium font-dm-sans"
              style={{ border: `1px solid ${CS.border}`, background: "transparent", color: CS.muted, cursor: "pointer" }}>
              {t("cancel", lang)}
            </button>
            <button onClick={handleSubmit} disabled={!prompt.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-semibold font-dm-sans"
              style={{ background: CS.accent, color: "#fff", border: "none", cursor: !prompt.trim() ? "not-allowed" : "pointer", opacity: !prompt.trim() ? 0.55 : 1 }}>
              <span style={{ fontSize: 14 }}>✦</span>
              {lang === "es" ? "Generar APU" : "Generate APU"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SectionTable ─────────────────────────────────────────────────────────────

function SectionTable({ section, rows, language, fmt, onChange, onOpenLibrary }:
  { section: MaterialCategory; rows: ApuLineItem[]; language: Locale; fmt: (n: number) => string;
    onChange: (rows: ApuLineItem[]) => void; onOpenLibrary: () => void }
) {
  const cfg = CATEGORY_LABELS[section];
  const label = language === "es" ? cfg.es : cfg.en;
  const subtotal = rows.reduce((s, r) => s + r.qty * r.unit_price, 0);

  function addRow() { onChange([...rows, { name: "", unit: "", qty: 1, unit_price: 0 }]); }
  function updateRow(i: number, field: keyof ApuLineItem, val: string | number) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)));
  }
  function removeRow(i: number) { onChange(rows.filter((_, idx) => idx !== i)); }

  return (
    <div style={{ marginBottom: "1.25rem" }}>
      <div className="flex items-center justify-between px-4 py-2"
        style={{ background: "rgba(255,255,255,0.03)", borderTop: `2px solid ${cfg.color}`, borderBottom: `1px solid ${CS.border}` }}>
        <div className="flex items-center gap-2">
          <span className="rounded-full" style={{ width: 8, height: 8, background: cfg.color, display: "inline-block" }} />
          <span className="text-xs font-semibold font-dm-sans uppercase tracking-wider" style={{ color: cfg.color }}>{label}</span>
          {rows.length > 0 && (
            <span className="text-xs font-dm-sans rounded-full px-2 py-px" style={{ background: `${cfg.color}18`, color: cfg.color }}>{rows.length}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {rows.length > 0 && <span className="text-xs font-semibold font-dm-sans" style={{ color: CS.text }}>{fmt(subtotal)}</span>}
          <button type="button" onClick={onOpenLibrary} className="flex items-center gap-1 text-xs font-dm-sans transition-colors"
            style={{ background: "none", border: "none", cursor: "pointer", color: CS.muted }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = CS.text)}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = CS.muted)}>
            <BookOpen className="h-3 w-3" />
            {language === "es" ? "Biblioteca" : "Library"}
          </button>
          <button type="button" onClick={addRow} className="flex items-center gap-1 text-xs font-dm-sans"
            style={{ background: "none", border: "none", cursor: "pointer", color: cfg.color }}>
            <Plus className="h-3 w-3" />
            {language === "es" ? "Agregar" : "Add row"}
          </button>
        </div>
      </div>

      {rows.length > 0 ? (
        <table className="w-full text-sm font-dm-sans">
          <thead>
            <tr style={{ borderBottom: `1px solid ${CS.border}` }}>
              {(language === "es"
                ? ["Descripción", "Unidad", "Cant.", "P.U.", "Parcial", ""]
                : ["Description", "Unit", "Qty", "Unit Price", "Subtotal", ""]
              ).map((h, i) => (
                <th key={i} className={`py-2 text-xs font-semibold ${i > 1 ? "text-right" : "text-left"} ${i === 0 ? "pl-4" : "px-3"}`}
                  style={{ color: CS.muted }}>{i < 5 ? h : ""}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const partial = row.qty * row.unit_price;
              return (
                <tr key={i} className="group"
                  style={{ borderBottom: `1px solid ${CS.border}`, background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)" }}>
                  <td className="pl-4 pr-2 py-2" style={{ minWidth: 180 }}>
                    <input style={cellInput} value={row.name} placeholder={language === "es" ? "Concepto..." : "Description..."} onChange={(e) => updateRow(i, "name", e.target.value)} />
                  </td>
                  <td className="px-3 py-2" style={{ width: 70 }}>
                    <input style={cellInput} value={row.unit} placeholder="m³" onChange={(e) => updateRow(i, "unit", e.target.value)} />
                  </td>
                  <td className="px-3 py-2" style={{ width: 80, overflow: "visible" }}>
                    <QtyInput value={row.qty} onChange={(v) => updateRow(i, "qty", v)} />
                  </td>
                  <td className="px-3 py-2" style={{ width: 100 }}>
                    <input style={{ ...cellInput, textAlign: "right" }} type="number" min={0} step="any"
                      value={row.unit_price || ""} placeholder="0.00" onChange={(e) => updateRow(i, "unit_price", parseFloat(e.target.value) || 0)} />
                  </td>
                  <td className="px-3 py-2 text-right font-semibold" style={{ width: 110, color: partial > 0 ? CS.text : CS.muted }}>{fmt(partial)}</td>
                  <td className="px-3 py-2" style={{ width: 36 }}>
                    <button type="button" onClick={() => removeRow(i)}
                      className="flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ width: 24, height: 24, background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <div className="px-4 py-3 text-xs font-dm-sans" style={{ color: CS.muted, borderBottom: `1px solid ${CS.border}` }}>
          {language === "es" ? "Sin renglones. Haz clic en Agregar o usa la Biblioteca." : "No rows. Click Add or use the Library."}
        </div>
      )}
    </div>
  );
}

// ─── DetailedCostSummary ──────────────────────────────────────────────────────

function DetailedCostSummary({ draft, settings, fmt, language }:
  { draft: EditorDraft; settings: ProjectIndirectCosts; fmt: (n: number) => string; language: Locale }
) {
  const c = calcCostsDetailed(draft, settings);
  const lang = language;

  const rowStyle: React.CSSProperties = {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "3px 0", fontSize: "0.8rem", fontFamily: "var(--font-dm-sans)",
  };
  const labelStyle: React.CSSProperties = { color: CS.muted };
  const valueStyle: React.CSSProperties = { color: CS.text, fontWeight: 500 };

  function Row({ label, pct, value, bold, accent: isAccent, indent }: { label: string; pct?: number; value: number; bold?: boolean; accent?: boolean; indent?: boolean }) {
    return (
      <div style={{ ...rowStyle, paddingLeft: indent ? 12 : 0 }}>
        <span style={{ ...labelStyle, color: bold ? CS.text : CS.muted }}>
          {label}{pct !== undefined && pct > 0 ? ` (${pct}%)` : ""}
        </span>
        <span style={{ ...valueStyle, color: isAccent ? CS.accent : bold ? CS.text : CS.text, fontWeight: bold ? 700 : 500, fontSize: bold ? "0.95rem" : "0.8rem" }}>
          {fmt(value)}
        </span>
      </div>
    );
  }

  function Divider() {
    return <div style={{ height: 1, background: CS.border, margin: "4px 0" }} />;
  }

  const sectionDot = (color: string): React.CSSProperties => ({
    width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", marginRight: 6,
  });

  return (
    <div style={{ background: "rgba(249,115,22,0.03)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", padding: "1rem 1.25rem" }}>
        {/* Section subtotals with per-section indirects */}
        <div>
          <p className="text-xs font-syne font-bold mb-2 uppercase tracking-wider" style={{ color: CS.muted }}>
            {lang === "es" ? "Desglose por sección" : "Section breakdown"}
          </p>
          {/* Materials */}
          <div style={{ ...rowStyle, paddingLeft: 0 }}>
            <span style={{ display: "flex", alignItems: "center", ...labelStyle }}>
              <span style={sectionDot("#22c55e")} />
              {lang === "es" ? "Subtotal Materiales" : "Materials Subtotal"}
            </span>
            <span style={valueStyle}>{fmt(c.matSub)}</span>
          </div>
          {settings.pmat1.pct > 0 && <Row label={settings.pmat1.label || (lang === "es" ? "Flete y acarreos" : "Freight & handling")} pct={settings.pmat1.pct} value={c.matSub * settings.pmat1.pct / 100} indent />}
          {settings.pmat2.pct > 0 && <Row label={settings.pmat2.label || (lang === "es" ? "Merma y desperdicio" : "Waste & spoilage")} pct={settings.pmat2.pct} value={c.matSub * settings.pmat2.pct / 100} indent />}
          {(settings.pmat1.pct > 0 || settings.pmat2.pct > 0) && <Row label={lang === "es" ? "Total Materiales" : "Materials Total"} value={c.matTotal} bold />}
          <Divider />
          {/* Labor */}
          <div style={{ ...rowStyle, paddingLeft: 0 }}>
            <span style={{ display: "flex", alignItems: "center", ...labelStyle }}>
              <span style={sectionDot("#3b82f6")} />
              {lang === "es" ? "Subtotal Mano de Obra" : "Labor Subtotal"}
            </span>
            <span style={valueStyle}>{fmt(c.labSub)}</span>
          </div>
          {settings.pmob1.pct > 0 && <Row label={settings.pmob1.label || (lang === "es" ? "Seguridad y higiene" : "Safety & hygiene")} pct={settings.pmob1.pct} value={c.labSub * settings.pmob1.pct / 100} indent />}
          {settings.pmob2.pct > 0 && <Row label={settings.pmob2.label || "FSR"} pct={settings.pmob2.pct} value={c.labSub * settings.pmob2.pct / 100} indent />}
          {(settings.pmob1.pct > 0 || settings.pmob2.pct > 0) && <Row label={lang === "es" ? "Total Mano de Obra" : "Labor Total"} value={c.labTotal} bold />}
          <Divider />
          {/* Equipment */}
          <div style={{ ...rowStyle, paddingLeft: 0 }}>
            <span style={{ display: "flex", alignItems: "center", ...labelStyle }}>
              <span style={sectionDot("#a855f7")} />
              {lang === "es" ? "Subtotal Equipos" : "Equipment Subtotal"}
            </span>
            <span style={valueStyle}>{fmt(c.eqpSub)}</span>
          </div>
          {settings.pmaq1.pct > 0 && <Row label={settings.pmaq1.label || (lang === "es" ? "Herramienta menor" : "Small tools")} pct={settings.pmaq1.pct} value={c.eqpSub * settings.pmaq1.pct / 100} indent />}
          {settings.pmaq2.pct > 0 && <Row label={settings.pmaq2.label || "pmaq2"} pct={settings.pmaq2.pct} value={c.eqpSub * settings.pmaq2.pct / 100} indent />}
          {(settings.pmaq1.pct > 0 || settings.pmaq2.pct > 0) && <Row label={lang === "es" ? "Total Equipos" : "Equipment Total"} value={c.eqpTotal} bold />}
        </div>

        {/* Costo Directo */}
        <div>
          <p className="text-xs font-syne font-bold mb-2 uppercase tracking-wider" style={{ color: CS.muted }}>
            {lang === "es" ? "Precio Unitario" : "Unit Price"}
          </p>
          <Row label={lang === "es" ? "Costo Directo (CD)" : "Direct Cost (DC)"} value={c.directCost} bold />
          <Divider />
          {settings.ggen.pct > 0 && <Row label={settings.ggen.label || (lang === "es" ? "Gastos generales y admin." : "General & admin expenses")} pct={settings.ggen.pct} value={c.directCost * settings.ggen.pct / 100} indent />}
          <Row label={lang === "es" ? "Costo Neto (CN)" : "Net Cost (NC)"} value={c.netCost} bold />
          <Divider />
          {settings.util.pct > 0 && <Row label={settings.util.label || (lang === "es" ? "Utilidad" : "Profit")} pct={settings.util.pct} value={c.utilVal} indent />}
          <Row label={lang === "es" ? "Precio de Venta (PV)" : "Selling Price (SP)"} value={c.sellingPrice} bold />
          {(settings.tot1.pct > 0 || settings.tot2.pct > 0) && (
            <>
              <Divider />
              {settings.tot1.pct > 0 && <Row label={settings.tot1.label || "IVA"} pct={settings.tot1.pct} value={c.tot1Val} indent />}
              {settings.tot2.pct > 0 && <Row label={settings.tot2.label || "Impuesto 2"} pct={settings.tot2.pct} value={c.tot2Val} indent />}
            </>
          )}
        </div>

        {/* Final price */}
        <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(249,115,22,0.1)", border: `1px solid rgba(249,115,22,0.25)` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="text-xs font-syne font-bold uppercase" style={{ color: CS.text }}>
              {lang === "es" ? "Precio Unitario Final (PU)" : "Final Unit Price (UP)"}
            </span>
            <span className="font-syne font-bold text-2xl" style={{ color: CS.accent }}>
              {fmt(c.finalPrice)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── APUEditor ────────────────────────────────────────────────────────────────

function APUEditor({ initialDraft, language, currency: _currency, fmt, projectId, userId, projectSettings, onSaved, onCancel, onSendToBudget }:
  { initialDraft: EditorDraft; language: Locale; currency: string; fmt: (n: number) => string;
    projectId: string; userId: string; projectSettings: ProjectIndirectCosts;
    onSaved: (item: ApuItem) => void; onCancel: () => void;
    onSendToBudget?: (item: ApuItem) => void }
) {
  const supabase = createClient();
  const { toast } = useToast();
  const [draft, setDraft]         = useState<EditorDraft>(initialDraft);
  const [saving, setSaving]       = useState(false);
  const [showLibrary, setShowLib] = useState(false);
  const [showAI, setShowAI]       = useState(false);
  const [aiFilled, setAIFilled]   = useState(false);
  const [libSection, setLibSection] = useState<MaterialCategory>("materials");
  const [catOpen, setCatOpen]       = useState(false);
  const [catSearch, setCatSearch]   = useState("");
  const catRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !showLibrary && !showAI && !saving) {
        if (catOpen) { setCatOpen(false); return; }
        onCancel();
      }
    }
    function onClickOutside(e: MouseEvent) {
      if (catOpen && catRef.current && !catRef.current.contains(e.target as Node)) setCatOpen(false);
    }
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClickOutside);
    return () => { window.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onClickOutside); };
  }, [showLibrary, showAI, saving, onCancel, catOpen]);

  const patch = useCallback((p: Partial<EditorDraft>) => setDraft((d) => ({ ...d, ...p })), []);

  function openLibraryFor(section: MaterialCategory) { setLibSection(section); setShowLib(true); }

  function handleLibInsert(entry: MaterialEntry, _cat?: MaterialCategory) {
    const row: ApuLineItem = { name: entry.name, unit: entry.unit, qty: 1, unit_price: entry.unit_price };
    patch({ [libSection]: [...(draft[libSection] as ApuLineItem[]), row] });
  }

  function handleAIFill(filled: Partial<EditorDraft>) { patch(filled); setAIFilled(true); }

  async function handleSave() {
    if (!draft.code.trim() || !draft.description.trim() || !draft.unit.trim()) return;
    if (!projectId) {
      toast(language === "es" ? "No hay proyecto seleccionado" : "No project selected", "error");
      return;
    }
    setSaving(true);
    const c = calcCostsDetailed(draft, projectSettings);
    const payload = {
      project_id:    projectId,
      code:          draft.code.trim(),
      description:   draft.description.trim(),
      unit:          draft.unit.trim(),
      category:      draft.category || null,
      materials:     draft.materials  || [],
      labor:         draft.labor      || [],
      equipment:     draft.equipment  || [],
      direct_cost:   c.directCost,
      overhead_pct:  projectSettings.ggen.pct + projectSettings.pgas1.pct + projectSettings.pgas2.pct,
      profit_pct:    projectSettings.util.pct,
      selling_price: c.finalPrice,
      is_library:    true,
      user_id:       userId,
    };

    let result;
    if (draft.id) {
      result = await supabase.from("apu_items").update(payload).eq("id", draft.id).select().single();
    } else {
      result = await supabase.from("apu_items").insert(payload).select().single();
    }

    setSaving(false);
    if (result.error) {
      console.error("[APU SAVE] Error:", result.error);
      toast(
        language === "es"
          ? `Error al guardar APU: ${result.error.message}`
          : `Failed to save APU: ${result.error.message}`,
        "error"
      );
      return;
    }
    if (result.data) onSaved(result.data as ApuItem);
  }

  const headerInput: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)", border: `1px solid ${CS.border}`,
    borderRadius: 8, color: CS.text, fontFamily: "var(--font-dm-sans)",
    fontSize: "0.8125rem", padding: "0.35rem 0.6rem", outline: "none",
  };
  const isValid = draft.code.trim() && draft.description.trim() && draft.unit.trim();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-3 flex-wrap shrink-0"
        style={{ borderBottom: `1px solid ${CS.border}`, background: "rgba(255,255,255,0.02)" }}>
        <button type="button" onClick={onCancel} aria-label={language === "es" ? "Cerrar editor" : "Close editor"}
          className="flex items-center justify-center rounded-lg shrink-0"
          style={{ width: 30, height: 30, background: "none", border: `1px solid ${CS.border}`, cursor: "pointer", color: CS.muted }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = CS.text)}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = CS.muted)}>
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-syne font-bold text-sm" style={{ color: CS.text }}>
            {draft.id ? (language === "es" ? "Editar APU" : "Edit APU") : (language === "es" ? "Nuevo APU" : "New APU")}
          </span>
          {aiFilled && (
            <span className="flex items-center gap-1 text-[10px] font-dm-sans font-semibold rounded-full px-2 py-px"
              style={{ background: "rgba(249,115,22,0.14)", color: CS.accent, border: "1px solid rgba(249,115,22,0.3)" }}>
              <span style={{ fontSize: 9 }}>✦</span>
              {language === "es" ? "generado por IA" : "AI-generated"}
            </span>
          )}
        </div>
        <div className="w-px self-stretch shrink-0" style={{ background: CS.border }} />
        <input style={{ ...headerInput, width: 76, fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}
          value={draft.code} onChange={(e) => patch({ code: e.target.value })} placeholder="03.01" autoFocus={!draft.id} />
        <input style={{ ...headerInput, flex: 1, minWidth: 160 }} value={draft.description}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder={language === "es" ? "Descripción del concepto *" : "Description *"} />
        <input style={{ ...headerInput, width: 68 }} value={draft.unit}
          onChange={(e) => patch({ unit: e.target.value })} placeholder="m³" />
        {/* Category dropdown */}
        <div ref={catRef} style={{ position: "relative" }}>
          <button type="button" onClick={() => { setCatOpen(!catOpen); setCatSearch(""); }}
            style={{ ...headerInput, width: 180, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: draft.category ? CS.text : CS.muted, fontSize: "0.8125rem" }}>
              {draft.category ? getCategoryLabel(draft.category, language) : t("noCategory", language)}
            </span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, opacity: 0.5 }}><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {catOpen && (
            <div style={{
              position: "absolute", top: "100%", left: 0, marginTop: 4, width: 240,
              background: CS.surface, border: `1px solid ${CS.border}`, borderRadius: 10,
              boxShadow: "0 12px 40px rgba(0,0,0,0.4)", zIndex: 60, maxHeight: 280, display: "flex", flexDirection: "column",
            }}>
              <div style={{ padding: 0, borderBottom: `1px solid ${CS.border}`, background: "rgba(255,255,255,0.02)" }}>
                <input autoFocus value={catSearch} onChange={(e) => setCatSearch(e.target.value)}
                  placeholder={language === "es" ? "Buscar categoría..." : "Search category..."}
                  style={{ ...headerInput, width: "100%", border: "none", padding: "8px 12px", fontSize: 12 }}
                  onKeyDown={(e) => { if (e.key === "Escape") setCatOpen(false); }}
                />
              </div>
              <div style={{ overflowY: "auto", flex: 1 }}>
                {/* No category option */}
                <button type="button" onClick={() => { patch({ category: null }); setCatOpen(false); }}
                  style={{ width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", cursor: "pointer", color: CS.muted, fontSize: 13, fontFamily: "var(--font-dm-sans)", fontStyle: "italic" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}>
                  {language === "es" ? "Sin categoría" : "No category"}
                </button>
                {CHAPTER_CATEGORIES
                  .filter((c) => !catSearch || c.es.toLowerCase().includes(catSearch.toLowerCase()) || c.en.toLowerCase().includes(catSearch.toLowerCase()))
                  .map((cat) => {
                    const selected = draft.category === cat.es;
                    return (
                      <button key={cat.es} type="button"
                        onClick={() => { patch({ category: cat.es }); setCatOpen(false); }}
                        className="flex items-center justify-between"
                        style={{
                          width: "100%", textAlign: "left", padding: "8px 12px", background: selected ? "rgba(249,115,22,0.1)" : "none",
                          border: "none", cursor: "pointer", color: selected ? CS.accent : CS.text,
                          fontSize: 13, fontFamily: "var(--font-dm-sans)", fontWeight: selected ? 600 : 400,
                        }}
                        onMouseEnter={(e) => { if (!selected) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"; }}
                        onMouseLeave={(e) => { if (!selected) (e.currentTarget as HTMLButtonElement).style.background = selected ? "rgba(249,115,22,0.1)" : "none"; }}>
                        <span>{language === "es" ? cat.es : cat.en}</span>
                        {selected && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
        <div className="flex-1" />
        <button type="button" onClick={() => setShowAI(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-dm-sans"
          style={{ background: aiFilled ? "rgba(249,115,22,0.06)" : "rgba(249,115,22,0.12)", border: `1px solid rgba(249,115,22,${aiFilled ? "0.2" : "0.35"})`, color: CS.accent, cursor: "pointer" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(249,115,22,0.22)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = aiFilled ? "rgba(249,115,22,0.06)" : "rgba(249,115,22,0.12)")}>
          <span style={{ fontSize: 13 }}>✦</span>
          {aiFilled ? (language === "es" ? "Regenerar" : "Regenerate") : (language === "es" ? "Sugerir con IA" : "AI Suggest")}
        </button>
        {draft.id && onSendToBudget && (
          <button type="button"
            onClick={() => {
              // Build a temporary ApuItem from current draft to send
              const c = calcCostsDetailed(draft, projectSettings);
              onSendToBudget({
                id: draft.id!, project_id: projectId, code: draft.code, description: draft.description,
                unit: draft.unit, category: draft.category ?? null, materials: draft.materials,
                labor: draft.labor, equipment: draft.equipment, direct_cost: c.directCost,
                overhead_pct: projectSettings.ggen.pct + projectSettings.pgas1.pct + projectSettings.pgas2.pct,
                profit_pct: projectSettings.util.pct, selling_price: c.finalPrice,
                is_library: false, user_id: null, created_at: "", updated_at: "",
              });
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-dm-sans"
            style={{ border: `1px solid ${CS.border}`, background: "transparent", color: CS.muted, cursor: "pointer" }}
            onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = "rgba(249,115,22,0.4)"; b.style.color = CS.accent; }}
            onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = CS.border; b.style.color = CS.muted; }}>
            <Send className="h-3 w-3" />
            {language === "es" ? "Presupuesto" : "Budget"}
          </button>
        )}
        <button type="button" onClick={handleSave} disabled={saving || !isValid}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold font-dm-sans"
          style={{ background: CS.accent, color: "#fff", border: "none", cursor: saving || !isValid ? "not-allowed" : "pointer", opacity: saving || !isValid ? 0.6 : 1 }}>
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {t("save", language)}
        </button>
      </div>

      {/* Two-column layout: sections left, summary right */}
      <div className="flex-1 overflow-hidden flex" style={{ background: CS.bg }}>
        {/* Left column: section tables (~60%) */}
        <div className="flex-1 overflow-y-auto" style={{ minWidth: 0, flex: "0 0 60%" }}>
          <SectionTable section="materials" rows={draft.materials} language={language} fmt={fmt}
            onChange={(rows) => patch({ materials: rows })} onOpenLibrary={() => openLibraryFor("materials")} />
          <SectionTable section="labor" rows={draft.labor} language={language} fmt={fmt}
            onChange={(rows) => patch({ labor: rows })} onOpenLibrary={() => openLibraryFor("labor")} />
          <SectionTable section="equipment" rows={draft.equipment} language={language} fmt={fmt}
            onChange={(rows) => patch({ equipment: rows })} onOpenLibrary={() => openLibraryFor("equipment")} />
        </div>
        {/* Right column: cost summary (~40%), sticky */}
        <div className="overflow-y-auto" style={{ flex: "0 0 40%", borderLeft: `1px solid ${CS.border}` }}>
          <div style={{ position: "sticky", top: 0 }}>
            <DetailedCostSummary draft={draft} settings={projectSettings} fmt={fmt} language={language} />
          </div>
        </div>
      </div>

      {showLibrary && <LibraryModal language={language} onInsert={handleLibInsert} onClose={() => setShowLib(false)} />}
      {showAI && <AIModal onFill={handleAIFill} onClose={() => setShowAI(false)} />}
    </div>
  );
}

// ─── APU list row ─────────────────────────────────────────────────────────────

// ─── APU PDF print helper ─────────────────────────────────────────────────────

function printAPU(item: ApuItem, settings: ProjectIndirectCosts, fmt: (n: number) => string, lang: Locale) {
  const win = window.open("", "_blank", "width=860,height=900,menubar=yes");
  if (!win) return;

  const draft: EditorDraft = {
    id: item.id, code: item.code, description: item.description, unit: item.unit,
    category: item.category ?? null,
    materials: (item.materials as ApuLineItem[]) ?? [],
    labor:     (item.labor     as ApuLineItem[]) ?? [],
    equipment: (item.equipment as ApuLineItem[]) ?? [],
  };
  const c = calcCostsDetailed(draft, settings);

  function sectionHtml(title: string, rows: ApuLineItem[], color: string) {
    if (rows.length === 0) return "";
    const subtotal = rows.reduce((s, r) => s + r.qty * r.unit_price, 0);
    const dataRows = rows.map((r, i) => `<tr style="background:${i % 2 ? "#f9fafb" : "transparent"}">
      <td>${r.name}</td><td style="text-align:center">${r.unit}</td>
      <td style="text-align:right">${r.qty}</td>
      <td style="text-align:right">${fmt(r.unit_price)}</td>
      <td style="text-align:right;font-weight:600">${fmt(r.qty * r.unit_price)}</td>
    </tr>`).join("");
    return `<div style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;padding:5px 8px;border-top:2px solid ${color};border-bottom:1px solid #e5e7eb;background:#f9fafb">
        <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${color}">${title}</span>
        <span style="font-size:10px;font-weight:700;color:#111">${fmt(subtotal)}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:10.5px">
        <thead><tr style="border-bottom:1px solid #e5e7eb">
          <th style="text-align:left;padding:4px 8px;font-size:9.5px;color:#6b7280;font-weight:600;text-transform:uppercase">${lang === "es" ? "Concepto" : "Description"}</th>
          <th style="text-align:center;padding:4px 8px;font-size:9.5px;color:#6b7280;font-weight:600;width:40px">${lang === "es" ? "Und." : "Unit"}</th>
          <th style="text-align:right;padding:4px 8px;font-size:9.5px;color:#6b7280;font-weight:600;width:50px">${lang === "es" ? "Cant." : "Qty"}</th>
          <th style="text-align:right;padding:4px 8px;font-size:9.5px;color:#6b7280;font-weight:600;width:80px">${lang === "es" ? "P.U." : "Unit Price"}</th>
          <th style="text-align:right;padding:4px 8px;font-size:9.5px;color:#6b7280;font-weight:600;width:90px">${lang === "es" ? "Parcial" : "Partial"}</th>
        </tr></thead>
        <tbody>${dataRows}</tbody>
      </table>
    </div>`;
  }

  function calcRow(label: string, value: number, pct?: number, indent?: boolean) {
    return `<div style="display:flex;justify-content:space-between;padding:4px ${indent ? "12px" : "0"};border-bottom:1px solid #f3f4f6">
      <span style="font-size:10.5px;color:${indent ? "#6b7280" : "#111"}">${label}${pct !== undefined && pct > 0 ? ` (${pct}%)` : ""}</span>
      <span style="font-size:10.5px;font-weight:600;color:${indent ? "#111" : "#111"}">${fmt(value)}</span>
    </div>`;
  }

  const matHtml  = sectionHtml(lang === "es" ? "Materiales"  : "Materials",  draft.materials,  "#22c55e");
  const labHtml  = sectionHtml(lang === "es" ? "Mano de Obra": "Labor",      draft.labor,      "#3b82f6");
  const equiHtml = sectionHtml(lang === "es" ? "Equipos"     : "Equipment",  draft.equipment,  "#a855f7");

  let priceCalc = "";
  priceCalc += calcRow(lang === "es" ? "Costo Directo (CD)" : "Direct Cost (DC)", c.directCost);
  if (settings.ggen.pct > 0) priceCalc += calcRow(settings.ggen.label || "Gastos generales", c.directCost * settings.ggen.pct / 100, settings.ggen.pct, true);
  priceCalc += calcRow(lang === "es" ? "Costo Neto (CN)" : "Net Cost (NC)", c.netCost);
  if (settings.util.pct > 0) priceCalc += calcRow(settings.util.label || "Utilidad", c.utilVal, settings.util.pct, true);
  priceCalc += calcRow(lang === "es" ? "Precio de Venta (PV)" : "Selling Price (SP)", c.sellingPrice);
  if (settings.tot1.pct > 0) priceCalc += calcRow(settings.tot1.label || "IVA", c.tot1Val, settings.tot1.pct, true);
  if (settings.tot2.pct > 0) priceCalc += calcRow(settings.tot2.label || "Impuesto 2", c.tot2Val, settings.tot2.pct, true);

  const html = `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"/>
  <title>APU — ${item.code}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,-apple-system,sans-serif;font-size:11px;color:#111827;padding:20px 24px}
    h1{font-size:15px;font-weight:700;margin-bottom:2px}
    h2{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#f97316;margin:16px 0 8px}
    .meta{font-size:10px;color:#6b7280;margin-bottom:14px;display:flex;gap:20px}
    .grid{display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-bottom:16px}
    .price-box{padding:10px;border:1.5px solid #fed7aa;background:#fff7ed;border-radius:8px}
    .price-final{display:flex;justify-content:space-between;align-items:center;padding:8px;background:#f97316;border-radius:6px;margin-top:10px}
    .price-final span:first-child{font-size:10px;font-weight:700;color:#fff;text-transform:uppercase}
    .price-final span:last-child{font-size:17px;font-weight:700;color:#fff}
    .footer{margin-top:16px;font-size:9px;color:#9ca3af;display:flex;justify-content:space-between;border-top:1px solid #e5e7eb;padding-top:8px}
    @media print{body{padding:10px 14px}}
  </style></head><body>
  <h1>APU — ${item.description}</h1>
  <div class="meta">
    <span><strong>${lang === "es" ? "Código" : "Code"}:</strong> ${item.code}</span>
    <span><strong>${lang === "es" ? "Unidad" : "Unit"}:</strong> ${item.unit}</span>
    <span><strong>${lang === "es" ? "Generado" : "Generated"}:</strong> ${new Date().toLocaleDateString(lang === "es" ? "es-MX" : "en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
  </div>

  <div class="grid">
    <div>
      <h2>${lang === "es" ? "Composición de costos" : "Cost breakdown"}</h2>
      ${matHtml}${labHtml}${equiHtml}
    </div>
    <div>
      <h2>${lang === "es" ? "Cálculo del precio" : "Price calculation"}</h2>
      <div class="price-box">
        ${priceCalc}
        <div class="price-final">
          <span>${lang === "es" ? "Precio Unitario Final (PU)" : "Final Unit Price (UP)"}</span>
          <span>${fmt(c.finalPrice)}</span>
        </div>
      </div>
    </div>
  </div>

  <div class="footer">
    <span>ConstruSheet — ${lang === "es" ? "Análisis de Precios Unitarios" : "Unit Price Analysis"}</span>
    <span>${new Date().toISOString().slice(0, 10)}</span>
  </div>
  <script>setTimeout(()=>{window.print();},400)<\/script>
  </body></html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
}

// ─── APU list row ─────────────────────────────────────────────────────────────

function APUListRow({ item, language: _language, fmt, selected, onSelect, onEdit, onDelete, onDuplicate, onSendToBudget, onPrint, onToggleLibrary }:
  { item: ApuItem; language: Locale; fmt: (n: number) => string;
    selected: boolean; onSelect: () => void; onEdit: () => void; onDelete: () => void;
    onDuplicate: () => void; onSendToBudget: () => void; onPrint: () => void;
    onToggleLibrary: () => void; }
) {
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  function handleTrashClick(e: React.MouseEvent) {
    e.stopPropagation();
    setShowConfirm(true);
  }

  return (
    <tr
      className="group cursor-pointer"
      style={{
        borderBottom: `1px solid ${CS.border}`,
        background: selected ? "rgba(249,115,22,0.08)" : undefined,
        outline: selected ? `1px solid rgba(249,115,22,0.3)` : undefined,
      }}
      onClick={() => { onSelect(); }}
      onDoubleClick={() => onEdit()}
    >
      <td className="px-3 py-3 hidden md:table-cell" style={{ width: 28 }}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          onClick={(e) => e.stopPropagation()}
          style={{ cursor: "pointer", accentColor: CS.accent }}
        />
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <code className="text-xs font-mono" style={{ color: CS.accent }}>{item.code}</code>
      </td>
      <td className="px-3 py-3">
        <span className="text-sm font-dm-sans truncate block" style={{ color: CS.text }}>{item.description}</span>
        <span className="text-xs font-dm-sans md:hidden" style={{ color: CS.muted }}>{item.code} · {item.unit}</span>
      </td>
      <td className="px-3 py-3 hidden md:table-cell">
        <span className="text-xs font-dm-sans" style={{ color: CS.muted }}>{item.unit}</span>
      </td>
      <td className="px-3 py-3 hidden md:table-cell">
        {item.category && (() => {
          const col = categoryColor(item.category);
          return (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium font-dm-sans whitespace-nowrap"
              style={{ background: `${col}18`, color: col, border: `1px solid ${col}30` }}>
              {getCategoryLabel(item.category, _language)}
            </span>
          );
        })()}
      </td>
      <td className="px-3 py-3 text-right hidden md:table-cell">
        <span className="text-sm font-dm-sans" style={{ color: CS.text }}>{fmt(item.direct_cost)}</span>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-sm font-semibold font-dm-sans" style={{ color: CS.accent }}>{fmt(item.selling_price)}</span>
      </td>
      <td className="px-3 py-3 hidden md:table-cell">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(); }}
            title={_language === "es" ? "Editar" : "Edit"}
            className="flex items-center justify-center rounded-lg"
            style={{ width: 28, height: 28, background: "none", border: `1px solid ${CS.border}`, cursor: "pointer", color: CS.muted }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = CS.text)}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = CS.muted)}>
            <Pencil className="h-3 w-3" />
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
            title={_language === "es" ? "Duplicar" : "Duplicate"}
            className="flex items-center justify-center rounded-lg"
            style={{ width: 28, height: 28, background: "none", border: `1px solid ${CS.border}`, cursor: "pointer", color: CS.muted }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = CS.text)}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = CS.muted)}>
            <Copy className="h-3 w-3" />
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onPrint(); }}
            title={_language === "es" ? "Imprimir / exportar PDF" : "Print / export PDF"}
            className="flex items-center justify-center rounded-lg"
            style={{ width: 28, height: 28, background: "none", border: `1px solid ${CS.border}`, cursor: "pointer", color: CS.muted }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = CS.text)}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = CS.muted)}>
            <FileText className="h-3 w-3" />
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onSendToBudget(); }}
            title={_language === "es" ? "Enviar al Presupuesto" : "Send to Budget"}
            className="flex items-center gap-1 px-2 rounded-lg text-xs font-medium font-dm-sans"
            style={{ height: 28, background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)", cursor: "pointer", color: CS.accent, whiteSpace: "nowrap" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(249,115,22,0.18)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(249,115,22,0.1)"; }}>
            <Send className="h-3 w-3" />
            {_language === "es" ? "Presupuesto" : "Budget"}
          </button>
          <label className="flex items-center gap-1.5 cursor-pointer" onClick={(e) => e.stopPropagation()}>
            <span className="text-[10px] font-dm-sans" style={{ color: CS.muted }}>Biblioteca</span>
            <div className="relative">
              <input
                type="checkbox"
                checked={item.is_library || false}
                onChange={(e) => { e.stopPropagation(); onToggleLibrary(); }}
                className="peer sr-only"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-600" />
            </div>
          </label>
          <button type="button" onClick={handleTrashClick} disabled={deleting}
            className="flex items-center justify-center rounded-lg"
            style={{ width: 28, height: 28, background: "none", border: "1px solid transparent", cursor: "pointer", color: CS.muted }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(239,68,68,0.3)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = CS.muted; (e.currentTarget as HTMLButtonElement).style.borderColor = "transparent"; }}>
            {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          </button>
        </div>
      </td>
      {showConfirm && (
        <td colSpan={0} style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0, overflow: "visible", border: "none", padding: 0 }}>
          <ConfirmDialog
            isOpen={showConfirm}
            title={_language === "es" ? "¿Eliminar APU?" : "Delete APU?"}
            message={_language === "es"
              ? `Esta acción no se puede deshacer. Se eliminará '${item.description}' permanentemente.`
              : `This action cannot be undone. '${item.description}' will be permanently deleted.`}
            confirmLabel={_language === "es" ? "Eliminar" : "Delete"}
            cancelLabel={_language === "es" ? "Cancelar" : "Cancel"}
            onCancel={() => setShowConfirm(false)}
            onConfirm={() => { setShowConfirm(false); setDeleting(true); onDelete(); }}
          />
        </td>
      )}
    </tr>
  );
}

// ─── APU list view ────────────────────────────────────────────────────────────

function APUList({ items, language, fmt, selectedId, search, onSelect, onNew, onEdit, onDelete, onDuplicate, onSendToBudget, onPrint, onSearch, onAI, onLibrary, onToggleLibrary }:
  { items: ApuItem[]; language: Locale; fmt: (n: number) => string;
    selectedId: string | null; search: string;
    onSelect: (id: string) => void; onNew: () => void;
    onEdit: (item: ApuItem) => void; onDelete: (id: string) => void;
    onDuplicate: (item: ApuItem) => void;
    onSendToBudget: (item: ApuItem) => void;
    onPrint: (item: ApuItem) => void;
    onSearch: (q: string) => void;
    onAI: () => void; onLibrary: () => void;
    onToggleLibrary: (item: ApuItem) => void }
) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const lang = language;

  const GROUP_COLORS = ["#22c55e","#3b82f6","#8b5cf6","#f59e0b","#f97316","#14b8a6","#ef4444","#ec4899"];

  function toggleCollapse(cat: string) {
    setCollapsedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }

  // Unique categories present in current items
  const usedCategories = Array.from(new Set(items.map((i) => i.category).filter(Boolean) as string[])).sort();

  // Apply category filter
  const filtered = categoryFilter ? items.filter((i) => i.category === categoryFilter) : items;

  // Group by category — maintain CHAPTER_CATEGORIES order, uncategorized last
  const groups = useMemo(() => {
    const map = new Map<string, ApuItem[]>();
    for (const item of filtered) {
      const cat = item.category || "__none__";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    // Sort by CHAPTER_CATEGORIES order
    const ordered: { cat: string; label: string; items: ApuItem[]; color: string }[] = [];
    CHAPTER_CATEGORIES.forEach((c, i) => {
      const arr = map.get(c.es);
      if (arr && arr.length > 0) {
        ordered.push({ cat: c.es, label: lang === "es" ? c.es : c.en, items: arr, color: GROUP_COLORS[i % GROUP_COLORS.length] });
        map.delete(c.es);
      }
    });
    // Any remaining categories not in CHAPTER_CATEGORIES
    map.forEach((arr, cat) => {
      if (cat !== "__none__" && arr.length > 0) {
        ordered.push({ cat, label: getCategoryLabel(cat, lang), items: arr, color: GROUP_COLORS[ordered.length % GROUP_COLORS.length] });
      }
    });
    // Uncategorized last
    const uncatArr = map.get("__none__");
    if (uncatArr && uncatArr.length > 0) {
      ordered.push({ cat: "__none__", label: lang === "es" ? "Sin categoría" : "Uncategorized", items: uncatArr, color: "var(--cs-muted)" });
    }
    return ordered;
  }, [filtered, lang]);

  const totalSelling = filtered.reduce((s, i) => s + i.selling_price, 0);
  const selectedItem = filtered.find((i) => i.id === selectedId) ?? null;

  async function handleDeleteSelected() {
    if (!selectedId) return;
    setConfirmDelete(false);
    onDelete(selectedId);
  }

  function handlePrintAPU() {
    const win = window.open("", "_blank", "width=960,height=720,menubar=yes");
    if (!win) return;

    const fmtN = (n: number) => fmt(n);

    function lineRows(arr: ApuLineItem[], color: string): string {
      if (!arr.length) return `<tr><td colspan="5" style="color:#9ca3af;font-style:italic;padding:3px 8px;font-size:10px">${lang === "es" ? "Sin insumos" : "No inputs"}</td></tr>`;
      return arr.map((r) => {
        const sub = r.qty * r.unit_price;
        const pct = sub > 0 ? "" : "";
        return `<tr>
          <td style="padding:3px 8px;padding-left:20px">${r.name}</td>
          <td style="text-align:center;padding:3px 8px;color:#6b7280">${r.unit}</td>
          <td style="text-align:right;padding:3px 8px">${r.qty.toLocaleString(undefined,{maximumFractionDigits:4})}</td>
          <td style="text-align:right;padding:3px 8px">${fmtN(r.unit_price)}</td>
          <td style="text-align:right;padding:3px 8px;font-weight:600;color:${color}">${fmtN(sub)}</td>
        </tr>${pct}`;
      }).join("");
    }

    function sectionHeader(label: string, color: string, subtotal: number): string {
      return `<tr style="background:${color}18">
        <td colspan="4" style="padding:4px 8px;font-weight:700;font-size:10px;text-transform:uppercase;color:${color};letter-spacing:.05em">${label}</td>
        <td style="text-align:right;padding:4px 8px;font-weight:700;color:${color}">${fmtN(subtotal)}</td>
      </tr>`;
    }

    const apuCards = items.map((item, idx) => {
      const mat = (item.materials as ApuLineItem[]) ?? [];
      const lab = (item.labor     as ApuLineItem[]) ?? [];
      const eqp = (item.equipment as ApuLineItem[]) ?? [];
      const sumArr = (arr: ApuLineItem[]) => arr.reduce((s, r) => s + r.qty * r.unit_price, 0);
      const matSub = sumArr(mat);
      const labSub = sumArr(lab);
      const eqpSub = sumArr(eqp);
      const overheadAmt = item.direct_cost * (item.overhead_pct / 100);
      const profitAmt   = item.direct_cost * (item.profit_pct   / 100);

      return `
      <div class="card" ${idx > 0 ? 'style="margin-top:24px"' : ""}>
        <div class="card-header">
          <div>
            <span class="code">${item.code}</span>
            <span class="desc">${item.description}</span>
          </div>
          <span class="unit-badge">${item.unit}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>${lang === "es" ? "Insumo / Recurso" : "Input / Resource"}</th>
              <th style="width:55px;text-align:center">${lang === "es" ? "Unid." : "Unit"}</th>
              <th style="width:65px;text-align:right">${lang === "es" ? "Cant." : "Qty"}</th>
              <th style="width:80px;text-align:right">${lang === "es" ? "P.U." : "Unit P."}</th>
              <th style="width:90px;text-align:right">${lang === "es" ? "Subtotal" : "Subtotal"}</th>
            </tr>
          </thead>
          <tbody>
            ${sectionHeader(lang === "es" ? "Materiales" : "Materials", "#3b82f6", matSub)}
            ${lineRows(mat, "#3b82f6")}
            ${sectionHeader(lang === "es" ? "Mano de obra" : "Labor", "#22c55e", labSub)}
            ${lineRows(lab, "#22c55e")}
            ${sectionHeader(lang === "es" ? "Equipos y herramientas" : "Equipment & Tools", "#f97316", eqpSub)}
            ${lineRows(eqp, "#f97316")}
          </tbody>
          <tfoot>
            <tr class="subtotal-row">
              <td colspan="4" style="text-align:right;font-size:10px;text-transform:uppercase;color:#92400e">${lang === "es" ? "Costo Directo" : "Direct Cost"}</td>
              <td style="text-align:right;font-weight:700">${fmtN(item.direct_cost)}</td>
            </tr>
            <tr class="overhead-row">
              <td colspan="4" style="text-align:right;font-size:10px;color:#6b7280">${lang === "es" ? "Gastos Ind." : "Overhead"} (${item.overhead_pct}%)</td>
              <td style="text-align:right;color:#6b7280">${fmtN(overheadAmt)}</td>
            </tr>
            <tr class="overhead-row">
              <td colspan="4" style="text-align:right;font-size:10px;color:#6b7280">${lang === "es" ? "Utilidad" : "Profit"} (${item.profit_pct}%)</td>
              <td style="text-align:right;color:#6b7280">${fmtN(profitAmt)}</td>
            </tr>
            <tr class="price-row">
              <td colspan="4" style="text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;color:#f97316">${lang === "es" ? "Precio Unitario" : "Unit Price"}</td>
              <td style="text-align:right;font-size:14px;font-weight:700;color:#f97316">${fmtN(item.selling_price)}</td>
            </tr>
          </tfoot>
        </table>
      </div>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8"/>
  <title>${lang === "es" ? "Análisis de Precio Unitario" : "Unit Price Analysis"} — ConstruSheet</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,-apple-system,sans-serif;font-size:11px;color:#111827;padding:24px}
    h1{font-size:18px;font-weight:700;margin-bottom:2px}
    .meta{font-size:10px;color:#6b7280;margin-bottom:16px}
    .card{border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;page-break-inside:avoid}
    .card-header{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#fff7ed;border-bottom:1px solid #fed7aa}
    .code{font-family:monospace;font-size:11px;color:#f97316;font-weight:700;margin-right:10px}
    .desc{font-size:12px;font-weight:600;color:#111827}
    .unit-badge{font-size:10px;font-weight:600;background:#f97316;color:#fff;padding:2px 8px;border-radius:20px;white-space:nowrap}
    table{width:100%;border-collapse:collapse;font-size:10.5px}
    thead th{background:#f97316;color:#fff;padding:4px 8px;text-align:left;font-size:9.5px;font-weight:600;text-transform:uppercase}
    tbody td{border-bottom:1px solid #f3f4f6;vertical-align:middle}
    tbody tr:nth-child(even) td{background:#f9fafb}
    tfoot td{padding:4px 8px;border-top:1px solid #f3f4f6}
    .subtotal-row td{background:#fff7ed!important;border-top:2px solid #fed7aa!important}
    .overhead-row td{background:#fafafa}
    .price-row td{background:#fff7ed!important;border-top:2px solid #fed7aa!important}
    .summary-table{width:100%;border-collapse:collapse;margin-top:20px;font-size:10.5px}
    .summary-table th{background:#1f2937;color:#fff;padding:5px 8px;text-align:left;font-size:9.5px;font-weight:600}
    .summary-table td{padding:4px 8px;border-bottom:1px solid #f3f4f6}
    .summary-table tr:nth-child(even) td{background:#f9fafb}
    .summary-total td{background:#fff7ed!important;font-weight:700;border-top:2px solid #fed7aa!important}
    h2{font-size:11px;font-weight:700;color:#f97316;text-transform:uppercase;letter-spacing:.06em;margin:20px 0 6px}
    .footer{margin-top:16px;font-size:10px;color:#9ca3af;display:flex;justify-content:space-between}
    @media print{body{padding:12px}.card{page-break-inside:avoid}}
  </style>
</head>
<body>
  <h1>ConstruSheet — ${lang === "es" ? "Análisis de Precio Unitario (APU)" : "Unit Price Analysis (APU)"}</h1>
  <div class="meta">${lang === "es" ? "Generado" : "Generated"}: ${new Date().toLocaleDateString(lang === "es" ? "es-MX" : "en-US", { year: "numeric", month: "long", day: "numeric" })} &nbsp;·&nbsp; ${items.length} ${lang === "es" ? "análisis" : "analyses"}</div>

  ${apuCards}

  <h2>${lang === "es" ? "Resumen de precios" : "Price summary"}</h2>
  <table class="summary-table">
    <thead>
      <tr>
        <th style="width:70px">${lang === "es" ? "Código" : "Code"}</th>
        <th>${lang === "es" ? "Descripción" : "Description"}</th>
        <th style="width:50px;text-align:center">${lang === "es" ? "Unid." : "Unit"}</th>
        <th style="width:85px;text-align:right">${lang === "es" ? "Costo Dir." : "Direct Cost"}</th>
        <th style="width:85px;text-align:right">${lang === "es" ? "Precio Unit." : "Unit Price"}</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((item) => `<tr>
        <td><code style="font-family:monospace;color:#f97316;font-size:10px">${item.code}</code></td>
        <td>${item.description}</td>
        <td style="text-align:center;color:#6b7280">${item.unit}</td>
        <td style="text-align:right">${fmtN(item.direct_cost)}</td>
        <td style="text-align:right;font-weight:600;color:#f97316">${fmtN(item.selling_price)}</td>
      </tr>`).join("")}
    </tbody>
    <tfoot>
      <tr class="summary-total">
        <td colspan="4" style="text-align:right;font-size:10px;color:#92400e;text-transform:uppercase">${lang === "es" ? "Total precio de venta" : "Total selling price"}</td>
        <td style="text-align:right;font-size:13px;color:#f97316">${fmtN(totalSelling)}</td>
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

  function handleCSVExport() {
    const headers = [
      lang === "es" ? "Código" : "Code",
      lang === "es" ? "Descripción" : "Description",
      lang === "es" ? "Unidad" : "Unit",
      lang === "es" ? "Costo Directo" : "Direct Cost",
      lang === "es" ? "GG %" : "OH %",
      lang === "es" ? "Utilidad %" : "Profit %",
      lang === "es" ? "Precio Final" : "Selling Price",
    ];
    const csvRows = items.map((item) => [
      item.code, item.description, item.unit,
      item.direct_cost.toFixed(2),
      item.overhead_pct.toFixed(2),
      item.profit_pct.toFixed(2),
      item.selling_price.toFixed(2),
    ]);
    const csv = [headers, ...csvRows]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `apu-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <ToolbarPortal>
        <ToolbarGroup label={lang === "es" ? "Exportar" : "Export"}>
          <TBtn onClick={handleCSVExport} disabled={items.length === 0}>
            <Download className="h-3.5 w-3.5" /> CSV
          </TBtn>
          <TBtn onClick={handlePrintAPU} disabled={items.length === 0}>
            <FileText className="h-3.5 w-3.5" /> PDF
          </TBtn>
        </ToolbarGroup>
        <ToolbarSep />
        <ToolbarGroup label={lang === "es" ? "Biblioteca" : "Library"}>
          <TBtn onClick={onLibrary}>
            <BookOpen className="h-3.5 w-3.5" /> {lang === "es" ? "Biblioteca" : "Library"}
          </TBtn>
        </ToolbarGroup>
        <ToolbarSep />
        <ToolbarGroup label="IA">
          <TBtnAI onClick={onAI}>
            <Sparkles className="h-3.5 w-3.5" /> {lang === "es" ? "Sugerir con IA" : "AI Suggest"}
          </TBtnAI>
        </ToolbarGroup>
        <ToolbarSep />
        <TBtnPrimary onClick={onNew}>
          <Plus className="h-3.5 w-3.5" /> {lang === "es" ? "Nuevo APU" : "New APU"}
        </TBtnPrimary>
      </ToolbarPortal>
    <div className="flex flex-col h-full">
      {/* Header + summary */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <div>
          <h2 className="font-syne font-bold text-lg" style={{ color: CS.text }}>
            {lang === "es" ? "Análisis de Precio Unitario" : "Unit Price Analysis"}
          </h2>
          <div className="flex items-center gap-3 mt-1 font-dm-sans flex-wrap" style={{ fontSize: 12, color: CS.muted }}>
            <span>{filtered.length} {lang === "es" ? "análisis" : "analyses"} · {groups.length} {lang === "es" ? "categorías" : "categories"}</span>
            {totalSelling > 0 && (
              <span style={{ color: CS.text, fontWeight: 600 }}>{fmt(totalSelling)} {lang === "es" ? "total" : "total"}</span>
            )}
            {groups.length > 0 && (
              <span className="hidden md:flex items-center gap-1.5">
                {groups.slice(0, 6).map((g) => (
                  <span key={g.cat} className="rounded-full" style={{ width: 6, height: 6, background: g.color, display: "inline-block" }} />
                ))}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Top toolbar ────────────────────────────────────── */}
      {items.length > 0 && (
        <div
          className="flex items-center gap-2 mb-3 px-3 py-2 rounded-[10px]"
          style={{ border: `1px solid ${CS.border}`, background: CS.surface }}
        >
          {/* Category filter */}
          {usedCategories.length > 0 && (
            <div className="flex items-center gap-1.5">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="font-dm-sans"
                style={{
                  background: "rgba(255,255,255,0.04)", border: `1px solid ${CS.border}`,
                  borderRadius: 8, color: categoryFilter ? CS.text : CS.muted,
                  fontSize: 12, padding: "4px 8px", outline: "none", cursor: "pointer",
                }}
              >
                <option value="">{lang === "es" ? "Todas las categorías" : "All categories"}</option>
                {usedCategories.map((c) => (
                  <option key={c} value={c}>{getCategoryLabel(c, lang)}</option>
                ))}
              </select>
              {categoryFilter && (
                <button onClick={() => setCategoryFilter("")}
                  style={{ background: "none", border: "none", cursor: "pointer", color: CS.muted, display: "flex", alignItems: "center" }}>
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          <div className="w-px self-stretch" style={{ background: CS.border }} />

          {/* Search */}
          <div className="flex items-center gap-2 flex-1" style={{ maxWidth: 280 }}>
            <Search className="h-3.5 w-3.5 shrink-0" style={{ color: CS.muted }} />
            <input
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder={lang === "es" ? "Buscar APUs..." : "Search APUs..."}
              className="flex-1 bg-transparent text-sm font-dm-sans outline-none"
              style={{ color: CS.text }}
            />
            {search && (
              <button onClick={() => onSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: CS.muted }}>
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="w-px self-stretch" style={{ background: CS.border }} />

          {/* Edit selected */}
          <button
            type="button"
            onClick={() => selectedItem && onEdit(selectedItem)}
            disabled={!selectedItem}
            title={lang === "es" ? "Editar seleccionado" : "Edit selected"}
            className="flex items-center justify-center rounded-lg"
            style={{
              width: 30, height: 30, background: "none", border: `1px solid ${CS.border}`,
              cursor: selectedItem ? "pointer" : "not-allowed", color: selectedItem ? CS.text : CS.muted,
              opacity: selectedItem ? 1 : 0.4,
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>

          {/* Duplicate selected */}
          <button
            type="button"
            onClick={() => selectedItem && onDuplicate(selectedItem)}
            disabled={!selectedItem}
            title={lang === "es" ? "Duplicar seleccionado" : "Duplicate selected"}
            className="flex items-center justify-center rounded-lg"
            style={{
              width: 30, height: 30, background: "none", border: `1px solid ${CS.border}`,
              cursor: selectedItem ? "pointer" : "not-allowed", color: selectedItem ? CS.text : CS.muted,
              opacity: selectedItem ? 1 : 0.4,
            }}
          >
            <Copy className="h-3.5 w-3.5" />
          </button>

          {/* Delete selected */}
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-dm-sans" style={{ color: "#ef4444" }}>
                {lang === "es" ? "¿Eliminar?" : "Delete?"}
              </span>
              <button onClick={handleDeleteSelected}
                className="text-xs font-dm-sans px-2 py-1 rounded-lg"
                style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "none", cursor: "pointer" }}>
                {lang === "es" ? "Sí" : "Yes"}
              </button>
              <button onClick={() => setConfirmDelete(false)}
                className="text-xs font-dm-sans px-2 py-1 rounded-lg"
                style={{ background: "none", color: CS.muted, border: `1px solid ${CS.border}`, cursor: "pointer" }}>
                {lang === "es" ? "No" : "No"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => selectedItem && setConfirmDelete(true)}
              disabled={!selectedItem}
              title={lang === "es" ? "Eliminar seleccionado" : "Delete selected"}
              className="flex items-center justify-center rounded-lg"
              style={{
                width: 30, height: 30, background: "none", border: `1px solid ${CS.border}`,
                cursor: selectedItem ? "pointer" : "not-allowed", color: selectedItem ? "#ef4444" : CS.muted,
                opacity: selectedItem ? 1 : 0.4,
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}

          <div className="w-px self-stretch" style={{ background: CS.border }} />

          {/* Send to Budget */}
          <button
            type="button"
            onClick={() => selectedItem && onSendToBudget(selectedItem)}
            disabled={!selectedItem}
            title={lang === "es" ? "Enviar al Presupuesto Actual" : "Send to Current Budget"}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-dm-sans font-semibold"
            style={{
              background: selectedItem ? CS.accent : "rgba(249,115,22,0.15)",
              color: selectedItem ? "#fff" : CS.muted,
              border: "none",
              cursor: selectedItem ? "pointer" : "not-allowed",
              opacity: selectedItem ? 1 : 0.5,
              whiteSpace: "nowrap",
            }}
          >
            <Send className="h-3.5 w-3.5" />
            {lang === "es" ? "Enviar al Presupuesto" : "Send to Budget"}
          </button>

          <div className="flex-1" />

          {selectedItem && (
            <span className="text-xs font-dm-sans hidden md:inline" style={{ color: CS.muted }}>
              {lang === "es" ? "Seleccionado:" : "Selected:"} <code style={{ color: CS.accent }}>{selectedItem.code}</code>
            </span>
          )}
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-[10px] text-center gap-4"
          style={{ padding: "60px 24px" }}>
          <FileSpreadsheet className="h-12 w-12" style={{ color: CS.muted }} />
          <p className="font-dm-sans font-medium" style={{ fontSize: 18, color: CS.text }}>
            {lang === "es" ? "No hay análisis de precios" : "No unit price analyses yet"}
          </p>
          <p className="text-sm font-dm-sans" style={{ color: CS.muted, maxWidth: 400, textAlign: "center" }}>
            {lang === "es"
              ? "Crea tu primer APU para comenzar a construir tu presupuesto"
              : "Create your first APU to start building your budget"}
          </p>
          <button onClick={onNew} className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-semibold font-dm-sans"
            style={{ background: CS.accent, color: "#fff", border: "none", cursor: "pointer" }}>
            <Plus className="h-4 w-4" />{lang === "es" ? "Nuevo APU" : "New APU"}
          </button>
          <ApuTooltip lang={lang} />
        </div>
      )}

      {/* Grouped table */}
      {items.length > 0 && (
        <div className="rounded-[10px] overflow-hidden flex-1 flex flex-col" style={{ border: `1px solid ${CS.border}` }}>
          <div className="flex-1 overflow-y-auto">
            {groups.map((group) => {
              const collapsed = collapsedCats.has(group.cat);
              const groupTotal = group.items.reduce((s, i) => s + i.selling_price, 0);
              const Chev = collapsed ? ChevronRight : ChevronDown;
              return (
                <div key={group.cat}>
                  {/* Category header */}
                  <div
                    className="flex items-center justify-between px-3 py-2 cursor-pointer select-none group"
                    style={{
                      background: "var(--cs-bg2, rgba(255,255,255,0.03))",
                      borderBottom: `1px solid ${CS.border}`,
                      borderLeft: `3px solid ${group.color}`,
                    }}
                    onClick={() => toggleCollapse(group.cat)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Chev className="h-3.5 w-3.5 shrink-0" style={{ color: group.color }} />
                      <span className="font-syne font-bold text-xs uppercase tracking-wider truncate" style={{ color: group.color }}>
                        {group.label}
                      </span>
                      <span
                        className="text-[10px] font-dm-sans font-medium rounded-full px-1.5 py-px shrink-0"
                        style={{ background: `${group.color}18`, color: group.color }}
                      >
                        {group.items.length} APU{group.items.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <span className="text-xs font-semibold font-dm-sans shrink-0" style={{ color: group.color }}>
                      {fmt(groupTotal)}
                    </span>
                  </div>

                  {/* APU rows */}
                  {!collapsed && (
                    <table className="w-full font-dm-sans">
                      <tbody>
                        {group.items.map((item) => (
                          <APUListRow key={item.id} item={item} language={language} fmt={fmt}
                            selected={selectedId === item.id}
                            onSelect={() => onSelect(item.id === selectedId ? "" : item.id)}
                            onEdit={() => onEdit(item)}
                            onDelete={() => onDelete(item.id)}
                            onDuplicate={() => onDuplicate(item)}
                            onSendToBudget={() => onSendToBudget(item)}
                            onPrint={() => onPrint(item)}
                            onToggleLibrary={() => onToggleLibrary(item)} />
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer total */}
          <div className="flex items-center justify-between px-5 py-3 shrink-0"
            style={{ borderTop: `1px solid ${CS.border}`, background: "rgba(249,115,22,0.04)" }}>
            <span className="text-sm font-dm-sans" style={{ color: CS.muted }}>
              {lang === "es" ? "Total precio final" : "Total final price"}
            </span>
            <span className="font-syne font-bold text-xl" style={{ color: CS.accent }}>{fmt(totalSelling)}</span>
          </div>
        </div>
      )}

      {/* Bottom toolbar removed — actions moved to top toolbar */}

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
          <div className="flex flex-col gap-4 p-6 rounded-2xl"
            style={{ background: CS.surface, border: `1px solid ${CS.border}`, maxWidth: 360, width: "100%" }}>
            <div className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" style={{ color: "#ef4444" }} />
              <span className="font-syne font-bold text-base" style={{ color: CS.text }}>
                {lang === "es" ? "Eliminar APU" : "Delete APU"}
              </span>
            </div>
            <p className="text-sm font-dm-sans" style={{ color: CS.muted }}>
              {lang === "es"
                ? `¿Eliminar "${selectedItem?.description}"? Esta acción no se puede deshacer.`
                : `Delete "${selectedItem?.description}"? This cannot be undone.`}
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 rounded-[10px] text-sm font-medium font-dm-sans"
                style={{ border: `1px solid ${CS.border}`, background: "transparent", color: CS.muted, cursor: "pointer" }}>
                {lang === "es" ? "Cancelar" : "Cancel"}
              </button>
              <button onClick={handleDeleteSelected}
                className="px-4 py-2 rounded-[10px] text-sm font-semibold font-dm-sans"
                style={{ background: "#ef4444", color: "#fff", border: "none", cursor: "pointer" }}>
                {lang === "es" ? "Eliminar" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

// ─── Send to Budget Modal ─────────────────────────────────────────────────────

function SendToBudgetModal({
  item, projectId, language, fmt, onConfirm, onClose,
}: {
  item: ApuItem;
  projectId: string;
  language: Locale;
  fmt: (n: number) => string;
  onConfirm: (item: ApuItem, section: string, qty: number, isNewChapter: boolean) => Promise<void>;
  onClose: () => void;
}) {
  const supabase = createClient();
  const [sectionMode, setSectionMode] = useState<"existing" | "new">("existing");
  const [selectedSection, setSelectedSection] = useState("");
  const [newSection, setNewSection] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [saving, setSaving] = useState(false);
  const [existingSections, setExistingSections] = useState<string[]>([]);
  const lang = language;
  const qty = parseFloat(quantity) || 0;
  const estimatedTotal = qty * item.selling_price;

  useEffect(() => {
    async function loadSections() {
      const { data } = await supabase
        .from("budget_rows")
        .select("section")
        .eq("project_id", projectId);
      if (data) {
        const seen = new Set<string>();
        const unique: string[] = [];
        for (const r of data as { section: string }[]) {
          const trimmed = r.section.trim();
          if (trimmed && !seen.has(trimmed)) { seen.add(trimmed); unique.push(trimmed); }
        }
        setExistingSections(unique);

        // Pre-fill section from APU category
        if (item.category) {
          const catLabel = getCategoryLabel(item.category, language);
          const match = unique.find(
            (s) => s.toUpperCase() === item.category!.toUpperCase() || s.toUpperCase() === catLabel.toUpperCase()
          );
          if (match) {
            setSelectedSection(match);
            setSectionMode("existing");
          } else {
            setNewSection(item.category);
            setSectionMode(unique.length > 0 ? "existing" : "new");
          }
        } else if (unique.length > 0) {
          setSelectedSection(unique[0]);
        } else {
          setSectionMode("new");
        }
      }
    }
    loadSections();
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [projectId, onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  const effectiveSection = sectionMode === "new" ? newSection.trim() : selectedSection.trim();
  const isNewChapter = sectionMode === "new" && !!newSection.trim();

  async function handleSubmit() {
    if (!effectiveSection) return;
    setSaving(true);
    await onConfirm(item, effectiveSection, qty || 1, isNewChapter);
    setSaving(false);
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%", padding: "0.4rem 0.625rem", borderRadius: 8,
    border: `1px solid ${CS.border}`, background: "rgba(255,255,255,0.04)",
    color: CS.text, fontSize: "0.8125rem", fontFamily: "var(--font-dm-sans)", outline: "none",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full flex flex-col gap-4"
        style={{
          maxWidth: 420, background: CS.surface,
          border: `1px solid ${CS.border}`, borderRadius: 16,
          padding: "1.5rem", boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4" style={{ color: CS.accent }} />
            <span className="font-syne font-bold text-base" style={{ color: CS.text }}>
              {lang === "es" ? "Enviar al Presupuesto" : "Send to Budget"}
            </span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: CS.muted }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* APU summary */}
        <div
          className="rounded-[10px] p-3"
          style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)" }}
        >
          <p className="text-xs font-dm-sans font-medium" style={{ color: CS.accent }}>{item.code}</p>
          <p className="text-sm font-dm-sans mt-0.5 truncate" style={{ color: CS.text }}>{item.description}</p>
          <p className="text-xs font-dm-sans mt-0.5" style={{ color: CS.muted }}>
            {item.unit} · {lang === "es" ? "P.V." : "S.P."}: <strong style={{ color: CS.accent }}>{fmt(item.selling_price)}</strong>
          </p>
        </div>

        {/* Chapter / Section */}
        <div>
          <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 500, color: CS.muted, fontFamily: "var(--font-dm-sans)", marginBottom: 4 }}>
            {lang === "es" ? "Capítulo / Sección" : "Chapter / Section"} *
          </label>
          {sectionMode === "new" ? (
            <div className="flex gap-2 items-center">
              <input
                style={fieldStyle}
                value={newSection}
                onChange={(e) => setNewSection(e.target.value)}
                placeholder={lang === "es" ? "Ej. 03 · CONCRETO" : "E.g. 03 · CONCRETE"}
                autoFocus
              />
              {existingSections.length > 0 && (
                <button type="button" onClick={() => { setSectionMode("existing"); setSelectedSection(existingSections[0]); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: CS.accent, fontSize: "0.75rem", fontFamily: "var(--font-dm-sans)", whiteSpace: "nowrap" }}>
                  {lang === "es" ? "Existente" : "Existing"}
                </button>
              )}
            </div>
          ) : (
            <select
              style={fieldStyle}
              value={selectedSection}
              onChange={(e) => {
                if (e.target.value === "__new__") { setSectionMode("new"); setNewSection(""); }
                else setSelectedSection(e.target.value);
              }}
            >
              {existingSections.map((s) => <option key={s} value={s}>{s}</option>)}
              <option value="__new__">{lang === "es" ? "+ Nuevo capítulo..." : "+ New chapter..."}</option>
            </select>
          )}
        </div>

        {/* Quantity */}
        <div>
          <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 500, color: CS.muted, fontFamily: "var(--font-dm-sans)", marginBottom: 4 }}>
            {lang === "es" ? "Cantidad" : "Quantity"}
          </label>
          <input
            type="number"
            min={0}
            step="any"
            style={fieldStyle}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          {qty > 0 && (
            <p className="text-xs font-dm-sans mt-1.5" style={{ color: CS.muted }}>
              {lang === "es" ? "Total estimado" : "Estimated total"}: <strong style={{ color: CS.accent }}>{fmt(estimatedTotal)}</strong>
            </p>
          )}
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onClose}
            className="px-4 py-2 rounded-[10px] text-sm font-medium font-dm-sans"
            style={{ border: `1px solid ${CS.border}`, background: "transparent", color: CS.muted, cursor: "pointer" }}>
            {lang === "es" ? "Cancelar" : "Cancel"}
          </button>
          <button onClick={handleSubmit} disabled={saving || !effectiveSection}
            className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-semibold font-dm-sans"
            style={{ background: CS.accent, color: "#fff", border: "none", cursor: saving || !effectiveSection ? "not-allowed" : "pointer", opacity: saving || !effectiveSection ? 0.6 : 1 }}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <Send className="h-3.5 w-3.5" />
            {lang === "es" ? "Enviar" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main APUTab ──────────────────────────────────────────────────────────────

type View = { kind: "list" } | { kind: "editor"; draft: EditorDraft };

function ApuTooltip({ lang }: { lang: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="flex items-center gap-1 text-xs font-dm-sans"
        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--cs-muted)" }}
      >
        <Info className="h-3.5 w-3.5" />
        {lang === "es" ? "¿Qué es un APU?" : "What is a UPA?"}
      </button>
      {show && (
        <span
          className="absolute left-1/2 mt-2 -translate-x-1/2 rounded-lg text-xs font-dm-sans p-3 z-50"
          style={{ background: "var(--cs-surface)", border: "1px solid var(--cs-border)", color: "var(--cs-text)", maxWidth: 320, textAlign: "left", whiteSpace: "normal" }}
        >
          {lang === "es"
            ? "El Análisis de Precios Unitarios (APU) desglosa el costo de cada actividad en materiales, mano de obra y equipo. Es la base para construir un presupuesto preciso."
            : "A Unit Price Analysis (UPA) breaks down the cost of each activity into materials, labor, and equipment. It is the foundation for building an accurate budget."}
        </span>
      )}
    </span>
  );
}

interface APUTabProps {
  initialItems: ApuItem[];
  onCountChange?: (n: number) => void;
}

export default function APUTab({ initialItems, onCountChange }: APUTabProps) {
  const { projectId, language, currency, fmt, projectSettings, setActiveTab, userId } = useWorkspace();
  const { toast } = useToast();
  const { can } = usePlan(userId);
  const [items, setItems]   = useState<ApuItem[]>(initialItems);
  const [view, setView]     = useState<View>({ kind: "list" });
  const [showLibrary, setShowLibrary] = useState(false);
  const [upgradePrompt, setUpgradePrompt] = useState<{ feature: string; description: string } | null>(null);
  const [showAI, setShowAI]           = useState(false);
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [search, setSearch]           = useState("");
  const [sendItem, setSendItem]       = useState<ApuItem | null>(null); // APU → Budget modal

  const apuShortcuts = useMemo(() => ({
    n: () => { if (view.kind === "list") setView({ kind: "editor", draft: { ...EMPTY_DRAFT } }); },
    N: () => { if (view.kind === "list") setView({ kind: "editor", draft: { ...EMPTY_DRAFT } }); },
  }), [view.kind]);
  useKeyboardShortcuts(apuShortcuts);

  // ── realtime subscription ─────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`apu:${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "apu_items", filter: `project_id=eq.${projectId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newItem = payload.new as ApuItem;
            setItems((prev) => {
              if (prev.some((i) => i.id === newItem.id)) return prev;
              return [newItem, ...prev];
            });
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as ApuItem;
            setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
          } else if (payload.eventType === "DELETE") {
            const deleted = payload.old as { id: string };
            setItems((prev) => prev.filter((i) => i.id !== deleted.id));
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId]);

  // ── one-time dedup cleanup: remove duplicate apu_items (same project_id + description + code) ──
  useEffect(() => {
    async function dedup() {
      const supabase = createClient();
      const { data } = await supabase
        .from("apu_items")
        .select("id, code, description, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (!data || data.length === 0) return;

      const seen = new Map<string, string>(); // key → kept id (most recent)
      const toDelete: string[] = [];
      for (const row of data) {
        const key = `${row.code}|||${row.description}`;
        if (seen.has(key)) {
          toDelete.push(row.id);
        } else {
          seen.set(key, row.id);
        }
      }
      if (toDelete.length === 0) return;

      const { error } = await supabase.from("apu_items").delete().in("id", toDelete);
      if (!error) {
        setItems((prev) => prev.filter((i) => !toDelete.includes(i.id)));
      }
    }
    dedup();
  }, [projectId]);

  useEffect(() => { onCountChange?.(items.length); }, [items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredItems = search.trim()
    ? items.filter((i) =>
        i.description.toLowerCase().includes(search.toLowerCase()) ||
        i.code.toLowerCase().includes(search.toLowerCase())
      )
    : items;

  function openNew() { setView({ kind: "editor", draft: { ...EMPTY_DRAFT } }); }
  function openEdit(item: ApuItem) { setView({ kind: "editor", draft: itemToDraft(item) }); }

  async function handleSaved(saved: ApuItem) {
    const prev = items.find((i) => i.id === saved.id);
    const priceChanged = prev && Math.abs(prev.selling_price - saved.selling_price) > 0.001;

    setItems((list) => {
      const idx = list.findIndex((i) => i.id === saved.id);
      if (idx >= 0) { const next = [...list]; next[idx] = saved; return next; }
      return [saved, ...list];
    });
    setView({ kind: "list" });

    // If this is an update with a changed price, check for linked budget rows
    if (priceChanged && saved.id) {
      const supabase = createClient();
      const { data: linked } = await supabase
        .from("budget_rows")
        .select("id")
        .eq("project_id", projectId)
        .eq("apu_item_id", saved.id);
      if (linked && linked.length > 0) {
        toast(
          language === "es"
            ? `Precio APU actualizado. ¿Sincronizar ${linked.length} partida(s) del presupuesto?`
            : `APU price updated. Sync ${linked.length} linked budget row(s)?`,
          "info",
          {
            label: language === "es" ? "Sincronizar" : "Sync",
            onClick: async () => {
              await supabase
                .from("budget_rows")
                .update({ unit_price: saved.selling_price })
                .eq("apu_item_id", saved.id)
                .eq("project_id", projectId);
              toast(
                language === "es"
                  ? `${linked.length} partida(s) actualizadas`
                  : `${linked.length} row(s) updated`,
                "success"
              );
            },
          }
        );
      }
    }
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("apu_items").delete().eq("id", id);
    if (error) {
      toast(
        language === "es"
          ? "Error al eliminar el APU"
          : "Failed to delete APU",
        "error"
      );
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (selectedId === id) setSelectedId(null);
    toast(
      language === "es" ? "APU eliminado" : "APU deleted",
      "success"
    );
  }

  async function handleDuplicate(source: ApuItem) {
    const supabase = createClient();
    // Generate a unique code: append "-2", or increment existing suffix
    const codeMatch = source.code.match(/^(.*?)(-(\d+))?$/);
    const baseCode = codeMatch?.[1] ?? source.code;
    const existingNums = items
      .map((i) => { const m = i.code.match(/^(.*?)-(\d+)$/); return m && m[1] === baseCode ? parseInt(m[2]) : null; })
      .filter((n): n is number => n !== null);
    const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 2;
    const newCode = `${baseCode}-${nextNum}`;

    const payload = {
      project_id:    projectId,
      code:          newCode,
      description:   source.description,
      unit:          source.unit,
      category:      source.category ?? null,
      materials:     source.materials,
      labor:         source.labor,
      equipment:     source.equipment,
      direct_cost:   source.direct_cost,
      overhead_pct:  source.overhead_pct,
      profit_pct:    source.profit_pct,
      selling_price: source.selling_price,
    };
    const { data, error } = await supabase.from("apu_items").insert(payload).select().single();
    if (!error && data) {
      setItems((prev) => {
        // Insert immediately after the source item
        const idx = prev.findIndex((i) => i.id === source.id);
        const next = [...prev];
        next.splice(idx + 1, 0, data as ApuItem);
        return next;
      });
      setSelectedId((data as ApuItem).id);
    }
  }

  async function handleToggleLibrary(item: ApuItem) {
    const supabase = createClient();
    const newVal = !item.is_library;
    const { error } = await supabase.from("apu_items").update({ is_library: newVal, user_id: newVal ? userId : null }).eq("id", item.id);
    if (!error) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_library: newVal } : i)));
      toast(
        newVal
          ? (language === "es" ? "Agregado a biblioteca" : "Added to library")
          : (language === "es" ? "Quitado de biblioteca" : "Removed from library"),
        "success"
      );
    }
  }

  function handleSendToBudget(item: ApuItem) {
    setSendItem(item);
  }

  async function handleConfirmSendToBudget(item: ApuItem, section: string, quantity: number, isNewChapter: boolean) {
    const supabase = createClient();
    const { data: maxRow } = await supabase
      .from("budget_rows")
      .select("sort_order")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: false })
      .limit(1);
    let nextOrder = ((maxRow?.[0]?.sort_order ?? 0) as number) + 1;

    // If new chapter, insert chapter header row first
    if (isNewChapter) {
      const { error: chErr } = await supabase.from("budget_rows").insert({
        project_id:  projectId,
        section:     section.trim(),
        code:        "",
        description: section.trim(),
        unit:        "",
        quantity:    0,
        unit_price:  0,
        status:      "pending" as const,
        sort_order:  nextOrder,
        is_chapter:  true,
      });
      if (chErr) {
        console.error("[APU→Budget] Chapter insert error:", chErr);
        toast(
          language === "es"
            ? `Error al crear capítulo: ${chErr.message}`
            : `Failed to create chapter: ${chErr.message}`,
          "error"
        );
        return;
      }
      nextOrder += 1;
    }

    const { error } = await supabase.from("budget_rows").insert({
      project_id:  projectId,
      apu_item_id: item.id,
      section:     section.trim() || "APU",
      code:        item.code,
      description: item.description,
      unit:        item.unit,
      quantity,
      unit_price:  item.selling_price,
      original_quantity:   quantity,
      status:      "pending" as const,
      sort_order:  nextOrder,
      is_chapter:  false,
    });
    if (error) {
      console.error("[APU→Budget] Insert error:", error);
      toast(
        language === "es"
          ? `Error al agregar al presupuesto: ${error.message}`
          : `Failed to add to budget: ${error.message}`,
        "error"
      );
      return;
    }
    setSendItem(null);
    toast(
      language === "es"
        ? `"${item.description}" agregado al presupuesto`
        : `"${item.description}" added to budget`,
      "success",
      {
        label: language === "es" ? "Ver presupuesto" : "View budget",
        onClick: () => setActiveTab("budget"),
      }
    );
  }

  return (
    <>
      {view.kind === "list" && (
        <APUList
          items={filteredItems}
          language={language}
          fmt={fmt}
          selectedId={selectedId}
          search={search}
          onSelect={(id) => setSelectedId(id || null)}
          onNew={() => {
            if (!can.createAPU(items.length)) {
              setUpgradePrompt({
                feature: language === "es" ? "APUs ilimitados" : "Unlimited APUs",
                description: language === "es"
                  ? "El plan gratuito incluye hasta 10 APUs por proyecto. Actualiza a Pro para crear ilimitados."
                  : "The free plan includes up to 10 APUs per project. Upgrade to Pro for unlimited.",
              });
              return;
            }
            openNew();
          }}
          onEdit={openEdit}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onSendToBudget={handleSendToBudget}
          onPrint={(item) => printAPU(item, projectSettings, fmt, language as Locale)}
          onSearch={setSearch}
          onAI={() => {
            if (!can.useAI()) {
              setUpgradePrompt({
                feature: language === "es" ? "Sugerir con IA" : "AI Suggest",
                description: language === "es"
                  ? "Genera APUs automáticamente con inteligencia artificial."
                  : "Generate APUs automatically with artificial intelligence.",
              });
              return;
            }
            setShowAI(true);
          }}
          onLibrary={() => setShowLibrary(true)}
          onToggleLibrary={handleToggleLibrary}
        />
      )}

      {showLibrary && view.kind !== "editor" && (
        <LibraryModal
          language={language}
          onInsert={(entry, section) => {
            const lineItem: ApuLineItem = { name: entry.name, unit: entry.unit, qty: 1, unit_price: entry.unit_price };
            const draft: EditorDraft = {
              ...EMPTY_DRAFT,
              [section]: [lineItem],
            };
            setShowLibrary(false);
            setView({ kind: "editor", draft });
          }}
          onClose={() => setShowLibrary(false)}
        />
      )}

      {showAI && view.kind !== "editor" && (
        <AIModal
          onFill={(filled) => { setShowAI(false); setView({ kind: "editor", draft: { ...EMPTY_DRAFT, ...filled } }); }}
          onClose={() => setShowAI(false)}
        />
      )}

      {sendItem && (
        <SendToBudgetModal
          item={sendItem}
          projectId={projectId}
          language={language}
          fmt={fmt}
          onConfirm={handleConfirmSendToBudget}
          onClose={() => setSendItem(null)}
        />
      )}

      {view.kind === "editor" && (
        <div className="fixed inset-0 z-40 flex items-start justify-center p-4"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", paddingTop: 80 }}>
          <div className="w-full flex flex-col"
            style={{
              maxWidth: 1080, height: "calc(100vh - 120px)",
              background: CS.surface, border: `1px solid ${CS.border}`,
              borderRadius: 16, overflow: "hidden",
              boxShadow: "0 32px 96px rgba(0,0,0,0.6)",
            }}>
            <APUEditor
              initialDraft={view.draft}
              language={language}
              currency={currency}
              fmt={fmt}
              projectId={projectId}
              userId={userId}
              projectSettings={projectSettings}
              onSaved={handleSaved}
              onCancel={() => setView({ kind: "list" })}
              onSendToBudget={handleSendToBudget}
            />
          </div>
        </div>
      )}

      {upgradePrompt && (
        <UpgradePrompt
          feature={upgradePrompt.feature}
          description={upgradePrompt.description}
          lang={language as Locale}
          onClose={() => setUpgradePrompt(null)}
        />
      )}
    </>
  );
}

// ─── Export helper for BudgetTab to reuse the formula ─────────────────────────
export { ArrowLeft };
