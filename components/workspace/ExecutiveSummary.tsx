"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Loader2 } from "lucide-react";
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  LineChart, Line, CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/context/WorkspaceContext";
import type { BudgetRow, GanttTask, Project } from "@/lib/types/database.types";
import type { Locale } from "@/lib/utils/i18n";

// ─── Chart colors ───────────────────────────────────────────────────────────

const COLORS = ["#f97316", "#3b82f6", "#22c55e", "#8b5cf6", "#f59e0b", "#14b8a6", "#ef4444", "#ec4899"];

// ─── Custom tooltip ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", fontSize: 12 }}>
      {label && <p style={{ color: "#6b7280", marginBottom: 4, fontWeight: 500 }}>{label}</p>}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((entry: any, i: number) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 1 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: entry.color, flexShrink: 0 }} />
          <span style={{ color: "#374151" }}>{entry.name}:</span>
          <span style={{ fontWeight: 600, color: "#111827" }}>{formatter ? formatter(entry.value) : entry.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Executive Summary ─────────────────────────────────────────────────────

export default function ExecutiveSummary() {
  const supabaseRef = useRef(createClient());
  const { projectId, language, fmt } = useWorkspace();
  const lang = language as Locale;
  const isEs = lang === "es";

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [budgetRows, setBudgetRows] = useState<BudgetRow[]>([]);
  const [ganttTasks, setGanttTasks] = useState<GanttTask[]>([]);

  // ── Fetch all data ───────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const sb = supabaseRef.current;
      const [pRes, bRes, gRes] = await Promise.all([
        sb.from("projects").select("*").eq("id", projectId).single(),
        sb.from("budget_rows").select("*").eq("project_id", projectId).order("sort_order"),
        sb.from("gantt_tasks").select("*").eq("project_id", projectId).order("sort_order"),
      ]);
      if (cancelled) return;
      setProject((pRes.data as Project) ?? null);
      setBudgetRows((bRes.data as BudgetRow[]) ?? []);
      setGanttTasks((gRes.data as GanttTask[]) ?? []);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [projectId]);

  // ── Derived data ─────────────────────────────────────────────────────────
  const itemRows = useMemo(() => budgetRows.filter((r) => !r.is_chapter), [budgetRows]);
  const rowTotal = (r: BudgetRow) => r.total ?? r.quantity * r.unit_price;

  const budgetTotal = useMemo(() => itemRows.reduce((s, r) => s + rowTotal(r), 0), [itemRows]);
  const approvedTotal = useMemo(() => itemRows.filter((r) => r.status === "approved").reduce((s, r) => s + rowTotal(r), 0), [itemRows]);
  const approvedPct = budgetTotal > 0 ? (approvedTotal / budgetTotal) * 100 : 0;

  // Duration from gantt
  const maxWeek = useMemo(() => ganttTasks.reduce((m, t) => Math.max(m, t.start_week + t.duration_weeks), 0), [ganttTasks]);

  // ── Chapters ──────────────────────────────────────────────────────────────
  const chapters = useMemo(() => {
    const sectionNames = Array.from(new Set(itemRows.map((r) => r.section)));
    return sectionNames.map((sec, i) => {
      const rows = itemRows.filter((r) => r.section === sec);
      const total = rows.reduce((s, r) => s + rowTotal(r), 0);
      const approved = rows.filter((r) => r.status === "approved").reduce((s, r) => s + rowTotal(r), 0);
      const pct = budgetTotal > 0 ? (total / budgetTotal) * 100 : 0;
      const variance = total > 0 ? ((approved - total) / total) * 100 : 0;
      return { name: sec, total, approved, pct, variance, color: COLORS[i % COLORS.length] };
    });
  }, [itemRows, budgetTotal]);

  // ── Pie chart data ────────────────────────────────────────────────────────
  const pieData = useMemo(
    () => chapters.filter((ch) => ch.total > 0).map((ch) => ({
      name: ch.name,
      value: ch.total,
      color: ch.color,
    })),
    [chapters],
  );

  // ── Bar chart data ────────────────────────────────────────────────────────
  const barData = useMemo(
    () => chapters.map((ch) => ({
      name: ch.name.length > 10 ? ch.name.slice(0, 8) + "…" : ch.name,
      fullName: ch.name,
      [isEs ? "Presupuesto" : "Budget"]: ch.total,
      [isEs ? "Aprobado" : "Approved"]: ch.approved,
    })),
    [chapters, isEs],
  );

  // ── S-Curve data ──────────────────────────────────────────────────────────
  const sCurveData = useMemo(() => {
    const weeks = Math.max(maxWeek, 8);
    const plannedPerWeek = budgetTotal / (weeks || 1);
    // Build cumulative planned
    const data: { week: string; [key: string]: number | string }[] = [];
    let cumPlanned = 0;
    // For executed, distribute approved by gantt task weeks
    const weeklyApproved = new Array(weeks).fill(0);
    // Distribute each approved budget row's value across its gantt task's weeks
    itemRows.filter((r) => r.status === "approved").forEach((r) => {
      const task = ganttTasks.find(
        (t) => !t.is_chapter && (t.name === r.description || t.budget_section === r.section),
      );
      if (task && task.duration_weeks > 0) {
        const perWeek = rowTotal(r) / task.duration_weeks;
        for (let w = task.start_week; w < task.start_week + task.duration_weeks && w <= weeks; w++) {
          weeklyApproved[w - 1] = (weeklyApproved[w - 1] || 0) + perWeek;
        }
      } else {
        // No matching task — distribute evenly across all weeks
        const perWeek = rowTotal(r) / weeks;
        for (let w = 0; w < weeks; w++) {
          weeklyApproved[w] += perWeek;
        }
      }
    });

    let cumExecuted = 0;
    const plannedKey = isEs ? "Planificado" : "Planned";
    const executedKey = isEs ? "Ejecutado" : "Executed";
    for (let w = 0; w < weeks; w++) {
      cumPlanned += plannedPerWeek;
      cumExecuted += weeklyApproved[w];
      data.push({
        week: `S${w + 1}`,
        [plannedKey]: Math.round(cumPlanned),
        [executedKey]: Math.round(cumExecuted),
      });
    }
    return data;
  }, [budgetTotal, maxWeek, itemRows, ganttTasks, isEs]);

  // ── Date ──────────────────────────────────────────────────────────────────
  const dateStr = new Date().toLocaleDateString(isEs ? "es-MX" : "en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  // ── Short currency ────────────────────────────────────────────────────────
  const fmtShort = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
    return String(Math.round(v));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#9ca3af" }} />
      </div>
    );
  }

  return (
    <div
      id="executive-summary-report"
      className="executive-summary-report"
      style={{
        maxWidth: 960,
        margin: "0 auto",
        background: "#ffffff",
        color: "#111827",
        borderRadius: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 24px rgba(0,0,0,0.06)",
        padding: "32px 40px",
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      {/* ═══════════════════════════════════════════════════════════════════
          1. HEADER
          ═══════════════════════════════════════════════════════════════════ */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 24, borderBottom: "1px solid #e5e7eb" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0, letterSpacing: "-0.02em" }}>
            {isEs ? "Reporte Ejecutivo de Obra" : "Project Executive Report"}
          </h1>
          <p style={{ fontSize: 15, color: "#4b5563", margin: "6px 0 0", fontWeight: 500 }}>
            {project?.name ?? "—"}
          </p>
          {project?.location && (
            <p style={{ fontSize: 13, color: "#6b7280", margin: "2px 0 0" }}>
              {project.location}
            </p>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end", marginBottom: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#f97316" }}>⬡</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>ConstruSheet</span>
          </div>
          <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>{dateStr}</p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          2. KPI CARDS
          ═══════════════════════════════════════════════════════════════════ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginTop: 28, marginBottom: 32 }}>
        {[
          {
            label: isEs ? "Presupuesto Total" : "Total Budget",
            value: fmt(budgetTotal),
            color: "#111827",
          },
          {
            label: isEs ? "Avance Físico" : "Physical Progress",
            value: `${approvedPct.toFixed(1)}%`,
            color: "#f97316",
          },
          {
            label: isEs ? "Gasto Ejecutado" : "Executed Spend",
            value: fmt(approvedTotal),
            color: "#111827",
          },
          {
            label: isEs ? "Duración" : "Duration",
            value: maxWeek > 0 ? `${maxWeek} ${isEs ? "semanas" : "weeks"}` : "—",
            color: "#111827",
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              padding: "20px 22px",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}
          >
            <p style={{ fontSize: 13, color: "#6b7280", margin: 0, fontWeight: 500 }}>{kpi.label}</p>
            <p style={{ fontSize: 26, fontWeight: 600, color: kpi.color, margin: "8px 0 0", letterSpacing: "-0.02em" }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          3. TWO CHARTS ROW
          ═══════════════════════════════════════════════════════════════════ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
        {/* Cost Distribution — Donut */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 24, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: "0 0 16px" }}>
            {isEs ? "Distribución de Costos" : "Cost Distribution"}
          </h3>
          {pieData.length > 0 ? (
            <>
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip formatter={fmt} />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Legend */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
                {pieData.map((entry) => (
                  <div key={entry.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: entry.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: "#374151" }}>{entry.name}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>{fmt(entry.value)}</span>
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>
                        {budgetTotal > 0 ? `${((entry.value / budgetTotal) * 100).toFixed(0)}%` : "0%"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "40px 0" }}>
              {isEs ? "Sin datos" : "No data"}
            </p>
          )}
        </div>

        {/* Progress vs Budget — Bar Chart */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 24, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: "0 0 16px" }}>
            {isEs ? "Avance vs Presupuesto" : "Progress vs Budget"}
          </h3>
          {barData.length > 0 ? (
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 8, right: 8, left: 8, bottom: 40 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#6b7280", fontSize: 10 }}
                    axisLine={{ stroke: "#e5e7eb" }}
                    tickLine={false}
                    angle={-35}
                    textAnchor="end"
                    interval={0}
                    height={50}
                  />
                  <YAxis
                    tick={{ fill: "#9ca3af", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={fmtShort}
                  />
                  <Tooltip content={<ChartTooltip formatter={fmt} />} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                  <Bar dataKey={isEs ? "Presupuesto" : "Budget"} fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={28} />
                  <Bar dataKey={isEs ? "Aprobado" : "Approved"} fill="#22c55e" radius={[3, 3, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "40px 0" }}>
              {isEs ? "Sin datos" : "No data"}
            </p>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          4. S-CURVE
          ═══════════════════════════════════════════════════════════════════ */}
      {sCurveData.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 24, marginBottom: 32, boxShadow: "0 1px 2px rgba(0,0,0,0.04)", pageBreakBefore: "auto" }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: "0 0 16px" }}>
            {isEs ? "Curva S — Costo Acumulado" : "S-Curve — Cumulative Cost"}
          </h3>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sCurveData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="week"
                  tick={{ fill: "#9ca3af", fontSize: 10 }}
                  axisLine={{ stroke: "#e5e7eb" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#9ca3af", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={fmtShort}
                />
                <Tooltip content={<ChartTooltip formatter={fmt} />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                <Line
                  type="monotone"
                  dataKey={isEs ? "Planificado" : "Planned"}
                  stroke="#3b82f6"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey={isEs ? "Ejecutado" : "Executed"}
                  stroke="#f97316"
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          5. COST SUMMARY TABLE
          ═══════════════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: "0 0 16px" }}>
          {isEs ? "Resumen de Costos" : "Cost Summary"}
        </h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
              <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600, color: "#374151" }}>
                {isEs ? "Categoría" : "Category"}
              </th>
              <th style={{ textAlign: "right", padding: "10px 12px", fontWeight: 600, color: "#374151" }}>
                {isEs ? "Presupuesto" : "Budget"}
              </th>
              <th style={{ textAlign: "right", padding: "10px 12px", fontWeight: 600, color: "#374151" }}>
                {isEs ? "Ejecutado" : "Executed"}
              </th>
              <th style={{ textAlign: "right", padding: "10px 12px", fontWeight: 600, color: "#374151" }}>
                {isEs ? "Variación (%)" : "Variance (%)"}
              </th>
            </tr>
          </thead>
          <tbody>
            {chapters.map((ch, i) => (
              <tr key={ch.name} style={{ borderBottom: i < chapters.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                <td style={{ padding: "12px", color: "#374151", fontWeight: 500 }}>{ch.name}</td>
                <td style={{ padding: "12px", textAlign: "right", color: "#111827" }}>{fmt(ch.total)}</td>
                <td style={{ padding: "12px", textAlign: "right", color: "#111827" }}>{fmt(ch.approved)}</td>
                <td style={{
                  padding: "12px",
                  textAlign: "right",
                  fontWeight: 600,
                  color: ch.variance >= 0 ? "#16a34a" : "#dc2626",
                }}>
                  {ch.variance >= 0 ? "+" : ""}{ch.variance.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "2px solid #e5e7eb" }}>
              <td style={{ padding: "12px", fontWeight: 700, color: "#111827" }}>Total</td>
              <td style={{ padding: "12px", textAlign: "right", fontWeight: 700, color: "#111827" }}>{fmt(budgetTotal)}</td>
              <td style={{ padding: "12px", textAlign: "right", fontWeight: 700, color: "#111827" }}>{fmt(approvedTotal)}</td>
              <td style={{
                padding: "12px",
                textAlign: "right",
                fontWeight: 700,
                color: budgetTotal > 0 ? (((approvedTotal - budgetTotal) / budgetTotal) >= 0 ? "#16a34a" : "#dc2626") : "#111827",
              }}>
                {budgetTotal > 0
                  ? `${((approvedTotal - budgetTotal) / budgetTotal) >= 0 ? "+" : ""}${(((approvedTotal - budgetTotal) / budgetTotal) * 100).toFixed(1)}%`
                  : "0.0%"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          6. FOOTER
          ═══════════════════════════════════════════════════════════════════ */}
      <div style={{ textAlign: "center", paddingTop: 24, borderTop: "1px solid #e5e7eb" }}>
        <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>
          {isEs ? "Generado por" : "Generated by"} ConstruSheet · construsheet.vercel.app
        </p>
        <p style={{ fontSize: 10, color: "#d1d5db", marginTop: 4 }}>
          {dateStr} · Project ID: {projectId}
        </p>
      </div>
    </div>
  );
}
