"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useWorkspace } from "@/lib/context/WorkspaceContext";
import { useToast } from "@/lib/context/ToastContext";
import {
  type ProjectIndirectCosts,
} from "@/lib/types/database.types";
import type { Locale } from "@/lib/utils/i18n";

const CS = {
  surface: "var(--cs-surface)",
  border:  "var(--cs-border)",
  accent:  "var(--cs-accent)",
  text:    "var(--cs-text)",
  muted:   "var(--cs-muted)",
} as const;

interface FieldDef {
  key: keyof ProjectIndirectCosts;
  label: { es: string; en: string };
  desc:  { es: string; en: string };
}

const SECTIONS: {
  title: { es: string; en: string };
  fields: FieldDef[];
}[] = [
  {
    title: { es: "Materiales", en: "Materials" },
    fields: [
      { key: "pmat1", label: { es: "Flete y acarreos", en: "Freight & handling" }, desc: { es: "Transporte de materiales a obra", en: "Material transport to site" } },
      { key: "pmat2", label: { es: "Merma y desperdicio", en: "Waste & spoilage" }, desc: { es: "Pérdida por corte, rotura o desperdicio", en: "Loss from cutting, breakage or waste" } },
    ],
  },
  {
    title: { es: "Mano de Obra", en: "Labor" },
    fields: [
      { key: "pmob1", label: { es: "Seguridad y higiene", en: "Safety & hygiene" }, desc: { es: "Equipo de protección personal y medidas de seguridad", en: "PPE and safety measures" } },
      { key: "pmob2", label: { es: "FSR", en: "FSR" }, desc: { es: "Factor de salario real", en: "Real salary factor" } },
    ],
  },
  {
    title: { es: "Maquinaria", en: "Equipment" },
    fields: [
      { key: "pmaq1", label: { es: "Herramienta menor", en: "Small tools" }, desc: { es: "Desgaste de herramienta menor", en: "Small tool wear and tear" } },
    ],
  },
  {
    title: { es: "Costos Indirectos", en: "Indirect Costs" },
    fields: [
      { key: "ggen", label: { es: "Gastos generales y admin.", en: "General & admin expenses" }, desc: { es: "Oficina, supervisión, gastos administrativos", en: "Office, supervision, administrative costs" } },
    ],
  },
  {
    title: { es: "Utilidad", en: "Profit" },
    fields: [
      { key: "util", label: { es: "Utilidad", en: "Profit margin" }, desc: { es: "Margen de ganancia sobre el costo neto", en: "Profit margin on net cost" } },
    ],
  },
  {
    title: { es: "Impuestos", en: "Taxes" },
    fields: [
      { key: "tot1", label: { es: "IVA", en: "VAT" }, desc: { es: "Impuesto al valor agregado", en: "Value added tax" } },
    ],
  },
];

export default function IndirectCostsTab() {
  const { language, projectSettings, saveProjectSettings } = useWorkspace();
  const { toast } = useToast();
  const lang = language as Locale;
  const isEs = lang === "es";

  const [draft, setDraft] = useState<ProjectIndirectCosts>({ ...projectSettings });
  const [saving, setSaving] = useState(false);

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

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 className="font-syne font-bold text-lg" style={{ color: CS.text }}>
          {isEs ? "Costos Indirectos Predeterminados" : "Default Indirect Costs"}
        </h2>
        <p className="text-xs font-dm-sans mt-1" style={{ color: CS.muted }}>
          {isEs
            ? "Estos porcentajes se aplican automáticamente a todos los APUs del proyecto"
            : "These percentages are automatically applied to all project APUs"}
        </p>
      </div>

      {/* Section cards */}
      {SECTIONS.map((section) => (
        <div
          key={section.title.en}
          className="rounded-[10px] overflow-hidden"
          style={{ background: CS.surface, border: `1px solid ${CS.border}` }}
        >
          {/* Section title */}
          <div
            className="px-4 py-2.5"
            style={{ borderBottom: `1px solid ${CS.border}` }}
          >
            <span
              className="font-dm-sans font-semibold uppercase"
              style={{ fontSize: 13, letterSpacing: "0.04em", color: CS.muted }}
            >
              {isEs ? section.title.es : section.title.en}
            </span>
          </div>

          {/* Fields */}
          <div className="flex flex-col">
            {section.fields.map((field) => (
              <div
                key={field.key}
                className="flex items-center justify-between gap-4 px-4 py-3"
                style={{ borderBottom: `1px solid ${CS.border}` }}
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="font-dm-sans text-sm" style={{ color: CS.text }}>
                    {isEs ? field.label.es : field.label.en}
                  </span>
                  <span className="font-dm-sans text-xs" style={{ color: CS.muted }}>
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
                      width: 80,
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: `1px solid ${CS.border}`,
                      background: "rgba(255,255,255,0.04)",
                      color: CS.text,
                      fontSize: 14,
                      outline: "none",
                    }}
                  />
                  <span className="font-dm-sans text-sm" style={{ color: CS.muted }}>%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Save button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-sm font-semibold font-dm-sans"
          style={{
            background: CS.accent,
            color: "#fff",
            border: "none",
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEs ? "Guardar cambios" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
