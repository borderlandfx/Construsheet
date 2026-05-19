"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Download,
  Link2,
  Loader2,
  RefreshCw,
  DollarSign,
  TrendingUp,
  Calendar,
  Activity,
  FileText,
  Printer,
  BarChart2,
  FileOutput,
} from "lucide-react";
import {
  ToolbarPortal, ToolbarGroup, ToolbarSep,
  TBtn,
} from "@/components/workspace/ContextualToolbar";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Area,
  AreaChart,
} from "recharts";
import Papa from "papaparse";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/context/WorkspaceContext";
import { useToast } from "@/lib/context/ToastContext";
import type { BudgetRow, ApuItem, GanttTask, TakeoffItem } from "@/lib/types/database.types";
import type { Locale } from "@/lib/utils/i18n";

// ─── Design tokens ────────────────────────────────────────────────────────────

const COLORS = [
  "#f97316", "#3b82f6", "#22c55e", "#a855f7", "#ec4899",
  "#14b8a6", "#eab308", "#6366f1", "#ef4444", "#06b6d4",
];

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({
  icon: Icon,
  label,
  value,
  sub,
  trend,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  trend?: { value: number; label: string };
  accent?: string;
}) {
  const accentColor = accent ?? "#f97316";
  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-5 transition-all hover:border-orange-500/30 hover:shadow-lg hover:shadow-orange-500/5">
      {/* Gradient glow */}
      <div
        className="absolute -right-4 -top-4 h-24 w-24 rounded-full opacity-10 blur-2xl"
        style={{ background: accentColor }}
      />
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--cs-muted)]">
            {label}
          </p>
          <p className="text-2xl font-bold text-[var(--cs-text)]">{value}</p>
          {sub && (
            <p className="text-xs text-[var(--cs-muted)]">{sub}</p>
          )}
        </div>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ background: `${accentColor}15` }}
        >
          <Icon className="h-5 w-5" style={{ color: accentColor }} />
        </div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1.5">
          <span
            className="text-xs font-semibold"
            style={{ color: trend.value >= 0 ? "#22c55e" : "#ef4444" }}
          >
            {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value).toFixed(1)}%
          </span>
          <span className="text-xs text-[var(--cs-muted)]">{trend.label}</span>
        </div>
      )}
    </div>
  );
}

// ─── Chart Card wrapper ───────────────────────────────────────────────────────

function ChartCard({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-5 ${className}`}
    >
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-[var(--cs-text)]">{title}</h3>
        {subtitle && (
          <p className="mt-0.5 text-xs text-[var(--cs-muted)]">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] p-3 shadow-xl">
      {label && (
        <p className="mb-1.5 text-xs font-medium text-[var(--cs-muted)]">{label}</p>
      )}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: entry.color }}
          />
          <span className="text-xs text-[var(--cs-muted)]">{entry.name}:</span>
          <span className="text-xs font-semibold text-[var(--cs-text)]">
            {formatter ? formatter(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── ReportsTab ───────────────────────────────────────────────────────────────

export default function ReportsTab() {
  const supabaseRef = useRef(createClient());
  const { projectId, language, fmt } = useWorkspace();
  const { toast } = useToast();
  const lang = language as Locale;

  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [budgetRows, setBudgetRows] = useState<BudgetRow[]>([]);
  const [apuItems, setApuItems] = useState<ApuItem[]>([]);
  const [ganttTasks, setGanttTasks] = useState<GanttTask[]>([]);
  const [takeoffItems, setTakeoffItems] = useState<TakeoffItem[]>([]);

  // ── Fetch all project data ─────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      const supabase = supabaseRef.current;
      const [br, ai, gt, to] = await Promise.all([
        supabase.from("budget_rows").select("*").eq("project_id", projectId).order("sort_order"),
        supabase.from("apu_items").select("*").eq("project_id", projectId).order("created_at"),
        supabase.from("gantt_tasks").select("*").eq("project_id", projectId).order("sort_order"),
        supabase.from("takeoff_items").select("*").eq("project_id", projectId).order("sort_order"),
      ]);
      if (cancelled) return;
      setBudgetRows((br.data as BudgetRow[]) ?? []);
      setApuItems((ai.data as ApuItem[]) ?? []);
      setGanttTasks((gt.data as GanttTask[]) ?? []);
      setTakeoffItems((to.data as TakeoffItem[]) ?? []);
      setLoading(false);
    }
    loadData();
    return () => { cancelled = true; };
  }, [projectId, refreshKey]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const budgetTotal = useMemo(
    () => budgetRows.reduce((s, r) => s + (r.total ?? r.quantity * r.unit_price), 0),
    [budgetRows]
  );

  const sections = useMemo(
    () => Array.from(new Set(budgetRows.map((r) => r.section))),
    [budgetRows]
  );

  const completedTasks = ganttTasks.filter((t) => t.status === "approved").length;
  const avgProgress = ganttTasks.length > 0
    ? Math.round(ganttTasks.reduce((s, t) => s + (t.progress_pct ?? 0), 0) / ganttTasks.length)
    : 0;

  // Total project duration in weeks
  const totalWeeks = useMemo(() => {
    if (ganttTasks.length === 0) return 0;
    return Math.max(...ganttTasks.map((t) => (t.start_week ?? 1) + (t.duration_weeks ?? 1)));
  }, [ganttTasks]);

  // Executed spend (approved rows)
  const executedSpend = useMemo(
    () => budgetRows
      .filter((r) => r.status === "approved")
      .reduce((s, r) => s + (r.total ?? r.quantity * r.unit_price), 0),
    [budgetRows]
  );

  // ── Chart data: Donut (cost distribution by section) ───────────────────────

  const donutData = useMemo(() => {
    return sections.map((sec, i) => {
      const secRows = budgetRows.filter((r) => r.section === sec);
      const secTotal = secRows.reduce((s, r) => s + (r.total ?? r.quantity * r.unit_price), 0);
      return { name: sec, value: secTotal, color: COLORS[i % COLORS.length] };
    });
  }, [sections, budgetRows]);

  // ── Chart data: Monthly progress vs budget bar chart ───────────────────────

  const barChartData = useMemo(() => {
    if (ganttTasks.length === 0 && budgetRows.length === 0) return [];

    // Group by week ranges (every 4 weeks = ~1 month)
    const maxWeek = totalWeeks || 12;
    const months: { name: string; presupuesto: number; avance: number }[] = [];

    for (let w = 1; w <= maxWeek; w += 4) {
      const weekEnd = Math.min(w + 3, maxWeek);
      const monthLabel = lang === "es" ? `Mes ${Math.ceil(w / 4)}` : `Month ${Math.ceil(w / 4)}`;

      // Budget for tasks active in this period
      const tasksInPeriod = ganttTasks.filter((t) => {
        const start = t.start_week ?? 1;
        const end = start + (t.duration_weeks ?? 1) - 1;
        return start <= weekEnd && end >= w;
      });

      // Get budget from linked sections
      const linkedSections = new Set(tasksInPeriod.map((t) => t.budget_section).filter(Boolean));
      const periodBudget = linkedSections.size > 0
        ? budgetRows
            .filter((r) => linkedSections.has(r.section))
            .reduce((s, r) => s + (r.total ?? r.quantity * r.unit_price), 0) / Math.ceil((weekEnd - w + 1) / 4)
        : 0;

      // Progress: weighted average of tasks in period
      const periodProgress = tasksInPeriod.length > 0
        ? tasksInPeriod.reduce((s, t) => s + (t.progress_pct ?? 0), 0) / tasksInPeriod.length
        : 0;

      // Approximate executed value based on progress
      const executed = periodBudget * (periodProgress / 100);

      months.push({
        name: monthLabel,
        presupuesto: Math.round(periodBudget),
        avance: Math.round(executed),
      });
    }

    return months;
  }, [ganttTasks, budgetRows, totalWeeks, lang]);

  // ── Chart data: S-Curve (cumulative planned vs executed) ───────────────────

  const sCurveData = useMemo(() => {
    if (ganttTasks.length === 0) return [];

    const maxWeek = totalWeeks || 12;
    const points: { week: number; planificado: number; ejecutado: number }[] = [];
    let cumulativePlanned = 0;
    let cumulativeExecuted = 0;

    for (let w = 1; w <= maxWeek; w++) {
      // Tasks that should be contributing in this week
      const activeTasks = ganttTasks.filter((t) => {
        const start = t.start_week ?? 1;
        const end = start + (t.duration_weeks ?? 1) - 1;
        return start <= w && end >= w;
      });

      // Planned: distribute budget evenly across task duration
      activeTasks.forEach((task) => {
        const linkedRows = budgetRows.filter(
          (r) => r.section === task.budget_section
        );
        const taskBudget = linkedRows.reduce(
          (s, r) => s + (r.total ?? r.quantity * r.unit_price),
          0
        );
        const weeklyPlanned = taskBudget / (task.duration_weeks ?? 1);
        cumulativePlanned += weeklyPlanned / activeTasks.length;

        // Executed: based on actual progress
        const weeklyExecuted = weeklyPlanned * ((task.progress_pct ?? 0) / 100);
        cumulativeExecuted += weeklyExecuted / activeTasks.length;
      });

      if (w % 2 === 0 || w === 1 || w === maxWeek) {
        points.push({
          week: w,
          planificado: Math.round(cumulativePlanned),
          ejecutado: Math.round(cumulativeExecuted),
        });
      }
    }

    return points;
  }, [ganttTasks, budgetRows, totalWeeks]);

  // ── CSV export (papaparse) ──────────────────────────────────────────────────

  function handleBudgetCSV() {
    const data = budgetRows.map((r) => ({
      [lang === "es" ? "Sección" : "Section"]: r.section,
      [lang === "es" ? "Código" : "Code"]: r.code ?? "",
      [lang === "es" ? "Descripción" : "Description"]: r.description,
      [lang === "es" ? "Unidad" : "Unit"]: r.unit ?? "",
      [lang === "es" ? "Cantidad" : "Quantity"]: r.quantity,
      [lang === "es" ? "Precio Unit." : "Unit Price"]: r.unit_price,
      Total: r.total ?? r.quantity * r.unit_price,
      [lang === "es" ? "Estatus" : "Status"]: r.status,
      [lang === "es" ? "Responsable" : "Assignee"]: r.assignee ?? "",
    }));
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `presupuesto-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function handleApuCSV() {
    const data = apuItems.map((item) => ({
      [lang === "es" ? "Código" : "Code"]: item.code,
      [lang === "es" ? "Descripción" : "Description"]: item.description,
      [lang === "es" ? "Unidad" : "Unit"]: item.unit,
      [lang === "es" ? "Costo Directo" : "Direct Cost"]: item.direct_cost.toFixed(2),
      [lang === "es" ? "GG %" : "OH %"]: item.overhead_pct.toFixed(2),
      [lang === "es" ? "Utilidad %" : "Profit %"]: item.profit_pct.toFixed(2),
      [lang === "es" ? "Precio Venta" : "Selling Price"]: item.selling_price.toFixed(2),
    }));
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `apu-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  // ── PDF on-demand generation (avoids render-loop from PDFDownloadLink) ──────

  const [pdfGenerating, setPdfGenerating] = useState(false);

  const handlePDFDownload = useCallback(async () => {
    setPdfGenerating(true);
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { default: ReportsPDFComponent } = await import("./ReportsPDF");

      const pdfSections = sections.map((sec) => ({
        name: sec,
        total: fmt(
          budgetRows
            .filter((r) => r.section === sec)
            .reduce((s, r) => s + (r.total ?? r.quantity * r.unit_price), 0)
        ),
      }));

      const pdfTasks = ganttTasks.slice(0, 15).map((t) => ({
        id: t.id,
        name: t.name,
        progress_pct: t.progress_pct,
      }));

      const blob = await pdf(
        <ReportsPDFComponent
          lang={lang}
          budgetTotal={fmt(budgetTotal)}
          avgProgress={avgProgress}
          executedSpend={fmt(executedSpend)}
          totalWeeks={totalWeeks}
          sections={pdfSections}
          budgetTotalFormatted={fmt(budgetTotal)}
          ganttTasks={pdfTasks}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `reporte-proyecto-${Date.now()}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast(lang === "es" ? "Error al generar PDF" : "PDF generation failed", "error");
    } finally {
      setPdfGenerating(false);
    }
  }, [sections, budgetRows, ganttTasks, budgetTotal, executedSpend, avgProgress, totalWeeks, lang, fmt, toast]);


  // ── Share (copy URL) ──────────────────────────────────────────────────────
  async function handleShare() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast(
        lang === "es" ? "URL copiada al portapapeles" : "URL copied to clipboard",
        "success"
      );
    } catch {
      toast(
        lang === "es" ? "No se pudo copiar la URL" : "Could not copy URL",
        "error"
      );
    }
  }

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--cs-muted)]" />
      </div>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────────────────

  if (budgetRows.length === 0 && apuItems.length === 0 && ganttTasks.length === 0 && takeoffItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 rounded-xl border-2 border-dashed border-[var(--cs-border)] text-center gap-3">
        <Activity className="h-10 w-10 text-[var(--cs-muted)] opacity-50" />
        <p className="text-base font-semibold text-[var(--cs-text)]">
          {lang === "es" ? "Sin datos para reportar" : "No data to report yet"}
        </p>
        <p className="text-sm text-[var(--cs-muted)] max-w-sm">
          {lang === "es"
            ? "Agrega partidas, APUs o tareas en las pestañas correspondientes para ver el dashboard aquí."
            : "Add budget rows, APUs, or tasks in their respective tabs to see the dashboard here."}
        </p>
      </div>
    );
  }

  return (
    <>
    <ToolbarPortal>
      <ToolbarGroup label={lang === "es" ? "Exportar" : "Export"}>
        <TBtn onClick={handleBudgetCSV} disabled={budgetRows.length === 0}>
          <Download className="h-3.5 w-3.5" /> CSV
        </TBtn>
        <TBtn onClick={handlePDFDownload} disabled={pdfGenerating}>
          <FileText className="h-3.5 w-3.5" /> {pdfGenerating ? (lang === "es" ? "Generando..." : "Generating...") : "PDF"}
        </TBtn>
        <TBtn onClick={handleApuCSV} disabled={apuItems.length === 0}>
          <Download className="h-3.5 w-3.5" /> Excel
        </TBtn>
      </ToolbarGroup>
      <ToolbarSep />
      <ToolbarGroup label={lang === "es" ? "Tipo" : "Type"}>
        <TBtn active>
          <BarChart2 className="h-3.5 w-3.5" /> {lang === "es" ? "Por capítulo" : "By chapter"}
        </TBtn>
        <TBtn>
          <TrendingUp className="h-3.5 w-3.5" /> {lang === "es" ? "Avance" : "Progress"}
        </TBtn>
        <TBtn>
          <FileOutput className="h-3.5 w-3.5" /> {lang === "es" ? "Resumen ejecutivo" : "Executive summary"}
        </TBtn>
      </ToolbarGroup>
      <ToolbarSep />
      <TBtn onClick={() => window.print()}>
        <Printer className="h-3.5 w-3.5" /> {lang === "es" ? "Imprimir" : "Print"}
      </TBtn>
    </ToolbarPortal>
    <div className="flex flex-col gap-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--cs-text)]">
            {lang === "es" ? "Dashboard del Proyecto" : "Project Dashboard"}
          </h2>
          <p className="text-xs text-[var(--cs-muted)] mt-0.5">
            {lang === "es" ? "Métricas y análisis en tiempo real" : "Real-time metrics & analytics"}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--cs-border)] text-[var(--cs-muted)] hover:text-[var(--cs-text)] hover:border-orange-500/30 transition-colors"
            title={lang === "es" ? "Actualizar" : "Refresh"}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--cs-border)] px-3 py-2 text-sm text-[var(--cs-muted)] hover:text-[var(--cs-text)] hover:border-orange-500/30 transition-colors"
          >
            <Link2 className="h-4 w-4" />
            {lang === "es" ? "Compartir" : "Share"}
          </button>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={DollarSign}
          label={lang === "es" ? "Total Presupuesto" : "Total Budget"}
          value={fmt(budgetTotal)}
          sub={`${budgetRows.length} ${lang === "es" ? "partidas" : "line items"}`}
          accent="#f97316"
        />
        <KPICard
          icon={Activity}
          label={lang === "es" ? "Avance Físico" : "Physical Progress"}
          value={`${avgProgress}%`}
          sub={`${completedTasks}/${ganttTasks.length} ${lang === "es" ? "tareas completas" : "tasks complete"}`}
          trend={avgProgress > 0 ? { value: avgProgress, label: lang === "es" ? "promedio" : "average" } : undefined}
          accent="#22c55e"
        />
        <KPICard
          icon={TrendingUp}
          label={lang === "es" ? "Gasto Ejecutado" : "Executed Spend"}
          value={fmt(executedSpend)}
          sub={budgetTotal > 0
            ? `${((executedSpend / budgetTotal) * 100).toFixed(1)}% ${lang === "es" ? "del presupuesto" : "of budget"}`
            : undefined
          }
          accent="#3b82f6"
        />
        <KPICard
          icon={Calendar}
          label={lang === "es" ? "Duración del Proyecto" : "Project Duration"}
          value={totalWeeks > 0 ? `${totalWeeks} ${lang === "es" ? "sem." : "wks"}` : "—"}
          sub={totalWeeks > 0
            ? `≈ ${Math.ceil(totalWeeks / 4)} ${lang === "es" ? "meses" : "months"}`
            : lang === "es" ? "Sin cronograma" : "No schedule"
          }
          accent="#a855f7"
        />
      </div>

      {/* ── Charts row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Donut: Cost distribution by section */}
        {donutData.length > 0 && (
          <ChartCard
            title={lang === "es" ? "Distribución de Costos por Capítulo" : "Cost Distribution by Chapter"}
            subtitle={lang === "es" ? "Proporción del presupuesto por sección" : "Budget proportion by section"}
          >
            <div className="flex items-center gap-4">
              <div className="h-[220px] w-[220px] flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {donutData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={<CustomTooltip formatter={fmt} />}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-2 overflow-auto max-h-[220px] flex-1">
                {donutData.map((entry, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-sm flex-shrink-0"
                      style={{ background: entry.color }}
                    />
                    <span className="text-xs text-[var(--cs-text)] truncate flex-1">
                      {entry.name}
                    </span>
                    <span className="text-xs font-medium text-[var(--cs-muted)] flex-shrink-0">
                      {budgetTotal > 0 ? `${((entry.value / budgetTotal) * 100).toFixed(0)}%` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </ChartCard>
        )}

        {/* Bar: Monthly progress vs budget */}
        {barChartData.length > 0 && (
          <ChartCard
            title={lang === "es" ? "Avance vs Presupuesto Mensual" : "Monthly Progress vs Budget"}
            subtitle={lang === "es" ? "Comparación de ejecución planificada" : "Planned execution comparison"}
          >
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--cs-border)" opacity={0.5} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "var(--cs-muted)", fontSize: 11 }}
                    axisLine={{ stroke: "var(--cs-border)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "var(--cs-muted)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                  />
                  <Tooltip content={<CustomTooltip formatter={fmt} />} />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    iconType="circle"
                    iconSize={8}
                  />
                  <Bar
                    dataKey="presupuesto"
                    name={lang === "es" ? "Presupuesto" : "Budget"}
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                    opacity={0.8}
                  />
                  <Bar
                    dataKey="avance"
                    name={lang === "es" ? "Ejecutado" : "Executed"}
                    fill="#22c55e"
                    radius={[4, 4, 0, 0]}
                    opacity={0.8}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        )}
      </div>

      {/* ── S-Curve ────────────────────────────────────────────── */}
      {sCurveData.length > 0 && (
        <ChartCard
          title={lang === "es" ? "Curva S — Costo Acumulado" : "S-Curve — Cumulative Cost"}
          subtitle={lang === "es"
            ? "Planificado vs ejecutado a lo largo del proyecto"
            : "Planned vs executed over project timeline"
          }
        >
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sCurveData}>
                <defs>
                  <linearGradient id="gradPlanned" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradExecuted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--cs-border)" opacity={0.5} />
                <XAxis
                  dataKey="week"
                  tick={{ fill: "var(--cs-muted)", fontSize: 11 }}
                  axisLine={{ stroke: "var(--cs-border)" }}
                  tickLine={false}
                  label={{
                    value: lang === "es" ? "Semana" : "Week",
                    position: "insideBottom",
                    offset: -5,
                    style: { fill: "var(--cs-muted)", fontSize: 11 },
                  }}
                />
                <YAxis
                  tick={{ fill: "var(--cs-muted)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                />
                <Tooltip content={<CustomTooltip formatter={fmt} />} />
                <Legend
                  wrapperStyle={{ fontSize: 11 }}
                  iconType="circle"
                  iconSize={8}
                />
                <Area
                  type="monotone"
                  dataKey="planificado"
                  name={lang === "es" ? "Planificado" : "Planned"}
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#gradPlanned)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2 }}
                />
                <Area
                  type="monotone"
                  dataKey="ejecutado"
                  name={lang === "es" ? "Ejecutado" : "Executed"}
                  stroke="#22c55e"
                  strokeWidth={2}
                  fill="url(#gradExecuted)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      )}

      {/* ── Sections breakdown table ──────────────────────────── */}
      {sections.length > 0 && (
        <ChartCard
          title={lang === "es" ? "Desglose por Capítulo" : "Breakdown by Chapter"}
          subtitle={lang === "es" ? "Detalle de costos por sección" : "Cost detail per section"}
        >
          <div className="divide-y divide-[var(--cs-border)]">
            {sections.map((sec, i) => {
              const secRows = budgetRows.filter((r) => r.section === sec);
              const secTotal = secRows.reduce((s, r) => s + (r.total ?? r.quantity * r.unit_price), 0);
              const pct = budgetTotal > 0 ? (secTotal / budgetTotal) * 100 : 0;
              // Task progress for this section
              const sectionTasks = ganttTasks.filter((t) => t.budget_section === sec);
              const sectionProgress = sectionTasks.length > 0
                ? Math.round(sectionTasks.reduce((s, t) => s + (t.progress_pct ?? 0), 0) / sectionTasks.length)
                : null;

              return (
                <div key={sec} className="flex items-center gap-4 py-3">
                  <span
                    className="h-3 w-3 rounded-sm flex-shrink-0"
                    style={{ background: COLORS[i % COLORS.length] }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-medium text-[var(--cs-text)] truncate">{sec}</p>
                      <p className="text-sm font-semibold text-[var(--cs-text)] flex-shrink-0 ml-3">
                        {fmt(secTotal)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 rounded-full bg-[var(--cs-border)] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            background: COLORS[i % COLORS.length],
                          }}
                        />
                      </div>
                      <span className="text-xs text-[var(--cs-muted)] w-10 text-right">
                        {pct.toFixed(0)}%
                      </span>
                      {sectionProgress !== null && (
                        <span className="text-xs font-medium text-emerald-500 w-12 text-right">
                          ▶ {sectionProgress}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total footer */}
          <div className="flex items-center justify-between pt-4 mt-4 border-t border-[var(--cs-border)]">
            <span className="text-sm font-medium text-[var(--cs-muted)]">
              {lang === "es" ? "Total del presupuesto" : "Budget total"}
            </span>
            <span className="text-xl font-bold text-[var(--cs-accent)]">
              {fmt(budgetTotal)}
            </span>
          </div>
        </ChartCard>
      )}

      {/* ── Schedule overview ─────────────────────────────────── */}
      {ganttTasks.length > 0 && (
        <ChartCard
          title={lang === "es" ? "Estado del Cronograma" : "Schedule Status"}
          subtitle={`${completedTasks}/${ganttTasks.length} ${lang === "es" ? "tareas completadas" : "tasks completed"} · ${avgProgress}% ${lang === "es" ? "avance promedio" : "avg. progress"}`}
        >
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[
              { status: "approved", label: lang === "es" ? "Aprobado" : "Approved", color: "#10b981" },
              { status: "in-review", label: lang === "es" ? "En revisión" : "Under Review", color: "#f59e0b" },
              { status: "pending", label: lang === "es" ? "Pendiente" : "Pending", color: "#60a5fa" },
            ].map(({ status, label, color }) => {
              const count = ganttTasks.filter((t) => t.status === status).length;
              return (
                <div key={status} className="flex items-center gap-2 rounded-lg border border-[var(--cs-border)] p-3">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                  <div>
                    <p className="text-lg font-bold text-[var(--cs-text)]">{count}</p>
                    <p className="text-xs text-[var(--cs-muted)]">{label}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Task progress bars (top 8) */}
          <div className="space-y-2.5 max-h-[300px] overflow-auto">
            {ganttTasks.slice(0, 8).map((task) => {
              const pct = task.progress_pct ?? 0;
              const barColor = task.status === "approved" ? "#10b981"
                : task.status === "in-review" ? "#f59e0b"
                : "#60a5fa";
              return (
                <div key={task.id} className="flex items-center gap-3">
                  <span className="text-xs text-[var(--cs-muted)] w-[140px] truncate flex-shrink-0">
                    {task.name}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-[var(--cs-border)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: barColor }}
                    />
                  </div>
                  <span
                    className="text-xs font-semibold w-10 text-right"
                    style={{ color: pct === 100 ? "#22c55e" : "var(--cs-text)" }}
                  >
                    {pct}%
                  </span>
                </div>
              );
            })}
            {ganttTasks.length > 8 && (
              <p className="text-xs text-[var(--cs-muted)] text-center pt-1">
                +{ganttTasks.length - 8} {lang === "es" ? "tareas más" : "more tasks"}
              </p>
            )}
          </div>
        </ChartCard>
      )}
    </div>
    </>
  );
}
