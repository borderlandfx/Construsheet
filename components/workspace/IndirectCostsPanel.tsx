"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Settings2 } from "lucide-react";
import { useWorkspace } from "@/lib/context/WorkspaceContext";
import {
  type ProjectIndirectCosts,
  DEFAULT_INDIRECT_COSTS,
} from "@/lib/types/database.types";
import type { Locale } from "@/lib/utils/i18n";

// ─── Design tokens ────────────────────────────────────────────────────────────

const CS = {
  surface:  "var(--cs-surface)",
  border:   "var(--cs-border)",
  accent:   "var(--cs-accent)",
  text:     "var(--cs-text)",
  muted:    "var(--cs-muted)",
  bg:       "var(--cs-bg)",
} as const;

// ─── Formula helpers ──────────────────────────────────────────────────────────

interface CalcResult {
  matSub:      number;
  matTotal:    number;
  labSub:      number;
  labTotal:    number;
  eqpSub:      number;
  eqpTotal:    number;
  directCost:  number;
  ggenVal:     number;
  pgas1Val:    number;
  pgas2Val:    number;
  adminTotal:  number;
  netCost:     number;
  utilVal:     number;
  sellingPrice: number;
  tot1Val:     number;
  tot2Val:     number;
  finalPrice:  number;
}

/** Calculate cost structure with 100.00 base for materials, labor, and equipment each */
function calcPreview(s: ProjectIndirectCosts): CalcResult {
  const BASE = 100;
  const matSub  = BASE;
  const labSub  = BASE;
  const eqpSub  = BASE;

  const matTotal   = matSub  * (1 + s.pmat1.pct / 100 + s.pmat2.pct / 100);
  const labTotal   = labSub  * (1 + s.pmob1.pct / 100 + s.pmob2.pct / 100);
  const eqpTotal   = eqpSub  * (1 + s.pmaq1.pct / 100 + s.pmaq2.pct / 100);
  const directCost = matTotal + labTotal + eqpTotal;

  const ggenVal    = directCost * s.ggen.pct  / 100;
  const pgas1Val   = directCost * s.pgas1.pct / 100;
  const pgas2Val   = directCost * s.pgas2.pct / 100;
  const adminTotal = ggenVal + pgas1Val + pgas2Val;
  const netCost    = directCost + adminTotal;

  const utilVal     = netCost * s.util.pct / 100;
  const sellingPrice = netCost + utilVal;

  const tot1Val    = sellingPrice * s.tot1.pct / 100;
  const tot2Val    = sellingPrice * s.tot2.pct / 100;
  const finalPrice = sellingPrice + tot1Val + tot2Val;

  return {
    matSub, matTotal, labSub, labTotal, eqpSub, eqpTotal,
    directCost, ggenVal, pgas1Val, pgas2Val, adminTotal, netCost,
    utilVal, sellingPrice, tot1Val, tot2Val, finalPrice,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface LineRowProps {
  label: string;
  pctKey: keyof ProjectIndirectCosts;
  draft: ProjectIndirectCosts;
  preview?: number;
  language: Locale;
  onChange: (key: keyof ProjectIndirectCosts, field: "label" | "pct", value: string) => void;
}

function LineRow({ label: sectionLabel, pctKey, draft, preview, language, onChange }: LineRowProps) {
  const line = draft[pctKey];
  const inputBase: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)",
    border: `1px solid ${CS.border}`,
    borderRadius: 6,
    color: CS.text,
    fontFamily: "var(--font-dm-sans)",
    fontSize: "0.8rem",
    padding: "3px 6px",
    outline: "none",
  };

  return (
    <tr style={{ borderBottom: `1px solid ${CS.border}` }}>
      <td
        className="pl-3 py-2 text-xs font-dm-sans"
        style={{ color: CS.muted, width: 90, whiteSpace: "nowrap" }}
      >
        {sectionLabel}
      </td>
      <td className="px-2 py-2" style={{ minWidth: 160 }}>
        <input
          style={{ ...inputBase, width: "100%" }}
          value={line.label}
          onChange={(e) => onChange(pctKey, "label", e.target.value)}
          placeholder={language === "es" ? "Descripción..." : "Description..."}
        />
      </td>
      <td className="px-2 py-2" style={{ width: 72 }}>
        <div className="flex items-center gap-1">
          <input
            style={{ ...inputBase, width: 52, textAlign: "right" }}
            type="number"
            min={0}
            max={200}
            step={0.5}
            value={line.pct || ""}
            placeholder="0"
            onChange={(e) => onChange(pctKey, "pct", e.target.value)}
          />
          <span className="text-xs font-dm-sans" style={{ color: CS.muted }}>%</span>
        </div>
      </td>
      <td
        className="px-3 py-2 text-right text-xs font-dm-sans font-semibold"
        style={{ color: preview !== undefined && preview > 0 ? CS.accent : CS.muted, width: 90 }}
      >
        {preview !== undefined ? preview.toFixed(2) : "—"}
      </td>
    </tr>
  );
}

interface SectionHeaderProps {
  label: string;
  color?: string;
}

function SectionHeader({ label, color = CS.accent }: SectionHeaderProps) {
  return (
    <tr>
      <td
        colSpan={4}
        style={{
          padding: "8px 12px 4px",
          background: "rgba(255,255,255,0.02)",
          borderTop: `2px solid ${color}`,
          borderBottom: `1px solid ${CS.border}`,
        }}
      >
        <span
          className="text-xs font-syne font-bold uppercase tracking-wider"
          style={{ color }}
        >
          {label}
        </span>
      </td>
    </tr>
  );
}

function SubtotalRow({ label, value, color = CS.text }: { label: string; value: number; color?: string }) {
  return (
    <tr style={{ borderBottom: `1px solid ${CS.border}`, background: "rgba(255,255,255,0.025)" }}>
      <td colSpan={3} className="pl-3 py-1.5 text-xs font-dm-sans font-semibold" style={{ color: CS.muted }}>
        {label}
      </td>
      <td className="px-3 py-1.5 text-right text-xs font-dm-sans font-bold" style={{ color }}>
        {value.toFixed(2)}
      </td>
    </tr>
  );
}

// ─── IndirectCostsPanel ───────────────────────────────────────────────────────

interface IndirectCostsPanelProps {
  onClose: () => void;
}

export default function IndirectCostsPanel({ onClose }: IndirectCostsPanelProps) {
  const { language, saveProjectSettings, saveDefaultSettings, projectSettings } = useWorkspace();
  const lang = language as Locale;

  const [draft, setDraft] = useState<ProjectIndirectCosts>({ ...projectSettings });
  const [saving, setSaving] = useState(false);
  const [savingDefault, setSavingDefault] = useState(false);
  const [saved, setSaved] = useState(false);

  const preview = calcPreview(draft);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function onChange(key: keyof ProjectIndirectCosts, field: "label" | "pct", value: string) {
    setDraft((d) => ({
      ...d,
      [key]: {
        ...d[key],
        [field]: field === "pct" ? (parseFloat(value) || 0) : value,
      },
    }));
    setSaved(false);
  }

  function handleReset() {
    setDraft({ ...DEFAULT_INDIRECT_COSTS });
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    await saveProjectSettings(draft);
    setSaving(false);
    setSaved(true);
  }

  async function handleSaveDefault() {
    setSavingDefault(true);
    await saveDefaultSettings(draft);
    setSavingDefault(false);
    setSaved(true);
  }

  const thStyle: React.CSSProperties = {
    padding: "6px 10px",
    textAlign: "left",
    fontSize: "0.7rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: CS.muted,
    background: "rgba(255,255,255,0.03)",
    borderBottom: `1px solid ${CS.border}`,
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="flex flex-col w-full"
        style={{
          maxWidth: 680,
          maxHeight: "90vh",
          background: CS.surface,
          border: `1px solid ${CS.border}`,
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 32px 96px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: `1px solid ${CS.border}` }}
        >
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" style={{ color: CS.accent }} />
            <span className="font-syne font-bold text-base" style={{ color: CS.text }}>
              {lang === "es" ? "Costos Indirectos" : "Indirect Costs"}
            </span>
            <span
              className="text-xs font-dm-sans rounded-full px-2 py-0.5"
              style={{ background: "rgba(249,115,22,0.12)", color: CS.accent }}
            >
              {lang === "es" ? "Por proyecto" : "Per project"}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: CS.muted }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full font-dm-sans" style={{ fontSize: "0.8125rem" }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 90 }}>{lang === "es" ? "Clave" : "Key"}</th>
                <th style={thStyle}>{lang === "es" ? "Descripción" : "Description"}</th>
                <th style={{ ...thStyle, width: 72 }}>%</th>
                <th style={{ ...thStyle, width: 90, textAlign: "right" }}>
                  {lang === "es" ? "Previsión" : "Preview"}
                </th>
              </tr>
            </thead>
            <tbody>
              {/* ── Materials ── */}
              <SectionHeader
                label={lang === "es" ? "1 · Materiales" : "1 · Materials"}
                color="#60a5fa"
              />
              <LineRow pctKey="pmat1" label="pmat1" draft={draft} language={lang} onChange={onChange}
                preview={preview.matSub * draft.pmat1.pct / 100} />
              <LineRow pctKey="pmat2" label="pmat2" draft={draft} language={lang} onChange={onChange}
                preview={preview.matSub * draft.pmat2.pct / 100} />
              <SubtotalRow
                label={lang === "es" ? "Total materiales (base 100)" : "Total materials (base 100)"}
                value={preview.matTotal}
                color="#60a5fa"
              />

              {/* ── Labor ── */}
              <SectionHeader
                label={lang === "es" ? "2 · Mano de Obra" : "2 · Labor"}
                color="#4ade80"
              />
              <LineRow pctKey="pmob1" label="pmob1" draft={draft} language={lang} onChange={onChange}
                preview={preview.labSub * draft.pmob1.pct / 100} />
              <LineRow pctKey="pmob2" label="pmob2" draft={draft} language={lang} onChange={onChange}
                preview={preview.labSub * draft.pmob2.pct / 100} />
              <SubtotalRow
                label={lang === "es" ? "Total mano de obra (base 100)" : "Total labor (base 100)"}
                value={preview.labTotal}
                color="#4ade80"
              />

              {/* ── Equipment ── */}
              <SectionHeader
                label={lang === "es" ? "3 · Maquinaria y Equipos" : "3 · Equipment"}
                color="#fb923c"
              />
              <LineRow pctKey="pmaq1" label="pmaq1" draft={draft} language={lang} onChange={onChange}
                preview={preview.eqpSub * draft.pmaq1.pct / 100} />
              <LineRow pctKey="pmaq2" label="pmaq2" draft={draft} language={lang} onChange={onChange}
                preview={preview.eqpSub * draft.pmaq2.pct / 100} />
              <SubtotalRow
                label={lang === "es" ? "Total equipos (base 100)" : "Total equipment (base 100)"}
                value={preview.eqpTotal}
                color="#fb923c"
              />

              {/* ── Direct cost total ── */}
              <SubtotalRow
                label={lang === "es" ? "COSTO DIRECTO (CD)" : "DIRECT COST (CD)"}
                value={preview.directCost}
                color={CS.text}
              />

              {/* ── General & admin ── */}
              <SectionHeader
                label={lang === "es"
                  ? "4 · Gastos Generales y Administrativos"
                  : "4 · General & Admin Expenses"}
                color="#a78bfa"
              />
              <LineRow pctKey="ggen"  label="ggen"  draft={draft} language={lang} onChange={onChange}
                preview={preview.ggenVal} />
              <LineRow pctKey="pgas1" label="pgas1" draft={draft} language={lang} onChange={onChange}
                preview={preview.pgas1Val} />
              <LineRow pctKey="pgas2" label="pgas2" draft={draft} language={lang} onChange={onChange}
                preview={preview.pgas2Val} />
              <SubtotalRow
                label={lang === "es" ? "COSTO NETO (CN)" : "NET COST (CN)"}
                value={preview.netCost}
                color="#a78bfa"
              />

              {/* ── Profit ── */}
              <SectionHeader
                label={lang === "es" ? "5 · Utilidad" : "5 · Profit"}
                color="#f472b6"
              />
              <LineRow pctKey="util" label="util" draft={draft} language={lang} onChange={onChange}
                preview={preview.utilVal} />
              <SubtotalRow
                label={lang === "es" ? "PRECIO DE VENTA (PV)" : "SELLING PRICE (PV)"}
                value={preview.sellingPrice}
                color="#f472b6"
              />

              {/* ── Taxes ── */}
              <SectionHeader
                label={lang === "es" ? "6 · Impuestos" : "6 · Taxes"}
                color="#fbbf24"
              />
              <LineRow pctKey="tot1" label="tot1" draft={draft} language={lang} onChange={onChange}
                preview={preview.tot1Val} />
              <LineRow pctKey="tot2" label="tot2" draft={draft} language={lang} onChange={onChange}
                preview={preview.tot2Val} />

              {/* ── Final price ── */}
              <tr style={{ borderTop: `2px solid ${CS.accent}`, background: "rgba(249,115,22,0.06)" }}>
                <td colSpan={3} className="pl-3 py-3 font-syne font-bold text-sm" style={{ color: CS.text }}>
                  {lang === "es" ? "PRECIO FINAL UNITARIO (PU)" : "FINAL UNIT PRICE (PU)"}
                </td>
                <td className="px-3 py-3 text-right" style={{ color: CS.accent }}>
                  <span className="font-syne font-bold text-xl">
                    {preview.finalPrice.toFixed(2)}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>

          <p
            className="px-4 py-2.5 text-xs font-dm-sans"
            style={{ color: CS.muted, borderTop: `1px solid ${CS.border}`, background: "rgba(255,255,255,0.02)" }}
          >
            {lang === "es"
              ? "La previsión usa 100.00 como base para cada categoría (mat. + MO + equipo)."
              : "Preview uses 100.00 as the base for each category (mat + labor + equip)."}
          </p>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0 flex-wrap gap-3"
          style={{ borderTop: `1px solid ${CS.border}`, background: "rgba(255,255,255,0.02)" }}
        >
          <button
            type="button"
            onClick={handleReset}
            className="text-xs font-dm-sans px-3 py-2 rounded-lg"
            style={{
              border: `1px solid ${CS.border}`,
              background: "transparent",
              color: CS.muted,
              cursor: "pointer",
            }}
          >
            {lang === "es" ? "Restablecer valores" : "Reset to defaults"}
          </button>

          <div className="flex items-center gap-2">
            {saved && (
              <span className="text-xs font-dm-sans" style={{ color: "#22c55e" }}>
                ✓ {lang === "es" ? "Guardado" : "Saved"}
              </span>
            )}
            <button
              type="button"
              onClick={handleSaveDefault}
              disabled={savingDefault}
              className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-sm font-medium font-dm-sans"
              style={{
                border: `1px solid ${CS.border}`,
                background: "transparent",
                color: savingDefault ? CS.muted : CS.text,
                cursor: savingDefault ? "not-allowed" : "pointer",
              }}
            >
              {savingDefault && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {lang === "es" ? "Guardar como predeterminado" : "Save as default"}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-sm font-semibold font-dm-sans"
              style={{
                background: CS.accent,
                color: "#fff",
                border: "none",
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {lang === "es" ? "Guardar" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
