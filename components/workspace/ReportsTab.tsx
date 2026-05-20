"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Download,
  Link2,
  Loader2,
  RefreshCw,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Printer,
  Activity,
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
  LabelList,
} from "recharts";
import Papa from "papaparse";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/context/WorkspaceContext";
import { useToast } from "@/lib/context/ToastContext";
import type { BudgetRow } from "@/lib/types/database.types";
import type { Locale } from "@/lib/utils/i18n";

// ─── Status colors ───────────────────────────────────────────────────────────

const STATUS_COLORS = {
  approved:    "#22c55e",
  "in-review": "#fbbf24",
  pending:     "#3b82f6",
} as const;

// ─── Metric Card ─────────────────────────────────────────────────────────────

function MetricCard({
  icon: Icon,
  label,
  amount,
  pct,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  amount: string;
  pct: string;
  accent: string;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-xl p-5 transition-all"
      style={{
        background: "var(--color-background-secondary)",
        border: "1px solid var(--color-border-tertiary)",
      }}
    >
      {/* Gradient glow */}
      <div
        className="absolute -right-4 -top-4 h-24 w-24 rounded-full opacity-10 blur-2xl"
        style={{ background: accent }}
      />
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <p
            className="text-xs font-medium uppercase tracking-wider font-dm-sans"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {label}
          </p>
          <p
            className="text-2xl font-bold font-dm-sans"
            style={{ color: "var(--color-text-primary)" }}
          >
            {amount}
          </p>
          <p
            className="text-xs font-dm-sans"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {pct}
          </p>
        </div>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ background: `${accent}15` }}
        >
          <Icon className="h-5 w-5" style={{ color: accent }} />
        </div>
      </div>
    </div>
  );
}

// ─── Chart Card wrapper ──────────────────────────────────────────────────────

function ChartCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl p-5 ${className}`}
      style={{
        background: "var(--color-background-secondary)",
        border: "1px solid var(--color-border-tertiary)",
      }}
    >
      <h3
        className="text-sm font-semibold font-dm-sans mb-4"
        style={{ color: "var(--color-text-primary)" }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

// ─── Custom Bar Tooltip ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BarTooltipContent({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg p-3 shadow-xl"
      style={{
        background: "var(--color-background-secondary)",
        border: "1px solid var(--color-border-tertiary)",
      }}
    >
      <p
        className="mb-1.5 text-xs font-medium"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {label}
      </p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: entry.color }}
          />
          <span
            className="text-xs font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            {formatter ? formatter(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Donut center label ──────────────────────────────────────────────────────

function DonutCenterLabel({ viewBox, value }: { viewBox?: { cx: number; cy: number }; value: string }) {
  if (!viewBox) return null;
  const { cx, cy } = viewBox;
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
      <tspan
        x={cx}
        y={cy - 6}
        style={{ fontSize: 22, fontWeight: 700, fill: "var(--color-text-primary)" }}
      >
        {value}
      </tspan>
      <tspan
        x={cx}
        y={cy + 14}
        style={{ fontSize: 10, fill: "var(--color-text-secondary)" }}
      >
        Approved
      </tspan>
    </text>
  );
}

// ─── ReportsTab ──────────────────────────────────────────────────────────────

export default function ReportsTab() {
  const supabaseRef = useRef(createClient());
  const { projectId, language, fmt } = useWorkspace();
  const { toast } = useToast();
  const lang = language as Locale;

  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [budgetRows, setBudgetRows] = useState<BudgetRow[]>([]);

  // ── Fetch budget data ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      const { data } = await supabaseRef.current
        .from("budget_rows")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order");
      if (cancelled) return;
      setBudgetRows((data as BudgetRow[]) ?? []);
      setLoading(false);
    }
    loadData();
    return () => { cancelled = true; };
  }, [projectId, refreshKey]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const itemRows = useMemo(
    () => budgetRows.filter((r) => !r.is_chapter),
    [budgetRows]
  );

  const rowTotal = (r: BudgetRow) => r.total ?? r.quantity * r.unit_price;

  const budgetTotal = useMemo(
    () => itemRows.reduce((s, r) => s + rowTotal(r), 0),
    [itemRows]
  );

  const approvedTotal = useMemo(
    () => itemRows.filter((r) => r.status === "approved").reduce((s, r) => s + rowTotal(r), 0),
    [itemRows]
  );

  const reviewTotal = useMemo(
    () => itemRows.filter((r) => r.status === "in-review").reduce((s, r) => s + rowTotal(r), 0),
    [itemRows]
  );

  const pendingTotal = useMemo(
    () => itemRows.filter((r) => r.status === "pending").reduce((s, r) => s + rowTotal(r), 0),
    [itemRows]
  );

  const pctOf = (v: number) =>
    budgetTotal > 0 ? `${((v / budgetTotal) * 100).toFixed(1)}%` : "0%";

  // ── Chapters (sections) ────────────────────────────────────────────────────

  const chapters = useMemo(() => {
    const sectionNames = Array.from(new Set(itemRows.map((r) => r.section)));
    return sectionNames.map((sec) => {
      const rows = itemRows.filter((r) => r.section === sec);
      const total = rows.reduce((s, r) => s + rowTotal(r), 0);
      const approved = rows.filter((r) => r.status === "approved").reduce((s, r) => s + rowTotal(r), 0);
      const review = rows.filter((r) => r.status === "in-review").reduce((s, r) => s + rowTotal(r), 0);
      const pending = rows.filter((r) => r.status === "pending").reduce((s, r) => s + rowTotal(r), 0);
      const approvedPct = total > 0 ? (approved / total) * 100 : 0;

      // Determine overall chapter status
      let status: "approved" | "in-review" | "pending" = "pending";
      if (rows.every((r) => r.status === "approved")) status = "approved";
      else if (rows.some((r) => r.status === "approved" || r.status === "in-review")) status = "in-review";

      return {
        name: sec,
        items: rows.length,
        total,
        approved,
        review,
        pending,
        approvedPct,
        status,
      };
    });
  }, [itemRows]);

  // ── Bar chart data ─────────────────────────────────────────────────────────

  const barData = useMemo(
    () => chapters.map((ch) => ({
      name: ch.name.length > 18 ? ch.name.slice(0, 16) + "…" : ch.name,
      fullName: ch.name,
      total: ch.total,
    })),
    [chapters]
  );

  // ── Donut chart data ───────────────────────────────────────────────────────

  const donutData = useMemo(() => {
    const segments = [
      { name: lang === "es" ? "Aprobado" : "Approved", value: approvedTotal, color: STATUS_COLORS.approved },
      { name: lang === "es" ? "En Revisión" : "Under Review", value: reviewTotal, color: STATUS_COLORS["in-review"] },
      { name: lang === "es" ? "Pendiente" : "Pending", value: pendingTotal, color: STATUS_COLORS.pending },
    ];
    return segments.filter((s) => s.value > 0);
  }, [approvedTotal, reviewTotal, pendingTotal, lang]);

  const approvedPctTotal = budgetTotal > 0 ? ((approvedTotal / budgetTotal) * 100).toFixed(0) : "0";

  // ── CSV export ─────────────────────────────────────────────────────────────

  const handleCSV = useCallback(() => {
    const data = itemRows.map((r) => ({
      [lang === "es" ? "Sección" : "Section"]: r.section,
      [lang === "es" ? "Código" : "Code"]: r.code ?? "",
      [lang === "es" ? "Descripción" : "Description"]: r.description,
      [lang === "es" ? "Unidad" : "Unit"]: r.unit ?? "",
      [lang === "es" ? "Cantidad" : "Quantity"]: r.quantity,
      [lang === "es" ? "Precio Unit." : "Unit Price"]: r.unit_price,
      Total: rowTotal(r),
      [lang === "es" ? "Estatus" : "Status"]: r.status,
    }));
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `budget-report-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }, [itemRows, lang]);

  // ── PDF (react-pdf) ────────────────────────────────────────────────────────

  const [pdfGenerating, setPdfGenerating] = useState(false);

  const handlePDF = useCallback(async () => {
    setPdfGenerating(true);
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { default: ReportsPDFComponent } = await import("./ReportsPDF");

      const pdfSections = chapters.map((ch) => ({ name: ch.name, total: fmt(ch.total) }));

      const blob = await pdf(
        <ReportsPDFComponent
          lang={lang}
          budgetTotal={fmt(budgetTotal)}
          avgProgress={Number(approvedPctTotal)}
          executedSpend={fmt(approvedTotal)}
          totalWeeks={0}
          sections={pdfSections}
          budgetTotalFormatted={fmt(budgetTotal)}
          ganttTasks={[]}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `budget-report-${Date.now()}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast(lang === "es" ? "Error al generar PDF" : "PDF generation failed", "error");
    } finally {
      setPdfGenerating(false);
    }
  }, [chapters, budgetTotal, approvedTotal, approvedPctTotal, lang, fmt, toast]);

  // ── Share ──────────────────────────────────────────────────────────────────

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast(lang === "es" ? "URL copiada" : "URL copied", "success");
    } catch {
      toast(lang === "es" ? "No se pudo copiar" : "Could not copy", "error");
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--color-text-secondary)" }} />
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────

  if (itemRows.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-16 rounded-xl text-center gap-3"
        style={{ border: "2px dashed var(--color-border-tertiary)" }}
      >
        <Activity className="h-10 w-10 opacity-50" style={{ color: "var(--color-text-secondary)" }} />
        <p className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>
          {lang === "es" ? "Sin datos para reportar" : "No data to report yet"}
        </p>
        <p className="text-sm max-w-sm" style={{ color: "var(--color-text-secondary)" }}>
          {lang === "es"
            ? "Agrega partidas en la pestaña de Presupuesto para ver el reporte aquí."
            : "Add budget rows in the Budget tab to see the report here."}
        </p>
      </div>
    );
  }

  // ── Status labels for table ────────────────────────────────────────────────

  const statusLabel = (s: string) => {
    if (s === "approved") return lang === "es" ? "Aprobado" : "Approved";
    if (s === "in-review") return lang === "es" ? "En Revisión" : "Under Review";
    return lang === "es" ? "Pendiente" : "Pending";
  };

  // ── Short currency formatter for bar labels ────────────────────────────────

  const fmtShort = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
    return String(v);
  };

  return (
    <>
    <ToolbarPortal>
      <ToolbarGroup label={lang === "es" ? "Exportar" : "Export"}>
        <TBtn onClick={handleCSV} disabled={itemRows.length === 0}>
          <Download className="h-3.5 w-3.5" /> CSV
        </TBtn>
        <TBtn onClick={handlePDF} disabled={pdfGenerating}>
          <FileText className="h-3.5 w-3.5" />{" "}
          {pdfGenerating ? (lang === "es" ? "Generando…" : "Generating…") : "PDF"}
        </TBtn>
      </ToolbarGroup>
      <ToolbarSep />
      <TBtn onClick={() => setRefreshKey((k) => k + 1)}>
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        {lang === "es" ? "Actualizar" : "Refresh"}
      </TBtn>
      <TBtn onClick={handleShare}>
        <Link2 className="h-3.5 w-3.5" /> {lang === "es" ? "Compartir" : "Share"}
      </TBtn>
      <TBtn onClick={() => window.print()}>
        <Printer className="h-3.5 w-3.5" /> {lang === "es" ? "Imprimir" : "Print"}
      </TBtn>
    </ToolbarPortal>

    <div className="flex flex-col gap-6">
      {/* ── Top row: 4 Metric Cards ─────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={DollarSign}
          label={lang === "es" ? "Total Presupuesto" : "Total Budget"}
          amount={fmt(budgetTotal)}
          pct={`${itemRows.length} ${lang === "es" ? "partidas" : "items"}`}
          accent="#f97316"
        />
        <MetricCard
          icon={CheckCircle2}
          label={lang === "es" ? "Aprobado" : "Approved"}
          amount={fmt(approvedTotal)}
          pct={`${pctOf(approvedTotal)} ${lang === "es" ? "del total" : "of total"}`}
          accent="#22c55e"
        />
        <MetricCard
          icon={Clock}
          label={lang === "es" ? "En Revisión" : "Under Review"}
          amount={fmt(reviewTotal)}
          pct={`${pctOf(reviewTotal)} ${lang === "es" ? "del total" : "of total"}`}
          accent="#fbbf24"
        />
        <MetricCard
          icon={AlertCircle}
          label={lang === "es" ? "Pendiente" : "Pending"}
          amount={fmt(pendingTotal)}
          pct={`${pctOf(pendingTotal)} ${lang === "es" ? "del total" : "of total"}`}
          accent="#3b82f6"
        />
      </div>

      {/* ── Middle row: Bar Chart + Donut Chart ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[55fr_45fr] gap-6">
        {/* Bar chart: Budget by Chapter */}
        <ChartCard title={lang === "es" ? "Presupuesto por Capítulo" : "Budget by Chapter"}>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 20, right: 10, left: 10, bottom: 40 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fill: "var(--color-text-secondary)", fontSize: 10 }}
                  axisLine={{ stroke: "var(--color-border-tertiary)" }}
                  tickLine={false}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                  height={60}
                />
                <YAxis
                  tick={{ fill: "var(--color-text-secondary)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={fmtShort}
                />
                <Tooltip
                  content={<BarTooltipContent formatter={fmt} />}
                  cursor={{ fill: "rgba(249,115,22,0.08)" }}
                />
                <Bar dataKey="total" fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={48}>
                  <LabelList
                    dataKey="total"
                    position="top"
                    formatter={(v) => fmtShort(Number(v ?? 0))}
                    style={{ fill: "var(--color-text-secondary)", fontSize: 10, fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Donut chart: Budget Status */}
        <ChartCard title={lang === "es" ? "Estado del Presupuesto" : "Budget Status"}>
          <div className="flex flex-col items-center">
            <div style={{ width: 220, height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {donutData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                    <LabelList content={<DonutCenterLabel value={`${approvedPctTotal}%`} />} />
                  </Pie>
                  <Tooltip
                    content={<BarTooltipContent formatter={fmt} />}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="flex flex-col gap-2 mt-4 w-full">
              {donutData.map((entry, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-sm flex-shrink-0"
                      style={{ background: entry.color }}
                    />
                    <span className="text-xs font-dm-sans" style={{ color: "var(--color-text-primary)" }}>
                      {entry.name}
                    </span>
                  </div>
                  <span className="text-xs font-semibold font-dm-sans" style={{ color: "var(--color-text-secondary)" }}>
                    {fmt(entry.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>
      </div>

      {/* ── Bottom: Summary Table by Chapter ─────────────────────── */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "var(--color-background-secondary)",
          border: "1px solid var(--color-border-tertiary)",
        }}
      >
        <div className="px-5 py-4">
          <h3
            className="text-sm font-semibold font-dm-sans"
            style={{ color: "var(--color-text-primary)" }}
          >
            {lang === "es" ? "Resumen por Capítulo" : "Summary by Chapter"}
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderTop: "1px solid var(--color-border-tertiary)", borderBottom: "1px solid var(--color-border-tertiary)" }}>
                {[
                  "#",
                  lang === "es" ? "Capítulo" : "Chapter",
                  lang === "es" ? "Partidas" : "Items",
                  "Total",
                  lang === "es" ? "Aprobado" : "Approved",
                  lang === "es" ? "% Aprobado" : "% Approved",
                  lang === "es" ? "Estatus" : "Status",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider font-dm-sans whitespace-nowrap"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chapters.map((ch, i) => (
                <tr
                  key={ch.name}
                  className="transition-colors hover:bg-white/[0.02]"
                  style={{ borderBottom: "1px solid var(--color-border-tertiary)" }}
                >
                  <td
                    className="px-4 py-3 text-xs font-dm-sans"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    {i + 1}
                  </td>
                  <td
                    className="px-4 py-3 text-sm font-medium font-dm-sans"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {ch.name}
                  </td>
                  <td
                    className="px-4 py-3 text-sm font-dm-sans text-center"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    {ch.items}
                  </td>
                  <td
                    className="px-4 py-3 text-sm font-semibold font-dm-sans"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {fmt(ch.total)}
                  </td>
                  <td
                    className="px-4 py-3 text-sm font-dm-sans"
                    style={{ color: STATUS_COLORS.approved }}
                  >
                    {fmt(ch.approved)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="flex-1 h-1.5 rounded-full overflow-hidden"
                        style={{ background: "var(--color-border-tertiary)", maxWidth: 80 }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(ch.approvedPct, 100)}%`,
                            background: STATUS_COLORS.approved,
                          }}
                        />
                      </div>
                      <span
                        className="text-xs font-semibold font-dm-sans"
                        style={{ color: "var(--color-text-secondary)" }}
                      >
                        {ch.approvedPct.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium font-dm-sans"
                      style={{
                        background: `${STATUS_COLORS[ch.status]}20`,
                        color: STATUS_COLORS[ch.status],
                      }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: STATUS_COLORS[ch.status] }}
                      />
                      {statusLabel(ch.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Totals row */}
            <tfoot>
              <tr
                style={{
                  borderTop: "2px solid #f97316",
                }}
              >
                <td
                  className="px-4 py-3 text-xs font-bold font-dm-sans uppercase"
                  style={{ color: "#f97316" }}
                  colSpan={2}
                >
                  {lang === "es" ? "Total" : "Total"}
                </td>
                <td
                  className="px-4 py-3 text-sm font-bold font-dm-sans text-center"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {itemRows.length}
                </td>
                <td
                  className="px-4 py-3 text-sm font-bold font-dm-sans"
                  style={{ color: "#f97316" }}
                >
                  {fmt(budgetTotal)}
                </td>
                <td
                  className="px-4 py-3 text-sm font-bold font-dm-sans"
                  style={{ color: STATUS_COLORS.approved }}
                >
                  {fmt(approvedTotal)}
                </td>
                <td
                  className="px-4 py-3 text-sm font-bold font-dm-sans"
                  style={{ color: "#f97316" }}
                >
                  {approvedPctTotal}%
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
    </>
  );
}
