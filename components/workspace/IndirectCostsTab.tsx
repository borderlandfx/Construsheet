"use client";

import { useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { useWorkspace } from "@/lib/context/WorkspaceContext";
import { useToast } from "@/lib/context/ToastContext";
import { type ProjectIndirectCosts } from "@/lib/types/database.types";

// ─── Color palette per section ───────────────────────────────────────────────

const PALETTE = [
  { accent: "#22c55e", bg: "rgba(34,197,94,0.05)" },   // Materials
  { accent: "#3b82f6", bg: "rgba(59,130,246,0.05)" },   // Labor
  { accent: "#8b5cf6", bg: "rgba(139,92,246,0.05)" },   // Equipment
  { accent: "#f59e0b", bg: "rgba(245,158,11,0.05)" },   // General & admin
  { accent: "#f97316", bg: "rgba(249,115,22,0.05)" },   // Profit
  { accent: "#ef4444", bg: "rgba(239,68,68,0.05)" },    // Taxes
] as const;

// ─── Section definitions ─────────────────────────────────────────────────────

interface FieldDef {
  key: keyof ProjectIndirectCosts;
  label: { es: string; en: string };
  desc:  { es: string; en: string };
}

const SECTIONS: {
  num: number;
  title: { es: string; en: string };
  formula: { es: string; en: string };
  fields: FieldDef[];
}[] = [
  {
    num: 1,
    title: { es: "Materiales", en: "Materials" },
    formula: { es: "Subtotal × (1 + pmat1% + pmat2%)", en: "Subtotal × (1 + pmat1% + pmat2%)" },
    fields: [
      { key: "pmat1", label: { es: "Flete y acarreos", en: "Freight & handling" }, desc: { es: "Transporte de materiales a obra", en: "Material transport to site" } },
      { key: "pmat2", label: { es: "Merma y desperdicio", en: "Waste & spoilage" }, desc: { es: "Pérdida por corte, rotura o desperdicio", en: "Loss from cutting, breakage or waste" } },
    ],
  },
  {
    num: 2,
    title: { es: "Mano de Obra", en: "Labor" },
    formula: { es: "Subtotal × (1 + pmob1% + pmob2%)", en: "Subtotal × (1 + pmob1% + pmob2%)" },
    fields: [
      { key: "pmob1", label: { es: "Seguridad y higiene", en: "Safety & hygiene" }, desc: { es: "Equipo de protección personal", en: "PPE and safety measures" } },
      { key: "pmob2", label: { es: "FSR", en: "FSR" }, desc: { es: "Factor de salario real", en: "Real salary factor" } },
    ],
  },
  {
    num: 3,
    title: { es: "Maquinaria y Equipos", en: "Equipment" },
    formula: { es: "Subtotal × (1 + pmaq1%)", en: "Subtotal × (1 + pmaq1%)" },
    fields: [
      { key: "pmaq1", label: { es: "Herramienta menor", en: "Small tools" }, desc: { es: "Desgaste de herramienta menor", en: "Small tool wear and tear" } },
    ],
  },
  {
    num: 4,
    title: { es: "Gastos Generales e Indirectos", en: "General & Admin Expenses" },
    formula: { es: "Costo Directo × ggen% → Costo Neto", en: "Direct Cost × ggen% → Net Cost" },
    fields: [
      { key: "ggen", label: { es: "Gastos generales y admin.", en: "General & admin expenses" }, desc: { es: "Oficina, supervisión, administración", en: "Office, supervision, administration" } },
    ],
  },
  {
    num: 5,
    title: { es: "Utilidad", en: "Profit" },
    formula: { es: "Costo Neto × util% → Precio Unitario Total", en: "Net Cost × util% → Total Unit Price" },
    fields: [
      { key: "util", label: { es: "Utilidad", en: "Profit margin" }, desc: { es: "Margen de ganancia sobre costo neto", en: "Profit margin on net cost" } },
    ],
  },
  {
    num: 6,
    title: { es: "Impuestos", en: "Taxes" },
    formula: { es: "Precio Unitario Total × tot1% → Precio Unitario Final", en: "Total Unit Price × tot1% → Final Unit Price" },
    fields: [
      { key: "tot1", label: { es: "IVA", en: "VAT" }, desc: { es: "Impuesto al valor agregado", en: "Value added tax" } },
    ],
  },
];

// ─── Live calculation ────────────────────────────────────────────────────────

function calcPreview(d: ProjectIndirectCosts) {
  const matBase = 1000, labBase = 500, eqpBase = 200;

  const matFlete  = matBase * d.pmat1.pct / 100;
  const matMerma  = matBase * d.pmat2.pct / 100;
  const matTotal  = matBase + matFlete + matMerma;

  const labSeg    = labBase * d.pmob1.pct / 100;
  const labFsr    = labBase * d.pmob2.pct / 100;
  const labTotal  = labBase + labSeg + labFsr;

  const eqpHerr   = eqpBase * d.pmaq1.pct / 100;
  const eqpTotal   = eqpBase + eqpHerr;

  const directCost = matTotal + labTotal + eqpTotal;
  const ggenVal    = directCost * d.ggen.pct / 100;
  const netCost    = directCost + ggenVal;
  const utilVal    = netCost * d.util.pct / 100;
  const sellPrice  = netCost + utilVal;
  const tot1Val    = sellPrice * d.tot1.pct / 100;
  const finalPrice = sellPrice + tot1Val;

  return {
    matBase, matFlete, matMerma, matTotal,
    labBase, labSeg, labFsr, labTotal,
    eqpBase, eqpHerr, eqpTotal,
    directCost, ggenVal, netCost,
    utilVal, sellPrice, tot1Val, finalPrice,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function IndirectCostsTab() {
  const { language, projectSettings, saveProjectSettings } = useWorkspace();
  const { toast } = useToast();
  const isEs = language === "es";

  const [draft, setDraft] = useState<ProjectIndirectCosts>({ ...projectSettings });
  const [saving, setSaving] = useState(false);

  const preview = useMemo(() => calcPreview(draft), [draft]);

  function updatePct(key: keyof ProjectIndirectCosts, value: string) {
    setDraft((prev) => ({
      ...prev,
      [key]: { ...prev[key], pct: parseFloat(value) || 0 },
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveProjectSettings(draft);
      toast(isEs ? "Cambios guardados" : "Changes saved", "success");
    } catch {
      toast(isEs ? "Error al guardar" : "Error saving", "error");
    }
    setSaving(false);
  }

  const f = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 className="font-syne font-bold text-lg" style={{ color: "var(--cs-text)" }}>
          {isEs ? "Costos Indirectos del Proyecto" : "Project Indirect Costs"}
        </h2>
        <p className="text-xs font-dm-sans mt-1" style={{ color: "var(--cs-muted)" }}>
          {isEs
            ? "Estos porcentajes se aplican automáticamente a todos los APUs del proyecto"
            : "These percentages are automatically applied to all project APUs"}
        </p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[55fr_45fr] gap-6 items-start">
        {/* Left: sections */}
        <div className="flex flex-col gap-3">
          {SECTIONS.map((section, si) => {
            const pal = PALETTE[si];
            return (
              <div
                key={section.num}
                className="rounded-xl overflow-hidden relative"
                style={{
                  border: "0.5px solid var(--cs-border)",
                  background: pal.bg,
                }}
              >
                {/* Left accent bar */}
                <div
                  className="absolute left-0 top-0 bottom-0"
                  style={{ width: 3, background: pal.accent }}
                />

                {/* Header */}
                <div className="pl-5 pr-4 pt-3 pb-2">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-syne font-bold" style={{ fontSize: 14, color: pal.accent }}>
                      {section.num}.—
                    </span>
                    <span className="font-syne font-bold" style={{ fontSize: 14, color: "var(--cs-text)" }}>
                      {isEs ? section.title.es : section.title.en}
                    </span>
                  </div>
                  <p className="font-dm-sans italic mt-0.5" style={{ fontSize: 11, color: "var(--cs-muted)" }}>
                    {isEs ? section.formula.es : section.formula.en}
                  </p>
                </div>

                {/* Fields */}
                {section.fields.map((field) => (
                  <div
                    key={field.key}
                    className="flex items-center justify-between gap-3 pl-5 pr-4 py-2.5"
                    style={{ borderTop: "0.5px solid var(--cs-border)" }}
                  >
                    <div className="flex flex-col gap-0 min-w-0">
                      <span className="font-dm-sans" style={{ fontSize: 13, fontWeight: 500, color: "var(--cs-text)" }}>
                        {isEs ? field.label.es : field.label.en}
                      </span>
                      <span className="font-dm-sans italic" style={{ fontSize: 11, color: "var(--cs-muted)" }}>
                        {isEs ? field.desc.es : field.desc.en}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={draft[field.key].pct || ""}
                        placeholder="0"
                        onChange={(e) => updatePct(field.key, e.target.value)}
                        className="font-dm-sans text-right"
                        style={{
                          width: 70,
                          padding: "5px 8px",
                          borderRadius: 6,
                          border: "1px solid var(--cs-border)",
                          background: "rgba(255,255,255,0.04)",
                          color: "var(--cs-text)",
                          fontSize: 14,
                          outline: "none",
                        }}
                      />
                      <span className="font-dm-sans" style={{ fontSize: 13, color: "var(--cs-muted)" }}>%</span>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          {/* Save button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold font-dm-sans"
            style={{
              background: "var(--cs-accent)",
              color: "#fff",
              border: "none",
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEs ? "Guardar cambios" : "Save changes"}
          </button>
          <p className="text-center font-dm-sans" style={{ fontSize: 11, color: "var(--cs-muted)", marginTop: -8 }}>
            {isEs
              ? "Los cambios se aplicarán a todos los APUs nuevos de este proyecto"
              : "Changes will apply to all new APUs in this project"}
          </p>
        </div>

        {/* Right: live preview (sticky) */}
        <div className="lg:sticky lg:top-4">
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid var(--cs-border)", background: "var(--cs-surface)" }}
          >
            {/* Preview header */}
            <div
              className="px-4 py-3"
              style={{ borderBottom: "1px solid var(--cs-border)", background: "rgba(249,115,22,0.06)" }}
            >
              <span className="font-syne font-bold text-sm" style={{ color: "var(--cs-text)" }}>
                {isEs ? "Ejemplo de Cálculo" : "Calculation Example"}
              </span>
            </div>

            <div className="px-4 py-3 flex flex-col gap-0 font-dm-sans" style={{ fontSize: 12 }}>
              {/* Materials */}
              <PreviewLine label={isEs ? "Materiales base" : "Materials base"} value={f(preview.matBase)} />
              <PreviewLine label={`+ ${isEs ? "Flete" : "Freight"} (${draft.pmat1.pct}%)`} value={`+${f(preview.matFlete)}`} muted />
              <PreviewLine label={`+ ${isEs ? "Merma" : "Waste"} (${draft.pmat2.pct}%)`} value={`+${f(preview.matMerma)}`} muted />
              <PreviewSubtotal label={isEs ? "Total materiales" : "Total materials"} value={f(preview.matTotal)} color="#22c55e" />

              <Spacer />

              {/* Labor */}
              <PreviewLine label={isEs ? "Mano de obra base" : "Labor base"} value={f(preview.labBase)} />
              <PreviewLine label={`+ ${isEs ? "Seg. higiene" : "Safety"} (${draft.pmob1.pct}%)`} value={`+${f(preview.labSeg)}`} muted />
              <PreviewLine label={`+ FSR (${draft.pmob2.pct}%)`} value={`+${f(preview.labFsr)}`} muted />
              <PreviewSubtotal label={isEs ? "Total mano de obra" : "Total labor"} value={f(preview.labTotal)} color="#3b82f6" />

              <Spacer />

              {/* Equipment */}
              <PreviewLine label={isEs ? "Maquinaria base" : "Equipment base"} value={f(preview.eqpBase)} />
              <PreviewLine label={`+ ${isEs ? "Herr. menor" : "Small tools"} (${draft.pmaq1.pct}%)`} value={`+${f(preview.eqpHerr)}`} muted />
              <PreviewSubtotal label={isEs ? "Total maquinaria" : "Total equipment"} value={f(preview.eqpTotal)} color="#8b5cf6" />

              <div className="my-2" style={{ borderTop: "1px dashed var(--cs-border)" }} />

              {/* Aggregates */}
              <PreviewSubtotal label={isEs ? "Costo Directo (CD)" : "Direct Cost (DC)"} value={f(preview.directCost)} color="var(--cs-text)" />
              <PreviewLine label={`+ ${isEs ? "Gastos grls" : "G&A"} (${draft.ggen.pct}%)`} value={`+${f(preview.ggenVal)}`} muted />
              <PreviewSubtotal label={isEs ? "Costo Neto (CN)" : "Net Cost (NC)"} value={f(preview.netCost)} color="#f59e0b" />
              <PreviewLine label={`+ ${isEs ? "Utilidad" : "Profit"} (${draft.util.pct}%)`} value={`+${f(preview.utilVal)}`} muted />
              <PreviewSubtotal label={isEs ? "Precio Unitario Total (PUT)" : "Total Unit Price (TUP)"} value={f(preview.sellPrice)} color="#f97316" />
              <PreviewLine label={`+ IVA (${draft.tot1.pct}%)`} value={`+${f(preview.tot1Val)}`} muted />

              <div className="my-2" style={{ borderTop: "1px solid var(--cs-border)" }} />

              {/* Final */}
              <div className="flex items-center justify-between py-1">
                <span className="font-syne font-bold" style={{ fontSize: 13, color: "var(--cs-text)" }}>
                  {isEs ? "PRECIO UNITARIO FINAL" : "FINAL UNIT PRICE"}
                </span>
                <span className="font-syne font-bold" style={{ fontSize: 16, color: "#f97316" }}>
                  {f(preview.finalPrice)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Preview sub-components ──────────────────────────────────────────────────

function PreviewLine({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span style={{ color: muted ? "var(--cs-muted)" : "var(--cs-text)" }}>{label}</span>
      <span style={{ color: muted ? "var(--cs-muted)" : "var(--cs-text)", fontFamily: "monospace" }}>{value}</span>
    </div>
  );
}

function PreviewSubtotal({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span style={{ fontWeight: 600, color }}>{label}</span>
      <span style={{ fontWeight: 700, color, fontFamily: "monospace" }}>{value}</span>
    </div>
  );
}

function Spacer() {
  return <div style={{ height: 8 }} />;
}
