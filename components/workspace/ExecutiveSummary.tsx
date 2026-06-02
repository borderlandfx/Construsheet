"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Loader2 } from "lucide-react";
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  LineChart, Line, CartesianGrid, LabelList,
  ResponsiveContainer,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/context/WorkspaceContext";
import type { BudgetRow, GanttTask, Project } from "@/lib/types/database.types";
import type { Locale } from "@/lib/utils/i18n";

// ─── Chart colors ───────────────────────────────────────────────────────────

const COLORS = ["#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#14b8a6", "#ef4444"];

// ─── Custom tooltip (dark pill style for contrast on white) ─────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#0f172a", border: "none", borderRadius: 8,
      padding: "8px 14px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", fontSize: 12,
    }}>
      {label && <p style={{ color: "#94a3b8", marginBottom: 4, fontWeight: 500 }}>{label}</p>}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((entry: any, i: number) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 1 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: entry.color, flexShrink: 0 }} />
          <span style={{ color: "#cbd5e1" }}>{entry.name}:</span>
          <span style={{ fontWeight: 600, color: "#f8fafc" }}>{formatter ? formatter(entry.value) : entry.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Print styles ───────────────────────────────────────────────────────────

const PRINT_STYLES = `
@media print {
  @page { margin: 1.5cm; }
  body { background: #ffffff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  nav, header, [data-sidebar], [data-toolbar], [role="tablist"],
  .no-print, button { display: none !important; }
  #executive-summary-report {
    max-width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #ffffff !important;
  }
  .report-card {
    box-shadow: none !important;
    break-inside: avoid;
  }
  .page-break { page-break-before: always; }
}
`;

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
  const approvedTotal = useMemo(
    () => itemRows.filter((r) => r.status === "approved").reduce((s, r) => s + rowTotal(r), 0),
    [itemRows],
  );
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
      const approvedPctCh = total > 0 ? (approved / total) * 100 : 0;
      const variance = approved - total;
      const variancePct = total > 0 ? ((approved - total) / total) * 100 : 0;
      return { name: sec, total, approved, pct, approvedPctCh, variance, variancePct, color: COLORS[i % COLORS.length] };
    });
  }, [itemRows, budgetTotal]);

  // ── Pie chart data ────────────────────────────────────────────────────────
  const pieData = useMemo(
    () => chapters.filter((ch) => ch.total > 0).map((ch) => ({
      name: ch.name,
      value: ch.total,
      pct: ch.pct,
      color: ch.color,
    })),
    [chapters],
  );

  // ── Bar chart data ────────────────────────────────────────────────────────
  const barData = useMemo(
    () => chapters.map((ch) => ({
      name: ch.name.length > 8 ? ch.name.slice(0, 8) + "…" : ch.name,
      fullName: ch.name,
      [isEs ? "Presupuesto" : "Budget"]: ch.total,
      [isEs ? "Aprobado" : "Approved"]: ch.approved,
    })),
    [chapters, isEs],
  );

  // ── S-Curve data ──────────────────────────────────────────────────────────
  const sCurveData = useMemo(() => {
    const weeks = Math.max(maxWeek, 16);
    const plannedPerWeek = budgetTotal / (weeks || 1);
    const data: { week: string; [key: string]: number | string }[] = [];
    let cumPlanned = 0;
    const weeklyApproved = new Array(weeks).fill(0);
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
        const perWeek = rowTotal(r) / weeks;
        for (let w = 0; w < weeks; w++) weeklyApproved[w] += perWeek;
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
  const fmtShortNum = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
    return `$${Math.round(v)}`;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fmtShort = (v: any) => {
    if (v == null) return "";
    return fmtShortNum(Number(v));
  };

  // ── Progress ring SVG ─────────────────────────────────────────────────────
  const ProgressRing = ({ pct, size = 48 }: { pct: number; size?: number }) => {
    const r = (size - 6) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (Math.min(pct, 100) / 100) * circ;
    return (
      <svg width={size} height={size} style={{ flexShrink: 0 }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={3} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="#f97316" strokeWidth={3} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
    );
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "96px 0" }}>
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#94a3b8" }} />
      </div>
    );
  }

  // ── Shared styles ─────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  };

  const totalVariance = approvedTotal - budgetTotal;
  const totalVariancePct = budgetTotal > 0 ? ((approvedTotal - budgetTotal) / budgetTotal) * 100 : 0;

  return (
    <>
      <style>{PRINT_STYLES}</style>
      <div
        id="executive-summary-report"
        style={{
          background: "#f8fafc",
          minHeight: "100%",
          padding: 32,
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "#0f172a",
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >

        {/* ═══════════════════════════════════════════════════════════════════
            1. HEADER
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="report-card" style={{ ...card, padding: "24px 32px", marginBottom: 24, borderTop: "4px solid #f97316" }}>
          {/* Top row: logo + date */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>
              <span style={{ color: "#f97316", marginRight: 4 }}>⬡</span> ConstruSheet
            </div>
            <div style={{ fontSize: 13, color: "#64748b" }}>{dateStr}</div>
          </div>

          {/* Center title */}
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>
              {isEs ? "Reporte Ejecutivo de Obra" : "Project Executive Report"}
            </h1>
            <div style={{ height: 3, background: "#f97316", width: 60, margin: "10px auto 12px", borderRadius: 2 }} />
            <p style={{ fontSize: 16, color: "#64748b", margin: 0, fontWeight: 500 }}>
              {project?.name ?? "—"}
            </p>
            {project?.location && (
              <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>{project.location}</p>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            2. KPI CARDS
            ═══════════════════════════════════════════════════════════════════ */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
          {/* Card 1 — Presupuesto Total */}
          <div className="report-card" style={{ ...card, padding: "20px 24px", position: "relative" }}>
            <div style={{
              position: "absolute", top: 16, right: 16, width: 36, height: 36,
              borderRadius: "50%", background: "rgba(249,115,22,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 700, color: "#f97316",
            }}>$</div>
            <p style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {isEs ? "Presupuesto Total" : "Total Budget"}
            </p>
            <p style={{ fontSize: 28, fontWeight: 700, color: "#0f172a", margin: "8px 0 12px" }}>{fmt(budgetTotal)}</p>
            <div style={{ width: "100%", height: 4, borderRadius: 2, background: "#f1f5f9", overflow: "hidden" }}>
              <div style={{ width: "100%", height: "100%", borderRadius: 2, background: "#f97316" }} />
            </div>
          </div>

          {/* Card 2 — Avance Físico */}
          <div className="report-card" style={{ ...card, padding: "20px 24px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {isEs ? "Avance Físico" : "Physical Progress"}
                </p>
                <p style={{ fontSize: 28, fontWeight: 700, color: "#f97316", margin: "8px 0 4px" }}>
                  {approvedPct.toFixed(1)}%
                </p>
                <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>
                  {isEs ? "del presupuesto aprobado" : "of approved budget"}
                </p>
              </div>
              <ProgressRing pct={approvedPct} />
            </div>
          </div>

          {/* Card 3 — Gasto Ejecutado */}
          <div className="report-card" style={{ ...card, padding: "20px 24px" }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {isEs ? "Gasto Ejecutado" : "Executed Spend"}
            </p>
            <p style={{ fontSize: 28, fontWeight: 700, color: "#10b981", margin: "8px 0 4px" }}>{fmt(approvedTotal)}</p>
            <div style={{ width: "100%", height: 4, borderRadius: 2, background: "#f1f5f9", overflow: "hidden", marginBottom: 6 }}>
              <div style={{ width: `${Math.min(approvedPct, 100)}%`, height: "100%", borderRadius: 2, background: "#10b981" }} />
            </div>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>
              {isEs ? "de" : "of"} {fmt(budgetTotal)}
            </p>
          </div>

          {/* Card 4 — Capítulos */}
          <div className="report-card" style={{ ...card, padding: "20px 24px" }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {isEs ? "Capítulos" : "Chapters"}
            </p>
            <p style={{ fontSize: 28, fontWeight: 700, color: "#3b82f6", margin: "8px 0 4px" }}>{chapters.length}</p>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>
              {itemRows.length} {isEs ? "partidas" : "items"}
            </p>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            3. TWO COLUMN LAYOUT
            ═══════════════════════════════════════════════════════════════════ */}
        <div style={{ display: "grid", gridTemplateColumns: "40% 60%", gap: 20, marginBottom: 24 }}>

          {/* ── Left Column — Pie + Bar ─────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Pie Chart — Distribución de Costos */}
            <div className="report-card" style={{ ...card, padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", margin: "0 0 2px" }}>
                {isEs ? "Distribución de Costos" : "Cost Distribution"}
              </h3>
              <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 12px" }}>
                {isEs ? "Por capítulo" : "By chapter"}
              </p>
              {pieData.length > 0 ? (
                <>
                  <div style={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={80}
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
                  {/* Legend below */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginTop: 8 }}>
                    {pieData.map((entry) => (
                      <div key={entry.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: entry.color, flexShrink: 0 }} />
                        <span style={{ color: "#64748b" }}>{entry.name}</span>
                        <span style={{ fontWeight: 600, color: "#0f172a" }}>{entry.pct.toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", padding: "40px 0" }}>
                  {isEs ? "Sin datos" : "No data"}
                </p>
              )}
            </div>

            {/* Bar Chart — Avance vs Presupuesto */}
            <div className="report-card" style={{ ...card, padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", margin: "0 0 12px" }}>
                {isEs ? "Avance vs Presupuesto" : "Progress vs Budget"}
              </h3>
              {barData.length > 0 ? (
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} margin={{ top: 16, right: 4, left: 4, bottom: 36 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "#94a3b8", fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        angle={-35}
                        textAnchor="end"
                        interval={0}
                        height={44}
                      />
                      <YAxis
                        tick={{ fill: "#94a3b8", fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={fmtShort}
                      />
                      <Tooltip content={<ChartTooltip formatter={fmt} />} />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4, color: "#64748b" }} />
                      <Bar dataKey={isEs ? "Presupuesto" : "Budget"} fill="#cbd5e1" radius={[3, 3, 0, 0]} maxBarSize={24}>
                        <LabelList dataKey={isEs ? "Presupuesto" : "Budget"} position="top" formatter={fmtShort} style={{ fill: "#94a3b8", fontSize: 9 }} />
                      </Bar>
                      <Bar dataKey={isEs ? "Aprobado" : "Approved"} fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={24}>
                        <LabelList dataKey={isEs ? "Aprobado" : "Approved"} position="top" formatter={fmtShort} style={{ fill: "#10b981", fontSize: 9 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", padding: "40px 0" }}>
                  {isEs ? "Sin datos" : "No data"}
                </p>
              )}
            </div>
          </div>

          {/* ── Right Column — S-Curve ──────────────────────────────────── */}
          <div className="report-card" style={{ ...card, padding: 24, display: "flex", flexDirection: "column" }}>
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                {isEs ? "Curva S" : "S-Curve"}
              </h3>
              <p style={{ fontSize: 13, color: "#94a3b8", margin: "4px 0 0" }}>
                {isEs ? "Costo Acumulado Planificado vs Ejecutado" : "Cumulative Cost — Planned vs Executed"}
              </p>
            </div>
            {sCurveData.length > 0 ? (
              <div style={{ flex: 1, minHeight: 380 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sCurveData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="week"
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      axisLine={{ stroke: "#e2e8f0" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={fmtShort}
                    />
                    <Tooltip content={<ChartTooltip formatter={fmt} />} />
                    <Legend
                      wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                      formatter={(value: string) => <span style={{ color: "#64748b" }}>{value}</span>}
                    />
                    <Line
                      type="monotone"
                      dataKey={isEs ? "Planificado" : "Planned"}
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                      strokeDasharray="6 3"
                      dot={false}
                      activeDot={{ r: 5, fill: "#3b82f6" }}
                    />
                    <Line
                      type="monotone"
                      dataKey={isEs ? "Ejecutado" : "Executed"}
                      stroke="#f97316"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5, fill: "#f97316" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", padding: "40px 0" }}>
                {isEs ? "Sin datos" : "No data"}
              </p>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            4. COST SUMMARY TABLE
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="report-card page-break" style={{ ...card, overflow: "hidden", marginBottom: 24 }}>
          {/* Header bar */}
          <div style={{ background: "#f8fafc", padding: "16px 24px", borderBottom: "1px solid #e2e8f0" }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", margin: 0 }}>
              {isEs ? "Resumen de Costos por Capítulo" : "Cost Summary by Chapter"}
            </h3>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: "2px 0 0" }}>
              {chapters.length} {isEs ? "capítulos" : "chapters"} · {itemRows.length} {isEs ? "partidas" : "items"}
            </p>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "12px 16px", fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center", width: 40, fontWeight: 600 }}>#</th>
                <th style={{ padding: "12px 16px", fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "left", fontWeight: 600 }}>
                  {isEs ? "Capítulo" : "Chapter"}
                </th>
                <th style={{ padding: "12px 16px", fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right", fontWeight: 600 }}>
                  {isEs ? "Presupuesto" : "Budget"}
                </th>
                <th style={{ padding: "12px 16px", fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right", fontWeight: 600 }}>
                  {isEs ? "Ejecutado" : "Executed"}
                </th>
                <th style={{ padding: "12px 16px", fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right", fontWeight: 600 }}>
                  {isEs ? "Variación" : "Variance"}
                </th>
                <th style={{ padding: "12px 16px", fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right", fontWeight: 600 }}>
                  % {isEs ? "Aprobado" : "Approved"}
                </th>
              </tr>
            </thead>
            <tbody>
              {chapters.map((ch, i) => {
                const isOver = ch.variancePct > 0;
                const isUnder = ch.variancePct < 0;
                return (
                  <tr
                    key={ch.name}
                    style={{ borderBottom: "1px solid #f1f5f9", transition: "background 150ms" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#f8fafc"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <td style={{ padding: "12px 16px", textAlign: "center", color: "#94a3b8", fontSize: 12 }}>{i + 1}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: ch.color, flexShrink: 0 }} />
                        <span style={{ fontWeight: 500, color: "#0f172a" }}>{ch.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", color: "#334155" }}>{fmt(ch.total)}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", color: ch.approved > 0 ? "#10b981" : "#334155" }}>{fmt(ch.approved)}</td>
                    <td style={{
                      padding: "12px 16px", textAlign: "right", fontWeight: 600,
                      color: isOver ? "#ef4444" : isUnder ? "#10b981" : "#94a3b8",
                    }}>
                      {isOver ? "↑ " : isUnder ? "↓ " : "→ "}
                      {isOver ? "+" : ""}{ch.variancePct.toFixed(1)}%
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                        <div style={{ width: 60, height: 6, borderRadius: 3, background: "#f1f5f9", overflow: "hidden" }}>
                          <div style={{
                            width: `${Math.min(ch.approvedPctCh, 100)}%`,
                            height: "100%",
                            borderRadius: 3,
                            background: ch.approvedPctCh > 100 ? "#ef4444" : "#10b981",
                          }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 500, color: "#0f172a", minWidth: 36, textAlign: "right" }}>
                          {ch.approvedPctCh.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: "#f8fafc", borderTop: "2px solid #e2e8f0" }}>
                <td style={{ padding: "14px 16px" }} />
                <td style={{ padding: "14px 16px", fontWeight: 700, color: "#0f172a", textTransform: "uppercase", fontSize: 12 }}>Total</td>
                <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 700, color: "#0f172a" }}>{fmt(budgetTotal)}</td>
                <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 700, color: "#10b981" }}>{fmt(approvedTotal)}</td>
                <td style={{
                  padding: "14px 16px", textAlign: "right", fontWeight: 700,
                  color: totalVariance > 0 ? "#ef4444" : totalVariance < 0 ? "#10b981" : "#94a3b8",
                }}>
                  {totalVariance > 0 ? "↑ +" : totalVariance < 0 ? "↓ " : "→ "}
                  {totalVariancePct.toFixed(1)}%
                </td>
                <td style={{ padding: "14px 16px", textAlign: "right" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                    <div style={{ width: 60, height: 6, borderRadius: 3, background: "#e2e8f0", overflow: "hidden" }}>
                      <div style={{
                        width: `${Math.min(approvedPct, 100)}%`,
                        height: "100%",
                        borderRadius: 3,
                        background: approvedPct > 100 ? "#ef4444" : "#10b981",
                      }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", minWidth: 36, textAlign: "right" }}>
                      {approvedPct.toFixed(0)}%
                    </span>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            5. FOOTER
            ═══════════════════════════════════════════════════════════════════ */}
        <div style={{ textAlign: "center", paddingTop: 8 }}>
          <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>
            {isEs ? "Generado por" : "Generated by"}{" "}
            <span style={{ color: "#f97316", fontWeight: 600 }}>ConstruSheet</span> · construsheet.vercel.app
          </p>
          <p style={{ fontSize: 10, color: "#cbd5e1", marginTop: 4 }}>
            {dateStr} · Project ID: {projectId}
          </p>
        </div>
      </div>
    </>
  );
}
