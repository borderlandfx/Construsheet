"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Loader2, Wallet, TrendingUp, Calendar,
} from "lucide-react";
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

const COLORS = ["#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#14b8a6", "#ef4444", "#ec4899"];

// ─── Dark tooltip ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DarkTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 shadow-xl text-xs">
      {label && <p className="text-zinc-400 mb-1 font-medium">{label}</p>}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-1.5 mb-0.5">
          <span className="shrink-0 rounded-sm" style={{ width: 8, height: 8, background: entry.color }} />
          <span className="text-zinc-300">{entry.name}:</span>
          <span className="font-semibold text-zinc-100">{formatter ? formatter(entry.value) : entry.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Print styles ───────────────────────────────────────────────────────────

const PRINT_STYLES = `
@media print {
  body { background: #ffffff !important; }
  nav, header, [data-sidebar], [data-toolbar], [role="tablist"],
  .no-print, button { display: none !important; }
  #executive-summary-report {
    max-width: 100% !important;
    margin: 0 !important;
    padding: 24px !important;
    box-shadow: none !important;
    border: none !important;
    background: #ffffff !important;
  }
  #executive-summary-report .dark-card {
    background: #ffffff !important;
    border: 1px solid #d1d5db !important;
    color: #111827 !important;
  }
  #executive-summary-report .dark-text { color: #111827 !important; }
  #executive-summary-report .muted-text { color: #6b7280 !important; }
  #executive-summary-report .accent-text { color: #f97316 !important; }
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
  const approvedRows = useMemo(() => itemRows.filter((r) => r.status === "approved"), [itemRows]);
  const approvedTotal = useMemo(() => approvedRows.reduce((s, r) => s + rowTotal(r), 0), [approvedRows]);
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
      return { name: sec, total, approved, pct, approvedPctCh, variance, color: COLORS[i % COLORS.length] };
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
      name: ch.name.length > 10 ? ch.name.slice(0, 8) + "…" : ch.name,
      fullName: ch.name,
      [isEs ? "Presupuesto" : "Budget"]: ch.total,
      [isEs ? "Ejecutado" : "Approved"]: ch.approved,
    })),
    [chapters, isEs],
  );

  // ── S-Curve data ──────────────────────────────────────────────────────────
  const sCurveData = useMemo(() => {
    const weeks = Math.max(maxWeek, 16);
    const plannedPerWeek = budgetTotal / (weeks || 1);
    const data: { week: string; [key: string]: number | string }[] = [];
    let cumPlanned = 0;
    // Distribute approved by gantt task weeks
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
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
    return String(Math.round(v));
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fmtShort = (v: any) => {
    if (v == null) return "";
    return fmtShortNum(Number(v));
  };

  // ── Progress ring SVG ─────────────────────────────────────────────────────
  const ProgressRing = ({ pct, size = 40 }: { pct: number; size?: number }) => {
    const r = (size - 6) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (Math.min(pct, 100) / 100) * circ;
    return (
      <svg width={size} height={size} className="shrink-0">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#27272a" strokeWidth={3} />
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
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  const cardClass = "dark-card bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-zinc-700 transition-colors";

  return (
    <>
      <style>{PRINT_STYLES}</style>
      <div
        id="executive-summary-report"
        className="executive-summary-report font-sans"
        style={{ maxWidth: 1100, margin: "0 auto", background: "#0a0a0a", color: "#f4f4f5" }}
      >

        {/* ═══════════════════════════════════════════════════════════════════
            1. HEADER
            ═══════════════════════════════════════════════════════════════════ */}
        <div
          className="dark-card"
          style={{
            borderTop: "4px solid #f97316",
            borderBottom: "1px solid #27272a",
            padding: "24px 32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#18181b",
          }}
        >
          {/* Left — Logo */}
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold accent-text" style={{ color: "#f97316" }}>⬡</span>
            <span className="font-bold text-sm accent-text" style={{ color: "#f97316" }}>ConstruSheet</span>
          </div>

          {/* Center — Title */}
          <div className="text-center">
            <h1 className="font-bold text-lg tracking-wide dark-text" style={{ color: "#f4f4f5", letterSpacing: "0.05em", margin: 0 }}>
              {isEs ? "REPORTE EJECUTIVO DE OBRA" : "PROJECT EXECUTIVE REPORT"}
            </h1>
          </div>

          {/* Right — Project info */}
          <div className="text-right">
            <p className="text-sm font-semibold dark-text" style={{ color: "#f4f4f5", margin: 0 }}>{project?.name ?? "—"}</p>
            {project?.location && (
              <p className="text-xs muted-text" style={{ color: "#a1a1aa", margin: "2px 0 0" }}>{project.location}</p>
            )}
            <p className="text-xs muted-text" style={{ color: "#71717a", margin: "4px 0 0" }}>{dateStr}</p>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            2. KPI CARDS
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6">
          {/* Card 1 — Presupuesto Total */}
          <div className={cardClass}>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-orange-500/10">
                <Wallet className="w-5 h-5 text-orange-500" />
              </div>
              <span className="text-xs font-medium muted-text" style={{ color: "#a1a1aa" }}>
                {isEs ? "Presupuesto Total" : "Total Budget"}
              </span>
            </div>
            <p className="text-2xl font-bold dark-text" style={{ color: "#f4f4f5", margin: 0 }}>{fmt(budgetTotal)}</p>
            <div className="mt-3 w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div className="h-full rounded-full bg-orange-500" style={{ width: "100%" }} />
            </div>
          </div>

          {/* Card 2 — Avance Físico */}
          <div className={cardClass}>
            <div className="flex items-center gap-3 mb-3">
              <ProgressRing pct={approvedPct} />
              <span className="text-xs font-medium muted-text" style={{ color: "#a1a1aa" }}>
                {isEs ? "Avance Físico" : "Physical Progress"}
              </span>
            </div>
            <p className="text-2xl font-bold accent-text" style={{ color: "#f97316", margin: 0 }}>{approvedPct.toFixed(1)}%</p>
            <p className="text-xs mt-1 muted-text" style={{ color: "#71717a", margin: "4px 0 0" }}>
              {isEs ? "del presupuesto aprobado" : "of approved budget"}
            </p>
          </div>

          {/* Card 3 — Gasto Ejecutado */}
          <div className={cardClass}>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              <span className="text-xs font-medium muted-text" style={{ color: "#a1a1aa" }}>
                {isEs ? "Gasto Ejecutado" : "Executed Spend"}
              </span>
            </div>
            <p className="text-2xl font-bold" style={{ color: "#10b981", margin: 0 }}>{fmt(approvedTotal)}</p>
            <p className="text-xs mt-1 muted-text" style={{ color: "#71717a", margin: "4px 0 0" }}>
              {isEs ? "de" : "of"} {fmt(budgetTotal)}
            </p>
          </div>

          {/* Card 4 — Estado del Proyecto */}
          <div className={cardClass}>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500/10">
                <Calendar className="w-5 h-5 text-blue-500" />
              </div>
              <span className="text-xs font-medium muted-text" style={{ color: "#a1a1aa" }}>
                {isEs ? "Capítulos" : "Chapters"}
              </span>
            </div>
            <p className="text-2xl font-bold" style={{ color: "#3b82f6", margin: 0 }}>{chapters.length}</p>
            <p className="text-xs mt-1 muted-text" style={{ color: "#71717a", margin: "4px 0 0" }}>
              {itemRows.length} {isEs ? "partidas" : "items"}
            </p>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            3. TWO COLUMN LAYOUT
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="flex flex-col lg:flex-row gap-6 px-6 mb-6">

          {/* ── Left Column 40% ─────────────────────────────────────────── */}
          <div className="flex flex-col gap-6 w-full lg:w-[40%]">

            {/* Pie Chart — Distribución de Costos */}
            <div className={cardClass}>
              <h3 className="text-sm font-bold dark-text mb-4" style={{ color: "#f4f4f5" }}>
                📊 {isEs ? "Distribución de Costos" : "Cost Distribution"}
              </h3>
              {pieData.length > 0 ? (
                <div className="flex flex-col items-center">
                  <div style={{ width: "100%", height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={85}
                          paddingAngle={2}
                          dataKey="value"
                          stroke="none"
                        >
                          {pieData.map((entry, idx) => (
                            <Cell key={idx} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<DarkTooltip formatter={fmt} />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Legend */}
                  <div className="flex flex-col gap-2 w-full mt-2">
                    {pieData.map((entry) => (
                      <div key={entry.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="shrink-0 rounded-sm" style={{ width: 10, height: 10, background: entry.color }} />
                          <span className="truncate muted-text" style={{ color: "#a1a1aa" }}>{entry.name}</span>
                        </div>
                        <span className="font-semibold dark-text shrink-0 ml-2" style={{ color: "#f4f4f5" }}>
                          {entry.pct.toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-center py-10 muted-text" style={{ color: "#71717a" }}>
                  {isEs ? "Sin datos" : "No data"}
                </p>
              )}
            </div>

            {/* Bar Chart — Avance vs Presupuesto */}
            <div className={cardClass}>
              <h3 className="text-sm font-bold dark-text mb-4" style={{ color: "#f4f4f5" }}>
                📈 {isEs ? "Avance vs Presupuesto" : "Progress vs Budget"}
              </h3>
              {barData.length > 0 ? (
                <div style={{ width: "100%", height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} margin={{ top: 16, right: 8, left: 8, bottom: 40 }}>
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "#71717a", fontSize: 10 }}
                        axisLine={{ stroke: "#27272a" }}
                        tickLine={false}
                        angle={-35}
                        textAnchor="end"
                        interval={0}
                        height={50}
                      />
                      <YAxis
                        tick={{ fill: "#52525b", fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={fmtShort}
                      />
                      <Tooltip content={<DarkTooltip formatter={fmt} />} />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4, color: "#a1a1aa" }} />
                      <Bar dataKey={isEs ? "Presupuesto" : "Budget"} fill="#52525b" radius={[3, 3, 0, 0]} maxBarSize={28}>
                        <LabelList dataKey={isEs ? "Presupuesto" : "Budget"} position="top" formatter={fmtShort} style={{ fill: "#71717a", fontSize: 9 }} />
                      </Bar>
                      <Bar dataKey={isEs ? "Ejecutado" : "Approved"} fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={28}>
                        <LabelList dataKey={isEs ? "Ejecutado" : "Approved"} position="top" formatter={fmtShort} style={{ fill: "#10b981", fontSize: 9 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-center py-10 muted-text" style={{ color: "#71717a" }}>
                  {isEs ? "Sin datos" : "No data"}
                </p>
              )}
            </div>
          </div>

          {/* ── Right Column 60% — S-Curve ──────────────────────────────── */}
          <div className="w-full lg:w-[60%]">
            <div className={`${cardClass} h-full flex flex-col`}>
              <div className="mb-4">
                <h3 className="text-sm font-bold dark-text" style={{ color: "#f4f4f5" }}>
                  📉 {isEs ? "Curva S — Costo Acumulado" : "S-Curve — Cumulative Cost"}
                </h3>
                <p className="text-xs mt-1 muted-text" style={{ color: "#71717a" }}>
                  {isEs ? "Planificado vs Ejecutado" : "Planned vs Executed"}
                </p>
              </div>
              {sCurveData.length > 0 ? (
                <div className="flex-1" style={{ minHeight: 400 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sCurveData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis
                        dataKey="week"
                        tick={{ fill: "#71717a", fontSize: 10 }}
                        axisLine={{ stroke: "#27272a" }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "#52525b", fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={fmtShort}
                      />
                      <Tooltip content={<DarkTooltip formatter={fmt} />} />
                      <Legend
                        wrapperStyle={{ fontSize: 11, paddingTop: 8, color: "#a1a1aa" }}
                        formatter={(value: string) => <span style={{ color: "#a1a1aa" }}>{value}</span>}
                      />
                      <Line
                        type="monotone"
                        dataKey={isEs ? "Planificado" : "Planned"}
                        stroke="#3b82f6"
                        strokeWidth={2.5}
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
              ) : (
                <p className="text-sm text-center py-10 muted-text" style={{ color: "#71717a" }}>
                  {isEs ? "Sin datos" : "No data"}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            4. COST SUMMARY TABLE
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="px-6 pb-6 page-break">
          <h3 className="text-sm font-bold dark-text mb-4 flex items-center gap-2" style={{ color: "#f4f4f5" }}>
            <span>📋</span> {isEs ? "Resumen de Costos por Capítulo" : "Cost Summary by Chapter"}
          </h3>
          <div className="dark-card bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr className="bg-zinc-800">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#a1a1aa" }}>#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#a1a1aa" }}>
                    {isEs ? "Categoría" : "Category"}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: "#a1a1aa" }}>
                    {isEs ? "Presupuesto" : "Budget"}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: "#a1a1aa" }}>
                    {isEs ? "Ejecutado" : "Executed"}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: "#a1a1aa" }}>
                    {isEs ? "Variación" : "Variance"}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: "#a1a1aa" }}>
                    % {isEs ? "Aprobado" : "Approved"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {chapters.map((ch, i) => {
                  const varianceSign = ch.variance > 0 ? "over" : ch.variance < 0 ? "under" : "zero";
                  return (
                    <tr
                      key={ch.name}
                      className="hover:bg-zinc-800/50 transition-colors"
                      style={{ borderBottom: "1px solid rgba(39,39,42,0.5)" }}
                    >
                      <td className="px-4 py-3 text-xs muted-text" style={{ color: "#71717a" }}>{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 rounded-full" style={{ width: 8, height: 8, background: ch.color }} />
                          <span className="dark-text text-sm" style={{ color: "#f4f4f5" }}>{ch.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right dark-text font-medium" style={{ color: "#f4f4f5" }}>{fmt(ch.total)}</td>
                      <td className="px-4 py-3 text-right font-medium" style={{ color: "#10b981" }}>{fmt(ch.approved)}</td>
                      <td className="px-4 py-3 text-right font-medium" style={{
                        color: varianceSign === "over" ? "#ef4444" : varianceSign === "under" ? "#10b981" : "#a1a1aa",
                      }}>
                        {varianceSign === "over" && "↑ "}
                        {varianceSign === "under" && "↓ "}
                        {varianceSign === "zero" && "→ "}
                        {fmt(Math.abs(ch.variance))}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${Math.min(ch.approvedPctCh, 100)}%`, background: ch.approvedPctCh > 100 ? "#ef4444" : "#10b981" }}
                            />
                          </div>
                          <span className="text-xs font-medium dark-text" style={{ color: "#f4f4f5", minWidth: 36, textAlign: "right" }}>
                            {ch.approvedPctCh.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-zinc-800">
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 font-bold dark-text" style={{ color: "#f4f4f5" }}>Total</td>
                  <td className="px-4 py-3 text-right font-bold dark-text" style={{ color: "#f4f4f5" }}>{fmt(budgetTotal)}</td>
                  <td className="px-4 py-3 text-right font-bold" style={{ color: "#10b981" }}>{fmt(approvedTotal)}</td>
                  <td className="px-4 py-3 text-right font-bold" style={{
                    color: approvedTotal - budgetTotal > 0 ? "#ef4444" : approvedTotal - budgetTotal < 0 ? "#10b981" : "#a1a1aa",
                  }}>
                    {approvedTotal - budgetTotal > 0 && "↑ "}
                    {approvedTotal - budgetTotal < 0 && "↓ "}
                    {approvedTotal - budgetTotal === 0 && "→ "}
                    {fmt(Math.abs(approvedTotal - budgetTotal))}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-zinc-700 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.min(approvedPct, 100)}%`, background: approvedPct > 100 ? "#ef4444" : "#10b981" }}
                        />
                      </div>
                      <span className="text-xs font-bold dark-text" style={{ color: "#f4f4f5", minWidth: 36, textAlign: "right" }}>
                        {approvedPct.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            5. FOOTER
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="text-center px-6 pb-6">
          <div style={{ borderTop: "1px solid #27272a", paddingTop: 16 }}>
            <p className="text-xs muted-text" style={{ color: "#52525b", margin: 0 }}>
              {isEs ? "Generado por" : "Generated by"} <span className="accent-text" style={{ color: "#f97316" }}>ConstruSheet</span> · construsheet.vercel.app
            </p>
            <p className="text-xs muted-text" style={{ color: "#3f3f46", margin: "4px 0 0" }}>
              {dateStr} · Project ID: {projectId}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
