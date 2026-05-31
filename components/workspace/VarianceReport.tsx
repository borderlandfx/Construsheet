"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Loader2, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/context/WorkspaceContext";
import type { BudgetRow, Project } from "@/lib/types/database.types";
import type { Locale } from "@/lib/utils/i18n";

// ─── Variance color helpers ─────────────────────────────────────────────────

function varianceColor(pct: number): string {
  if (pct <= 0) return "#22c55e";       // under budget — green
  if (pct <= 5) return "inherit";       // on budget — neutral
  if (pct <= 10) return "#f59e0b";      // amber warning
  return "#ef4444";                     // red critical
}

function varianceBg(pct: number): string {
  if (pct <= 0) return "#22c55e15";
  if (pct <= 5) return "transparent";
  if (pct <= 10) return "#f59e0b15";
  return "#ef444415";
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface ChapterVariance {
  name: string;
  originalBudget: number;
  currentBudget: number;
  variance: number;
  variancePct: number;
  approved: number;
  approvedPct: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltipContent({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: "10px 14px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
      }}
    >
      <p style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 6 }}>{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((entry: any, i: number) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: entry.color, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: "#4b5563" }}>{entry.name}:</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#1e293b" }}>{fmtShort(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

function fmtShort(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(Math.round(v));
}

// ─── Main component ────────────────────────────────────────────────────────

export default function VarianceReport() {
  const supabaseRef = useRef(createClient());
  const { projectId, language, fmt, currency } = useWorkspace();
  const lang = language as Locale;

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [budgetRows, setBudgetRows] = useState<BudgetRow[]>([]);

  // ── Fetch data ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const sb = supabaseRef.current;
      const [pRes, bRes] = await Promise.all([
        sb.from("projects").select("*").eq("id", projectId).single(),
        sb.from("budget_rows").select("*").eq("project_id", projectId).order("sort_order"),
      ]);
      if (cancelled) return;
      setProject((pRes.data as Project) ?? null);
      setBudgetRows((bRes.data as BudgetRow[]) ?? []);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [projectId]);

  // ── Derived data ──────────────────────────────────────────────────────
  const itemRows = useMemo(() => budgetRows.filter((r) => !r.is_chapter), [budgetRows]);

  const rowTotal = (r: BudgetRow) => r.total ?? r.quantity * r.unit_price;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rowOriginalTotal = (r: any) => {
    const origPrice = r.unit_price;
    const origQty = r.original_quantity ?? r.quantity;
    return origPrice * origQty;
  };

  const budgetTotal = useMemo(() => itemRows.reduce((s, r) => s + rowTotal(r), 0), [itemRows]);
  const originalTotal = useMemo(() => itemRows.reduce((s, r) => s + rowOriginalTotal(r), 0), [itemRows]);
  const approvedTotal = useMemo(
    () => itemRows.filter((r) => r.status === "approved").reduce((s, r) => s + rowTotal(r), 0),
    [itemRows],
  );
  const totalVariance = budgetTotal - originalTotal;
  const totalVariancePct = originalTotal > 0 ? (totalVariance / originalTotal) * 100 : 0;

  // ── Chapters ──────────────────────────────────────────────────────────
  const chapters: ChapterVariance[] = useMemo(() => {
    const sectionNames = Array.from(new Set(itemRows.map((r) => r.section)));
    return sectionNames.map((sec) => {
      const rows = itemRows.filter((r) => r.section === sec);
      const currentBudget = rows.reduce((s, r) => s + rowTotal(r), 0);
      const originalBudget = rows.reduce((s, r) => s + rowOriginalTotal(r), 0);
      const variance = currentBudget - originalBudget;
      const variancePct = originalBudget > 0 ? (variance / originalBudget) * 100 : 0;
      const approved = rows.filter((r) => r.status === "approved").reduce((s, r) => s + rowTotal(r), 0);
      const approvedPct = currentBudget > 0 ? (approved / currentBudget) * 100 : 0;
      return { name: sec, originalBudget, currentBudget, variance, variancePct, approved, approvedPct };
    });
  }, [itemRows]);

  // ── Alerts ────────────────────────────────────────────────────────────
  const alerts = useMemo(
    () => chapters.filter((ch) => ch.variancePct > 10),
    [chapters],
  );

  // ── Chart data ────────────────────────────────────────────────────────
  const barData = useMemo(
    () => chapters.map((ch) => ({
      name: ch.name.length > 16 ? ch.name.slice(0, 14) + "…" : ch.name,
      fullName: ch.name,
      [lang === "es" ? "Original" : "Original"]: ch.originalBudget,
      [lang === "es" ? "Actual" : "Current"]: ch.currentBudget,
      [lang === "es" ? "Aprobado" : "Approved"]: ch.approved,
    })),
    [chapters, lang],
  );

  // ── Date ──────────────────────────────────────────────────────────────
  const now = new Date();
  const dateStr = now.toLocaleDateString(lang === "es" ? "es-MX" : "en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
  const timeStr = now.toLocaleTimeString(lang === "es" ? "es-MX" : "en-US", {
    hour: "2-digit", minute: "2-digit",
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#6b7280" }} />
      </div>
    );
  }

  return (
    <div
      id="variance-report"
      className="variance-report"
      style={{
        maxWidth: 900,
        margin: "0 auto",
        background: "#ffffff",
        color: "#111827",
        borderRadius: 12,
        boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
        padding: 40,
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      {/* ═══════════════════════════════════════════════════════════════
          1. REPORT HEADER
          ═══════════════════════════════════════════════════════════════ */}
      <div style={{ borderTop: "4px solid #f97316", marginTop: -40, marginLeft: -40, marginRight: -40, borderRadius: "12px 12px 0 0" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: 24, marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: "#f97316" }}>⬡</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", letterSpacing: "-0.01em" }}>ConstruSheet</span>
        </div>
        <div style={{ textAlign: "right", fontSize: 12, color: "#6b7280" }}>
          {dateStr}
        </div>
      </div>
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <h1 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", margin: 0, letterSpacing: "-0.01em", textTransform: "uppercase" }}>
          {lang === "es" ? "Reporte de Varianza" : "Variance Report"}
        </h1>
        <p style={{ fontSize: 11, color: "#6b7280", margin: "4px 0 0 0" }}>
          {lang === "es"
            ? "Comparativo de presupuesto original vs actual"
            : "Original vs current budget comparison"}
        </p>
      </div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: "0 0 8px 0" }}>
          {project?.name ?? "—"}
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: "#6b7280", flexWrap: "wrap" }}>
          {project?.location && <span>{project.location}</span>}
          <span style={{ fontWeight: 600 }}>{currency}</span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          2. SUMMARY CARDS
          ═══════════════════════════════════════════════════════════════ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 28 }}>
        {[
          {
            label: lang === "es" ? "Presupuesto Original" : "Original Budget",
            value: fmt(originalTotal),
            accent: "#3b82f6",
          },
          {
            label: lang === "es" ? "Presupuesto Actual" : "Current Budget",
            value: fmt(budgetTotal),
            accent: "#f97316",
          },
          {
            label: lang === "es" ? "Varianza Total" : "Total Variance",
            value: `${totalVariance >= 0 ? "+" : ""}${fmt(totalVariance)}`,
            accent: totalVariance > 0 ? "#ef4444" : totalVariance < 0 ? "#22c55e" : "#6b7280",
          },
          {
            label: lang === "es" ? "% Varianza" : "% Variance",
            value: `${totalVariancePct >= 0 ? "+" : ""}${totalVariancePct.toFixed(1)}%`,
            accent: totalVariancePct > 0 ? "#ef4444" : totalVariancePct < 0 ? "#22c55e" : "#6b7280",
          },
          {
            label: lang === "es" ? "Monto Aprobado" : "Approved Amount",
            value: fmt(approvedTotal),
            accent: "#22c55e",
          },
        ].map((card) => (
          <div
            key={card.label}
            style={{
              border: `1px solid ${card.accent}30`,
              borderRadius: 8,
              padding: "12px 14px",
              background: `${card.accent}06`,
            }}
          >
            <div style={{ fontSize: 9, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
              {card.label}
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color: card.accent === "#6b7280" ? "#0f172a" : card.accent }}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          3. VARIANCE TABLE
          ═══════════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", marginBottom: 12 }}>
          {lang === "es" ? "Varianza por Capítulo" : "Variance by Chapter"}
        </h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#f97316", color: "#fff" }}>
              {[
                "#",
                lang === "es" ? "Capítulo" : "Chapter",
                lang === "es" ? "P. Original" : "Original",
                lang === "es" ? "P. Actual" : "Current",
                lang === "es" ? "Varianza ($)" : "Variance ($)",
                lang === "es" ? "Varianza (%)" : "Variance (%)",
                lang === "es" ? "Aprobado" : "Approved",
                lang === "es" ? "% Aprobado" : "% Approved",
                lang === "es" ? "Alerta" : "Alert",
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "8px 8px",
                    textAlign: h === "#" ? "center" : "left",
                    fontWeight: 700,
                    fontSize: 10,
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chapters.map((ch, i) => {
              const vColor = varianceColor(ch.variancePct);
              const vBg = varianceBg(ch.variancePct);
              return (
                <tr
                  key={ch.name}
                  style={{ background: i % 2 === 0 ? "#ffffff" : "#f9fafb", borderBottom: "1px solid #f3f4f6" }}
                >
                  <td style={{ padding: "8px", textAlign: "center", color: "#6b7280" }}>{i + 1}</td>
                  <td style={{ padding: "8px", fontWeight: 600, color: "#1e293b" }}>{ch.name}</td>
                  <td style={{ padding: "8px", color: "#3b82f6", fontWeight: 500 }}>{fmt(ch.originalBudget)}</td>
                  <td style={{ padding: "8px", color: "#f97316", fontWeight: 500 }}>{fmt(ch.currentBudget)}</td>
                  <td style={{ padding: "8px", fontWeight: 700, color: vColor, background: vBg, borderRadius: 4 }}>
                    {ch.variance >= 0 ? "+" : ""}{fmt(ch.variance)}
                  </td>
                  <td style={{ padding: "8px", fontWeight: 700, color: vColor }}>
                    {ch.variancePct >= 0 ? "+" : ""}{ch.variancePct.toFixed(1)}%
                  </td>
                  <td style={{ padding: "8px", color: "#22c55e", fontWeight: 500 }}>{fmt(ch.approved)}</td>
                  <td style={{ padding: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ flex: 1, height: 6, background: "#e5e7eb", borderRadius: 3, overflow: "hidden", maxWidth: 60 }}>
                        <div style={{ height: "100%", width: `${Math.min(ch.approvedPct, 100)}%`, background: "#22c55e", borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: "#6b7280" }}>{ch.approvedPct.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td style={{ padding: "8px", textAlign: "center" }}>
                    {ch.variancePct > 25 ? (
                      <span
                        title={lang === "es" ? "Crítico: >25% sobre presupuesto" : "Critical: >25% over budget"}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 3,
                          background: "#fef2f2", color: "#ef4444",
                          padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 600,
                          animation: "pulse 2s infinite",
                        }}
                      >
                        <AlertTriangle style={{ width: 12, height: 12 }} /> !!
                      </span>
                    ) : ch.variancePct > 10 ? (
                      <span
                        title={lang === "es" ? "Alerta: >10% sobre presupuesto" : "Warning: >10% over budget"}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 3,
                          background: "#fffbeb", color: "#f59e0b",
                          padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 600,
                        }}
                      >
                        <AlertTriangle style={{ width: 12, height: 12 }} />
                      </span>
                    ) : ch.variancePct < 0 ? (
                      <TrendingDown style={{ width: 14, height: 14, color: "#22c55e" }} />
                    ) : (
                      <span style={{ color: "#d1d5db" }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: "#fff7ed", borderTop: "2px solid #f97316" }}>
              <td style={{ padding: "8px", fontWeight: 800, color: "#f97316" }} colSpan={2}>Total</td>
              <td style={{ padding: "8px", fontWeight: 700, color: "#3b82f6" }}>{fmt(originalTotal)}</td>
              <td style={{ padding: "8px", fontWeight: 700, color: "#f97316" }}>{fmt(budgetTotal)}</td>
              <td style={{ padding: "8px", fontWeight: 800, color: varianceColor(totalVariancePct) }}>
                {totalVariance >= 0 ? "+" : ""}{fmt(totalVariance)}
              </td>
              <td style={{ padding: "8px", fontWeight: 800, color: varianceColor(totalVariancePct) }}>
                {totalVariancePct >= 0 ? "+" : ""}{totalVariancePct.toFixed(1)}%
              </td>
              <td style={{ padding: "8px", fontWeight: 700, color: "#22c55e" }}>{fmt(approvedTotal)}</td>
              <td style={{ padding: "8px", fontWeight: 700, color: "#f97316" }}>
                {budgetTotal > 0 ? ((approvedTotal / budgetTotal) * 100).toFixed(0) : 0}%
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          4. VARIANCE CHART
          ═══════════════════════════════════════════════════════════════ */}
      {barData.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", marginBottom: 12 }}>
            {lang === "es" ? "Comparativo por Capítulo" : "Comparison by Chapter"}
          </h3>
          <div style={{ height: Math.max(280, barData.length * 20 + 100) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 20, right: 10, left: 10, bottom: 50 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#4b5563", fontSize: 10 }}
                  axisLine={{ stroke: "#e5e7eb" }}
                  tickLine={false}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                  height={60}
                />
                <YAxis
                  tick={{ fill: "#9ca3af", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={fmtShort}
                />
                <Tooltip content={<ChartTooltipContent />} />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                />
                <Bar dataKey="Original" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={32} />
                <Bar dataKey={lang === "es" ? "Actual" : "Current"} fill="#f97316" radius={[3, 3, 0, 0]} maxBarSize={32} />
                <Bar dataKey={lang === "es" ? "Aprobado" : "Approved"} fill="#22c55e" radius={[3, 3, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          5. ALERTS SECTION
          ═══════════════════════════════════════════════════════════════ */}
      {alerts.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#ef4444", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <AlertTriangle style={{ width: 16, height: 16 }} />
            {lang === "es" ? "Alertas de Varianza" : "Variance Alerts"}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {alerts.map((ch) => (
              <div
                key={ch.name}
                style={{
                  border: `1px solid ${ch.variancePct > 25 ? "#fca5a5" : "#fcd34d"}`,
                  borderRadius: 8,
                  padding: "12px 16px",
                  background: ch.variancePct > 25 ? "#fef2f2" : "#fffbeb",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: ch.variancePct > 25 ? "#dc2626" : "#d97706", marginBottom: 4 }}>
                    {ch.variancePct > 25
                      ? (lang === "es" ? "CRÍTICO" : "CRITICAL")
                      : (lang === "es" ? "ADVERTENCIA" : "WARNING")}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
                    {lang === "es"
                      ? `${ch.name} está ${ch.variancePct.toFixed(0)}% sobre presupuesto`
                      : `${ch.name} is ${ch.variancePct.toFixed(0)}% over budget`}
                  </div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                    {lang === "es"
                      ? `Excedente: ${fmt(ch.variance)} sobre ${fmt(ch.originalBudget)} original`
                      : `Excess: ${fmt(ch.variance)} over ${fmt(ch.originalBudget)} original`}
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <TrendingUp style={{ width: 24, height: 24, color: ch.variancePct > 25 ? "#ef4444" : "#f59e0b" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          6. BASELINE NOTE
          ═══════════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: 28, border: "1px solid #e5e7eb", borderRadius: 8, padding: "12px 16px", background: "#f9fafb" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>
          {lang === "es" ? "Nota sobre línea base" : "Baseline note"}
        </div>
        <div style={{ fontSize: 11, color: "#9ca3af" }}>
          {lang === "es"
            ? "La línea base se captura automáticamente al crear cada partida. Partidas sin precio original registrado usan el precio actual como base (varianza 0%)."
            : "The baseline is captured automatically when each row is created. Rows without a recorded original price use the current price as baseline (0% variance)."}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          7. FOOTER
          ═══════════════════════════════════════════════════════════════ */}
      <div style={{ borderTop: "2px solid #f97316", paddingTop: 16, marginTop: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "#9ca3af" }}>
          <span>
            {lang === "es" ? "Generado por" : "Generated by"} ConstruSheet · construsheet.vercel.app
          </span>
          <span>
            {dateStr} · {timeStr}
          </span>
        </div>
        <div style={{ fontSize: 10, color: "#d1d5db", marginTop: 4 }}>
          Project ID: {projectId}
        </div>
      </div>
    </div>
  );
}
