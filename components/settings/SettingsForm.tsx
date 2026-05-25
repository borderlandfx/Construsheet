"use client";

import { useState, Fragment } from "react";
import { Loader2, CheckCircle, User, Globe, Settings2, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_INDIRECT_COSTS, type ProjectIndirectCosts } from "@/lib/types/database.types";
import type { Locale } from "@/lib/utils/i18n";
import type { Currency } from "@/lib/utils/currency";

// ─── Design tokens ────────────────────────────────────────────────────────────

const CS = {
  surface:  "var(--cs-surface)",
  border:   "var(--cs-border)",
  accent:   "var(--cs-accent)",
  text:     "var(--cs-text)",
  muted:    "var(--cs-muted)",
  bg:       "var(--cs-bg)",
} as const;

const FIELD: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.75rem",
  borderRadius: 8,
  border: `1px solid ${CS.border}`,
  background: "rgba(255,255,255,0.04)",
  color: CS.text,
  fontSize: "0.875rem",
  fontFamily: "var(--font-dm-sans)",
  outline: "none",
};

const LBL: React.CSSProperties = {
  display: "block",
  fontSize: "0.75rem",
  fontWeight: 500,
  color: CS.muted,
  fontFamily: "var(--font-dm-sans)",
  marginBottom: 6,
};

// ─── Section card ─────────────────────────────────────────────────────────────

function Card({ title, icon, children }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-[12px] overflow-hidden"
      style={{ border: `1px solid ${CS.border}`, background: CS.surface }}
    >
      <div
        className="flex items-center gap-2.5 px-5 py-3.5"
        style={{ borderBottom: `1px solid ${CS.border}`, background: "rgba(255,255,255,0.02)" }}
      >
        <span style={{ color: CS.accent }}>{icon}</span>
        <span className="font-syne font-bold text-sm" style={{ color: CS.text }}>{title}</span>
      </div>
      <div className="px-5 py-5">{children}</div>
    </div>
  );
}

// ─── Pill toggle ─────────────────────────────────────────────────────────────

function PillToggle<T extends string>({
  options, value, onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      className="inline-flex rounded-lg overflow-hidden"
      style={{ border: `1px solid ${CS.border}` }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className="px-4 py-1.5 text-sm font-medium font-dm-sans transition-all"
            style={{
              background: active ? CS.accent : "transparent",
              color: active ? "#fff" : CS.muted,
              border: "none",
              cursor: "pointer",
              minWidth: 56,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Indirect costs editor ────────────────────────────────────────────────────

interface CostLineEditorProps {
  costs: ProjectIndirectCosts;
  onChange: (costs: ProjectIndirectCosts) => void;
  lang: Locale;
}

const COST_SECTIONS: {
  label: { es: string; en: string };
  color: string;
  keys: (keyof ProjectIndirectCosts)[];
}[] = [
  { label: { es: "1 · Materiales", en: "1 · Materials" }, color: "#60a5fa",
    keys: ["pmat1", "pmat2"] },
  { label: { es: "2 · Mano de Obra", en: "2 · Labor" }, color: "#4ade80",
    keys: ["pmob1", "pmob2"] },
  { label: { es: "3 · Maquinaria y Equipos", en: "3 · Equipment" }, color: "#fb923c",
    keys: ["pmaq1", "pmaq2"] },
  { label: { es: "4 · Gastos Generales", en: "4 · General & Admin" }, color: "#a78bfa",
    keys: ["ggen", "pgas1", "pgas2"] },
  { label: { es: "5 · Utilidad", en: "5 · Profit" }, color: "#f472b6",
    keys: ["util"] },
  { label: { es: "6 · Impuestos", en: "6 · Taxes" }, color: "#fbbf24",
    keys: ["tot1", "tot2"] },
];

function IndirectCostsEditor({ costs, onChange, lang }: CostLineEditorProps) {
  function handleChange(key: keyof ProjectIndirectCosts, field: "label" | "pct", raw: string) {
    onChange({
      ...costs,
      [key]: {
        ...costs[key],
        [field]: field === "pct" ? (parseFloat(raw) || 0) : raw,
      },
    });
  }

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
    <div className="flex flex-col gap-0 rounded-lg overflow-hidden" style={{ border: `1px solid ${CS.border}` }}>
      <table className="w-full font-dm-sans" style={{ fontSize: "0.8125rem" }}>
        <thead>
          <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: `1px solid ${CS.border}` }}>
            <th className="text-left px-3 py-2 text-xs font-semibold w-16" style={{ color: CS.muted }}>
              {lang === "es" ? "Clave" : "Key"}
            </th>
            <th className="text-left px-2 py-2 text-xs font-semibold" style={{ color: CS.muted }}>
              {lang === "es" ? "Descripción" : "Description"}
            </th>
            <th className="text-left px-2 py-2 text-xs font-semibold w-20" style={{ color: CS.muted }}>%</th>
          </tr>
        </thead>
        <tbody>
          {COST_SECTIONS.map((section) => (
            <Fragment key={section.label.es}>
              <tr style={{ background: "rgba(255,255,255,0.02)", borderTop: `2px solid ${section.color}`, borderBottom: `1px solid ${CS.border}` }}>
                <td colSpan={3} className="px-3 py-1.5">
                  <span className="text-xs font-syne font-bold uppercase tracking-wider" style={{ color: section.color }}>
                    {lang === "es" ? section.label.es : section.label.en}
                  </span>
                </td>
              </tr>
              {section.keys.map((key) => (
                <tr key={key} style={{ borderBottom: `1px solid ${CS.border}` }}>
                  <td className="px-3 py-2 text-xs font-mono" style={{ color: CS.accent }}>{key}</td>
                  <td className="px-2 py-2">
                    <input
                      style={{ ...inputBase, width: "100%" }}
                      value={costs[key].label}
                      onChange={(e) => handleChange(key, "label", e.target.value)}
                      placeholder={lang === "es" ? "Descripción..." : "Description..."}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1">
                      <input
                        style={{ ...inputBase, width: 52, textAlign: "right" }}
                        type="number"
                        min={0}
                        max={200}
                        step={0.5}
                        value={costs[key].pct || ""}
                        placeholder="0"
                        onChange={(e) => handleChange(key, "pct", e.target.value)}
                      />
                      <span className="text-xs" style={{ color: CS.muted }}>%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── SettingsForm ─────────────────────────────────────────────────────────────

interface SettingsFormProps {
  userId: string;
  email: string;
  initialFullName: string;
  initialLanguage: Locale;
  initialCurrency: Currency;
  initialDefaultCosts: ProjectIndirectCosts | null;
}

export default function SettingsForm({
  userId,
  email,
  initialFullName,
  initialLanguage,
  initialCurrency,
  initialDefaultCosts,
}: SettingsFormProps) {
  const supabase = createClient();
  const [lang, setLang]         = useState<Locale>(initialLanguage);
  const [fullName, setFullName] = useState(initialFullName);
  const [currency, setCurrency] = useState<Currency>(initialCurrency);
  const [costs, setCosts]       = useState<ProjectIndirectCosts>(
    initialDefaultCosts ?? { ...DEFAULT_INDIRECT_COSTS }
  );
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState("");

  const [newPassword, setNewPassword]         = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving]               = useState(false);
  const [pwSaved, setPwSaved]                 = useState(false);
  const [pwError, setPwError]                 = useState("");

  const isEs = lang === "es";

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);

    const { error: err } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim() || null,
        language: lang,
        currency_pref: currency,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        default_indirect_costs: costs as any,
      })
      .eq("id", userId);

    setSaving(false);
    if (err) { setError(err.message); return; }
    setSaved(true);
  }

  async function handlePasswordChange() {
    setPwError("");
    setPwSaved(false);
    if (newPassword.length < 8) {
      setPwError(isEs ? "La contraseña debe tener al menos 8 caracteres." : "Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError(isEs ? "Las contraseñas no coinciden." : "Passwords do not match.");
      return;
    }
    setPwSaving(true);
    const { error: err } = await supabase.auth.updateUser({ password: newPassword });
    setPwSaving(false);
    if (err) { setPwError(err.message); return; }
    setPwSaved(true);
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* ── Page header ──────────────────────────────────── */}
      <div>
        <h1 className="font-syne font-bold text-2xl" style={{ color: CS.text, letterSpacing: "-0.03em" }}>
          {isEs ? "Configuración" : "Settings"}
        </h1>
        <p className="text-sm font-dm-sans mt-1" style={{ color: CS.muted }}>
          {isEs ? "Preferencias de cuenta y valores predeterminados" : "Account preferences and defaults"}
        </p>
      </div>

      {/* ── Profile ─────────────────────────────────────── */}
      <Card title={isEs ? "Perfil" : "Profile"} icon={<User className="h-4 w-4" />}>
        <div className="flex flex-col gap-4">
          <div>
            <label style={LBL}>{isEs ? "Nombre completo" : "Full name"}</label>
            <input
              style={FIELD}
              value={fullName}
              onChange={(e) => { setFullName(e.target.value); setSaved(false); }}
              placeholder={isEs ? "Tu nombre" : "Your name"}
              onFocus={(e) => (e.currentTarget.style.borderColor = CS.accent)}
              onBlur={(e) => (e.currentTarget.style.borderColor = CS.border)}
            />
          </div>
          <div>
            <label style={LBL}>{isEs ? "Correo electrónico" : "Email"}</label>
            <input
              style={{ ...FIELD, opacity: 0.55, cursor: "not-allowed" }}
              value={email}
              readOnly
              tabIndex={-1}
            />
            <p className="text-xs font-dm-sans mt-1" style={{ color: CS.muted }}>
              {isEs ? "No se puede cambiar el correo aquí." : "Email cannot be changed here."}
            </p>
          </div>
        </div>
      </Card>

      {/* ── Locale & Currency ───────────────────────────── */}
      <Card title={isEs ? "Idioma y Moneda" : "Language & Currency"} icon={<Globe className="h-4 w-4" />}>
        <div className="flex flex-col gap-5">
          <div>
            <label style={LBL}>{isEs ? "Idioma" : "Language"}</label>
            <PillToggle<Locale>
              options={[
                { value: "es", label: "Español" },
                { value: "en", label: "English" },
              ]}
              value={lang}
              onChange={(v) => { setLang(v); setSaved(false); }}
            />
          </div>
          <div>
            <label style={LBL}>{isEs ? "Moneda predeterminada" : "Default currency"}</label>
            <PillToggle<Currency>
              options={[
                { value: "MXN", label: "MXN" },
                { value: "USD", label: "USD" },
              ]}
              value={currency}
              onChange={(v) => { setCurrency(v); setSaved(false); }}
            />
          </div>
        </div>
      </Card>

      {/* ── Security / Password ─────────────────────────── */}
      <Card title={isEs ? "Contraseña" : "Password"} icon={<Lock className="h-4 w-4" />}>
        <div className="flex flex-col gap-4">
          <div>
            <label style={LBL}>{isEs ? "Nueva contraseña" : "New password"}</label>
            <input
              style={FIELD}
              type="password"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setPwSaved(false); setPwError(""); }}
              placeholder={isEs ? "Mínimo 8 caracteres" : "Minimum 8 characters"}
              autoComplete="new-password"
              onFocus={(e) => (e.currentTarget.style.borderColor = CS.accent)}
              onBlur={(e) => (e.currentTarget.style.borderColor = CS.border)}
            />
          </div>
          <div>
            <label style={LBL}>{isEs ? "Confirmar contraseña" : "Confirm password"}</label>
            <input
              style={FIELD}
              type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setPwSaved(false); setPwError(""); }}
              placeholder={isEs ? "Repite la contraseña" : "Repeat password"}
              autoComplete="new-password"
              onFocus={(e) => (e.currentTarget.style.borderColor = CS.accent)}
              onBlur={(e) => (e.currentTarget.style.borderColor = CS.border)}
            />
          </div>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              {pwError && (
                <p className="text-sm font-dm-sans" style={{ color: "#f87171" }}>{pwError}</p>
              )}
              {pwSaved && !pwError && (
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4" style={{ color: "#22c55e" }} />
                  <p className="text-sm font-dm-sans" style={{ color: "#22c55e" }}>
                    {isEs ? "Contraseña actualizada" : "Password updated"}
                  </p>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handlePasswordChange}
              disabled={pwSaving || (!newPassword && !confirmPassword)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-sm font-semibold font-dm-sans"
              style={{
                background: CS.accent,
                color: "#fff",
                border: "none",
                cursor: (pwSaving || (!newPassword && !confirmPassword)) ? "not-allowed" : "pointer",
                opacity: (pwSaving || (!newPassword && !confirmPassword)) ? 0.5 : 1,
              }}
            >
              {pwSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEs ? "Actualizar contraseña" : "Update password"}
            </button>
          </div>
        </div>
      </Card>

      {/* ── Default indirect costs ──────────────────────── */}
      <Card
        title={isEs ? "Costos Indirectos Predeterminados" : "Default Indirect Costs"}
        icon={<Settings2 className="h-4 w-4" />}
      >
        <p className="text-xs font-dm-sans mb-4" style={{ color: CS.muted }}>
          {isEs
            ? "Estos porcentajes se aplican a todos los proyectos nuevos que no tengan sus propios ajustes."
            : "These percentages apply to all new projects that don't have their own settings."}
        </p>
        <IndirectCostsEditor costs={costs} onChange={(c) => { setCosts(c); setSaved(false); }} lang={lang} />
        <button
          type="button"
          onClick={() => { setCosts({ ...DEFAULT_INDIRECT_COSTS }); setSaved(false); }}
          className="mt-3 text-xs font-dm-sans px-3 py-1.5 rounded-lg"
          style={{
            border: `1px solid ${CS.border}`,
            background: "transparent",
            color: CS.muted,
            cursor: "pointer",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = CS.text)}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = CS.muted)}
        >
          {isEs ? "Restablecer valores" : "Reset to defaults"}
        </button>
      </Card>

      {/* ── Save bar ────────────────────────────────────── */}
      <div
        className="flex items-center justify-between flex-wrap gap-3 rounded-[12px] px-5 py-4"
        style={{ border: `1px solid ${CS.border}`, background: CS.surface }}
      >
        <div>
          {error && (
            <p className="text-sm font-dm-sans" style={{ color: "#f87171" }}>{error}</p>
          )}
          {saved && !error && (
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4" style={{ color: "#22c55e" }} />
              <p className="text-sm font-dm-sans" style={{ color: "#22c55e" }}>
                {isEs ? "Configuración guardada" : "Settings saved"}
              </p>
            </div>
          )}
        </div>
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
