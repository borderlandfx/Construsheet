"use client";

import { useState, useEffect } from "react";
import { Download, Link2, FileText, Loader2, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/context/WorkspaceContext";
import { useToast } from "@/lib/context/ToastContext";
import type { BudgetRow, ApuItem, GanttTask, TakeoffItem, ApuLineItem } from "@/lib/types/database.types";
import type { Locale } from "@/lib/utils/i18n";

// ─── Design tokens ────────────────────────────────────────────────────────────

const CS = {
  surface: "var(--cs-surface)",
  border:  "var(--cs-border)",
  accent:  "var(--cs-accent)",
  text:    "var(--cs-text)",
  muted:   "var(--cs-muted)",
  bg:      "var(--cs-bg)",
} as const;

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-1 rounded-[10px] p-4"
      style={{
        border: `1px solid ${accent ? "rgba(249,115,22,0.3)" : CS.border}`,
        background: accent ? "rgba(249,115,22,0.05)" : "rgba(255,255,255,0.02)",
      }}
    >
      <p className="text-xs font-dm-sans" style={{ color: CS.muted }}>{label}</p>
      <p
        className="font-syne font-bold text-2xl"
        style={{ color: accent ? CS.accent : CS.text }}
      >
        {value}
      </p>
      {sub && <p className="text-xs font-dm-sans" style={{ color: CS.muted }}>{sub}</p>}
    </div>
  );
}

// ─── ReportsTab ───────────────────────────────────────────────────────────────

export default function ReportsTab() {
  const supabase = createClient();
  const { projectId, language, fmt } = useWorkspace();
  const { toast } = useToast();
  const lang = language as Locale;

  const [loading, setLoading]         = useState(true);
  const [refreshKey, setRefreshKey]   = useState(0);
  const [budgetRows, setBudgetRows]   = useState<BudgetRow[]>([]);
  const [apuItems, setApuItems]       = useState<ApuItem[]>([]);
  const [ganttTasks, setGanttTasks]   = useState<GanttTask[]>([]);
  const [takeoffItems, setTakeoffItems] = useState<TakeoffItem[]>([]);

  // ── Fetch all project data ─────────────────────────────────────────────────
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const [br, ai, gt, to] = await Promise.all([
        supabase.from("budget_rows").select("*").eq("project_id", projectId).order("sort_order"),
        supabase.from("apu_items").select("*").eq("project_id", projectId).order("created_at"),
        supabase.from("gantt_tasks").select("*").eq("project_id", projectId).order("sort_order"),
        supabase.from("takeoff_items").select("*").eq("project_id", projectId).order("sort_order"),
      ]);
      setBudgetRows((br.data as BudgetRow[]) ?? []);
      setApuItems((ai.data as ApuItem[]) ?? []);
      setGanttTasks((gt.data as GanttTask[]) ?? []);
      setTakeoffItems((to.data as TakeoffItem[]) ?? []);
      setLoading(false);
    }
    loadData();
  }, [projectId, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const budgetTotal    = budgetRows.reduce((s, r) => s + (r.total ?? r.quantity * r.unit_price), 0);
  const apuTotal       = apuItems.reduce((s, i) => s + i.selling_price, 0);
  const sections       = Array.from(new Set(budgetRows.map((r) => r.section)));
  const completedTasks = ganttTasks.filter((t) => t.status === "complete").length;
  const totalQty       = takeoffItems.reduce((s, i) => s + i.quantity, 0);

  // APU cost composition (materials / labor / equipment direct subtotals)
  const apuComposition = apuItems.reduce(
    (acc, item) => {
      const sumArr = (arr: ApuLineItem[]) => arr.reduce((t, r) => t + r.qty * r.unit_price, 0);
      return {
        mat: acc.mat + sumArr((item.materials as ApuLineItem[]) ?? []),
        lab: acc.lab + sumArr((item.labor     as ApuLineItem[]) ?? []),
        eqp: acc.eqp + sumArr((item.equipment as ApuLineItem[]) ?? []),
      };
    },
    { mat: 0, lab: 0, eqp: 0 }
  );
  const apuDirect = apuComposition.mat + apuComposition.lab + apuComposition.eqp;
  const apuHasComposition = apuDirect > 0;

  // Group takeoff items by unit for a compact unit summary
  const takeoffByUnit = takeoffItems.reduce<Map<string, { total: number; count: number }>>(
    (map, item) => {
      const u = (item.unit ?? "").trim() || (lang === "es" ? "(sin unidad)" : "(no unit)");
      const prev = map.get(u) ?? { total: 0, count: 0 };
      map.set(u, { total: prev.total + item.quantity, count: prev.count + 1 });
      return map;
    },
    new Map()
  );
  const takeoffUnitRows = Array.from(takeoffByUnit.entries()).sort((a, b) => b[1].total - a[1].total);

  // ── CSV export helpers ────────────────────────────────────────────────────
  function downloadCSV(rows: (string | number)[][], filename: string) {
    const csv = rows
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleBudgetCSV() {
    const headers = [
      lang === "es" ? "Sección" : "Section",
      lang === "es" ? "Código" : "Code",
      lang === "es" ? "Descripción" : "Description",
      lang === "es" ? "Unidad" : "Unit",
      lang === "es" ? "Cantidad" : "Quantity",
      lang === "es" ? "Precio Unit." : "Unit Price",
      lang === "es" ? "Total" : "Total",
      lang === "es" ? "Estatus" : "Status",
      lang === "es" ? "Responsable" : "Assignee",
    ];
    const rows = budgetRows.map((r) => [
      r.section,
      r.code ?? "",
      r.description,
      r.unit ?? "",
      r.quantity,
      r.unit_price,
      r.total ?? r.quantity * r.unit_price,
      r.status,
      r.assignee ?? "",
    ]);
    downloadCSV([headers, ...rows], `budget-${Date.now()}.csv`);
  }

  function handleApuCSV() {
    const headers = [
      lang === "es" ? "Código" : "Code",
      lang === "es" ? "Descripción" : "Description",
      lang === "es" ? "Unidad" : "Unit",
      lang === "es" ? "Costo Directo" : "Direct Cost",
      lang === "es" ? "GG %" : "OH %",
      lang === "es" ? "Utilidad %" : "Profit %",
      lang === "es" ? "Precio Venta" : "Selling Price",
    ];
    const rows = apuItems.map((item) => [
      item.code,
      item.description,
      item.unit,
      item.direct_cost.toFixed(2),
      item.overhead_pct.toFixed(2),
      item.profit_pct.toFixed(2),
      item.selling_price.toFixed(2),
    ]);
    downloadCSV([headers, ...rows], `apu-${Date.now()}.csv`);
  }

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

  // ── PDF print ─────────────────────────────────────────────────────────────
  function handlePDF() {
    const win = window.open("", "_blank", "width=960,height=720,menubar=yes");
    if (!win) return;

    const statusLabel = (s: string) =>
      lang === "es"
        ? ({ approved: "Aprobado", review: "En revisión", pending: "Pendiente" }[s] ?? s)
        : ({ approved: "Approved", review: "Under Review", pending: "Pending" }[s] ?? s);

    let rowNum = 0;
    const budgetHtml = sections.map((sec) => {
      const secRows = budgetRows.filter((r) => r.section === sec);
      const secTotal = secRows.reduce((s, r) => s + (r.total ?? r.quantity * r.unit_price), 0);
      const dataRows = secRows.map((row) => {
        rowNum++;
        const total = row.total ?? row.quantity * row.unit_price;
        return `<tr>
          <td style="text-align:center;color:#6b7280">${rowNum}</td>
          <td><code style="color:#f97316;font-size:10px">${row.code ?? ""}</code></td>
          <td>${row.description}</td>
          <td style="text-align:center;color:#6b7280">${row.unit ?? ""}</td>
          <td style="text-align:right">${row.quantity.toLocaleString()}</td>
          <td style="text-align:right">${fmt(row.unit_price)}</td>
          <td style="text-align:right;font-weight:600">${fmt(total)}</td>
          <td style="text-align:center;font-size:10px">${statusLabel(row.status)}</td>
        </tr>`;
      }).join("");
      return `<tr style="background:#fff7ed">
        <td colspan="8" style="padding:6px 8px;font-weight:700;font-size:10px;text-transform:uppercase;color:#c2410c;border-top:2px solid #fed7aa">
          <span>${sec}</span><span style="float:right">${fmt(secTotal)}</span>
        </td>
      </tr>${dataRows}`;
    }).join("");

    const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8"/>
  <title>${lang === "es" ? "Reporte del Proyecto" : "Project Report"} — ConstruSheet</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,-apple-system,sans-serif;font-size:11px;color:#111827;padding:24px}
    h1{font-size:20px;font-weight:700;margin-bottom:2px}
    h2{font-size:13px;font-weight:700;margin:16px 0 8px;color:#f97316;text-transform:uppercase;letter-spacing:.05em}
    .meta{font-size:10px;color:#6b7280;margin-bottom:12px}
    .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
    .stat{border:1px solid #e5e7eb;border-radius:8px;padding:10px}
    .stat-label{font-size:10px;color:#6b7280}
    .stat-value{font-size:18px;font-weight:700;color:#111827}
    .stat-value.accent{color:#f97316}
    table{width:100%;border-collapse:collapse;font-size:10.5px}
    th{background:#f97316;color:#fff;padding:5px 7px;text-align:left;font-size:9.5px;font-weight:600;text-transform:uppercase}
    th:nth-child(5),th:nth-child(6),th:nth-child(7){text-align:right}
    th:nth-child(4),th:nth-child(8){text-align:center}
    td{padding:4px 7px;border-bottom:1px solid #f3f4f6;vertical-align:middle}
    tr:nth-child(even) td{background:#f9fafb}
    .total-row td{background:#fff7ed!important;font-weight:700;border-top:2px solid #fed7aa}
    .footer{margin-top:16px;font-size:10px;color:#9ca3af;display:flex;justify-content:space-between}
    @media print{body{padding:12px}.footer{position:fixed;bottom:0;left:24px;right:24px}}
  </style>
</head>
<body>
  <h1>ConstruSheet — ${lang === "es" ? "Reporte del Proyecto" : "Project Report"}</h1>
  <div class="meta">${lang === "es" ? "Generado" : "Generated"}: ${new Date().toLocaleDateString(lang === "es" ? "es-MX" : "en-US", { year: "numeric", month: "long", day: "numeric" })}</div>

  <div class="stats">
    <div class="stat">
      <div class="stat-label">${lang === "es" ? "Presupuesto Total" : "Budget Total"}</div>
      <div class="stat-value accent">${fmt(budgetTotal)}</div>
    </div>
    <div class="stat">
      <div class="stat-label">${lang === "es" ? "Partidas" : "Budget Rows"}</div>
      <div class="stat-value">${budgetRows.length}</div>
    </div>
    <div class="stat">
      <div class="stat-label">${lang === "es" ? "APUs" : "APU Items"}</div>
      <div class="stat-value">${apuItems.length}</div>
    </div>
    <div class="stat">
      <div class="stat-label">${lang === "es" ? "Tareas completadas" : "Tasks completed"}</div>
      <div class="stat-value">${completedTasks} / ${ganttTasks.length}</div>
    </div>
  </div>

  ${budgetRows.length > 0 ? `
  <h2>${lang === "es" ? "Presupuesto de Obra" : "Construction Budget"}</h2>
  <table>
    <thead>
      <tr>
        <th style="width:28px">#</th>
        <th style="width:60px">${lang === "es" ? "Código" : "Code"}</th>
        <th>${lang === "es" ? "Descripción" : "Description"}</th>
        <th style="width:45px">${lang === "es" ? "Unid." : "Unit"}</th>
        <th style="width:60px">${lang === "es" ? "Cant." : "Qty"}</th>
        <th style="width:80px">${lang === "es" ? "P.U." : "Unit Price"}</th>
        <th style="width:80px">${lang === "es" ? "Total" : "Total"}</th>
        <th style="width:75px">${lang === "es" ? "Estatus" : "Status"}</th>
      </tr>
    </thead>
    <tbody>${budgetHtml}</tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="6" style="text-align:right;font-size:10px;color:#92400e;text-transform:uppercase">
          ${lang === "es" ? "Total del Presupuesto" : "Budget Total"}
        </td>
        <td style="text-align:right;font-size:13px;color:#f97316">${fmt(budgetTotal)}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>` : ""}

  ${apuItems.length > 0 ? (() => {
    const apuRows = apuItems.map((item, i) => `<tr>
      <td style="text-align:center;color:#6b7280">${i + 1}</td>
      <td><code style="font-family:monospace;color:#f97316;font-size:10px">${item.code}</code></td>
      <td>${item.description}</td>
      <td style="text-align:center;color:#6b7280">${item.unit}</td>
      <td style="text-align:right">${fmt(item.direct_cost)}</td>
      <td style="text-align:right;color:#6b7280">${item.overhead_pct}% + ${item.profit_pct}%</td>
      <td style="text-align:right;font-weight:600;color:#f97316">${fmt(item.selling_price)}</td>
    </tr>`).join("");
    return `<h2 style="margin-top:20px">${lang === "es" ? "Análisis de Precio Unitario (APU)" : "Unit Price Analysis (APU)"}</h2>
    <table>
      <thead><tr>
        <th style="width:28px">#</th>
        <th style="width:70px">${lang === "es" ? "Código" : "Code"}</th>
        <th>${lang === "es" ? "Descripción" : "Description"}</th>
        <th style="width:50px;text-align:center">${lang === "es" ? "Unid." : "Unit"}</th>
        <th style="width:85px;text-align:right">${lang === "es" ? "Costo Dir." : "Direct Cost"}</th>
        <th style="width:90px;text-align:right">${lang === "es" ? "GI% + Util%" : "OH% + Profit%"}</th>
        <th style="width:85px;text-align:right">${lang === "es" ? "Precio Unit." : "Unit Price"}</th>
      </tr></thead>
      <tbody>${apuRows}</tbody>
      <tfoot><tr class="total-row">
        <td colspan="6" style="text-align:right;font-size:10px;color:#92400e;text-transform:uppercase">${lang === "es" ? "Total P.V." : "Total Selling"}</td>
        <td style="text-align:right;font-size:13px;color:#f97316">${fmt(apuItems.reduce((s, i) => s + i.selling_price, 0))}</td>
      </tr></tfoot>
    </table>`;
  })() : ""}

  ${ganttTasks.length > 0 ? (() => {
    const taskRows = ganttTasks.map((task, i) => {
      const statusLbl = lang === "es"
        ? ({ complete: "Completo", "in-progress": "En curso", pending: "Pendiente" }[task.status] ?? task.status)
        : ({ complete: "Complete", "in-progress": "In progress", pending: "Pending" }[task.status] ?? task.status);
      const pct = task.progress_pct ?? 0;
      const bar = `<div style="background:#e5e7eb;border-radius:4px;height:5px;width:60px;display:inline-block;vertical-align:middle"><div style="background:${task.color ?? "#f97316"};height:5px;border-radius:4px;width:${pct}%"></div></div> ${pct}%`;
      return `<tr>
        <td style="text-align:center;color:#6b7280">${i + 1}</td>
        <td style="font-weight:500">${task.name}</td>
        <td style="color:#6b7280">${task.assignee ?? "—"}</td>
        <td style="text-align:center">${task.start_week}</td>
        <td style="text-align:center">${task.duration_weeks}w</td>
        <td>${bar}</td>
        <td style="text-align:center;font-size:10px;color:#6b7280">${statusLbl}</td>
      </tr>`;
    }).join("");
    const avgPct = Math.round(ganttTasks.reduce((s, t) => s + (t.progress_pct ?? 0), 0) / ganttTasks.length);
    return `<h2 style="margin-top:20px">${lang === "es" ? "Cronograma de Obra" : "Project Schedule"}</h2>
    <table>
      <thead><tr>
        <th style="width:28px">#</th>
        <th>${lang === "es" ? "Tarea" : "Task"}</th>
        <th style="width:90px">${lang === "es" ? "Responsable" : "Assignee"}</th>
        <th style="width:55px;text-align:center">${lang === "es" ? "S. inicio" : "Start wk"}</th>
        <th style="width:55px;text-align:center">${lang === "es" ? "Duración" : "Duration"}</th>
        <th style="width:110px">${lang === "es" ? "Avance" : "Progress"}</th>
        <th style="width:80px;text-align:center">${lang === "es" ? "Estatus" : "Status"}</th>
      </tr></thead>
      <tbody>${taskRows}</tbody>
      <tfoot><tr class="total-row">
        <td colspan="5" style="text-align:right;font-size:10px;color:#92400e;text-transform:uppercase">${lang === "es" ? "Avance promedio" : "Avg. progress"}</td>
        <td style="font-size:13px;font-weight:700;color:#f97316">${avgPct}%</td>
        <td></td>
      </tr></tfoot>
    </table>`;
  })() : ""}

  ${takeoffItems.length > 0 ? (() => {
    const toRows = takeoffItems.map((item, i) => `<tr>
      <td style="text-align:center;color:#6b7280">${i + 1}</td>
      <td style="font-weight:500">${item.element}</td>
      <td style="color:#6b7280">${item.description ?? ""}</td>
      <td style="text-align:center;color:#6b7280">${item.unit ?? ""}</td>
      <td style="text-align:right;font-weight:600">${item.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
      <td style="color:#6b7280;font-size:10px">${item.notes ?? ""}</td>
    </tr>`).join("");
    return `<h2 style="margin-top:20px">${lang === "es" ? "Cubicación / Generadores de Cantidad" : "Quantity Takeoff"}</h2>
    <table>
      <thead><tr>
        <th style="width:28px">#</th>
        <th style="width:130px">${lang === "es" ? "Elemento" : "Element"}</th>
        <th>${lang === "es" ? "Descripción" : "Description"}</th>
        <th style="width:50px;text-align:center">${lang === "es" ? "Unid." : "Unit"}</th>
        <th style="width:80px;text-align:right">${lang === "es" ? "Cantidad" : "Quantity"}</th>
        <th style="width:110px">${lang === "es" ? "Notas" : "Notes"}</th>
      </tr></thead>
      <tbody>${toRows}</tbody>
      <tfoot><tr class="total-row">
        <td colspan="4" style="text-align:right;font-size:10px;color:#92400e;text-transform:uppercase">${lang === "es" ? "Cant. total" : "Total qty"}</td>
        <td style="text-align:right;font-size:13px;color:#f97316">${takeoffItems.reduce((s, i) => s + i.quantity, 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
        <td></td>
      </tr></tfoot>
    </table>`;
  })() : ""}

  <div class="footer"><span>ConstruSheet</span><span>${new Date().toISOString().slice(0, 10)}</span></div>
  <script>setTimeout(()=>{window.print();},400)<\/script>
</body>
</html>`;
    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: CS.muted }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-syne font-bold text-lg" style={{ color: CS.text }}>
            {lang === "es" ? "Reportes del Proyecto" : "Project Reports"}
          </h2>
          <p className="text-xs font-dm-sans mt-0.5" style={{ color: CS.muted }}>
            {lang === "es" ? "Resumen y exportaciones" : "Summary and exports"}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Refresh */}
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
            title={lang === "es" ? "Actualizar datos" : "Refresh data"}
            className="flex items-center justify-center rounded-[10px]"
            style={{
              width: 36, height: 36,
              border: `1px solid ${CS.border}`,
              background: "transparent",
              color: CS.muted,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.5 : 1,
            }}
            onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLButtonElement).style.color = CS.text; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = CS.muted; }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          </button>

          {/* Share */}
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-sm font-medium font-dm-sans"
            style={{ border: `1px solid ${CS.border}`, background: "transparent", color: CS.muted, cursor: "pointer" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = CS.text)}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = CS.muted)}
          >
            <Link2 className="h-4 w-4" aria-hidden="true" />
            {lang === "es" ? "Compartir" : "Share"}
          </button>

          {/* Budget CSV */}
          <button
            type="button"
            onClick={handleBudgetCSV}
            disabled={budgetRows.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-sm font-medium font-dm-sans"
            title={lang === "es" ? "Exportar presupuesto CSV" : "Export budget CSV"}
            style={{
              border: `1px solid ${CS.border}`,
              background: "transparent",
              color: budgetRows.length === 0 ? CS.muted : CS.text,
              cursor: budgetRows.length === 0 ? "not-allowed" : "pointer",
              opacity: budgetRows.length === 0 ? 0.45 : 1,
            }}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {lang === "es" ? "Ppto." : "Budget"}
          </button>

          {/* APU CSV */}
          <button
            type="button"
            onClick={handleApuCSV}
            disabled={apuItems.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-sm font-medium font-dm-sans"
            title={lang === "es" ? "Exportar APUs CSV" : "Export APU CSV"}
            style={{
              border: `1px solid ${CS.border}`,
              background: "transparent",
              color: apuItems.length === 0 ? CS.muted : CS.text,
              cursor: apuItems.length === 0 ? "not-allowed" : "pointer",
              opacity: apuItems.length === 0 ? 0.45 : 1,
            }}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            APU
          </button>

          {/* PDF */}
          <button
            type="button"
            onClick={handlePDF}
            className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-sm font-semibold font-dm-sans"
            style={{ background: CS.accent, color: "#fff", border: "none", cursor: "pointer" }}
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            {lang === "es" ? "Reporte PDF" : "PDF Report"}
          </button>
        </div>
      </div>

      {/* ── Summary stats ────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label={lang === "es" ? "Total presupuesto" : "Budget total"}
          value={fmt(budgetTotal)}
          sub={`${budgetRows.length} ${lang === "es" ? "partidas" : "rows"}`}
          accent
        />
        <StatCard
          label={lang === "es" ? "Secciones" : "Sections"}
          value={String(sections.length)}
          sub={lang === "es" ? "en el presupuesto" : "in budget"}
        />
        <StatCard
          label={lang === "es" ? "Análisis APU" : "APU analyses"}
          value={String(apuItems.length)}
          sub={`${lang === "es" ? "Total P.V." : "Total S.P."}: ${fmt(apuTotal)}`}
        />
        <StatCard
          label={lang === "es" ? "Avance cronograma" : "Schedule progress"}
          value={ganttTasks.length > 0 ? `${Math.round((completedTasks / ganttTasks.length) * 100)}%` : "—"}
          sub={`${completedTasks} / ${ganttTasks.length} ${lang === "es" ? "completas" : "complete"}`}
        />
        {takeoffItems.length > 0 && (
          <StatCard
            label={lang === "es" ? "Cubicación" : "Takeoff"}
            value={String(takeoffItems.length)}
            sub={`${lang === "es" ? "Cant. total" : "Total qty"}: ${totalQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
          />
        )}
      </div>

      {/* ── Budget by section ────────────────────────────────── */}
      {sections.length > 0 && (
        <div
          className="rounded-[10px] overflow-hidden"
          style={{ border: `1px solid ${CS.border}` }}
        >
          <div
            className="px-4 py-3"
            style={{ borderBottom: `1px solid ${CS.border}`, background: "rgba(255,255,255,0.02)" }}
          >
            <span className="font-syne font-bold text-sm" style={{ color: CS.text }}>
              {lang === "es" ? "Presupuesto por sección" : "Budget by section"}
            </span>
          </div>
          {sections.map((sec) => {
            const secRows = budgetRows.filter((r) => r.section === sec);
            const secTotal = secRows.reduce((s, r) => s + (r.total ?? r.quantity * r.unit_price), 0);
            const pct = budgetTotal > 0 ? (secTotal / budgetTotal) * 100 : 0;
            return (
              <div
                key={sec}
                className="flex items-center gap-4 px-4 py-3"
                style={{ borderBottom: `1px solid ${CS.border}` }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-dm-sans font-medium truncate" style={{ color: CS.text }}>{sec}</p>
                  <div
                    className="mt-1.5 rounded-full overflow-hidden"
                    style={{ height: 4, background: CS.border }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: CS.accent, transition: "width 0.3s ease" }}
                    />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold font-dm-sans" style={{ color: CS.text }}>{fmt(secTotal)}</p>
                  <p className="text-xs font-dm-sans" style={{ color: CS.muted }}>{pct.toFixed(1)}%</p>
                </div>
              </div>
            );
          })}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ background: "rgba(249,115,22,0.04)" }}
          >
            <span className="text-sm font-dm-sans font-medium" style={{ color: CS.muted }}>
              {lang === "es" ? "Total" : "Total"}
            </span>
            <span className="font-syne font-bold text-lg" style={{ color: CS.accent }}>
              {fmt(budgetTotal)}
            </span>
          </div>
        </div>
      )}

      {/* ── APU cost composition ─────────────────────────────── */}
      {apuItems.length > 0 && apuHasComposition && (
        <div
          className="rounded-[10px] overflow-hidden"
          style={{ border: `1px solid ${CS.border}` }}
        >
          <div
            className="px-4 py-3"
            style={{ borderBottom: `1px solid ${CS.border}`, background: "rgba(255,255,255,0.02)" }}
          >
            <span className="font-syne font-bold text-sm" style={{ color: CS.text }}>
              {lang === "es" ? "Composición de costos directos (APU)" : "Direct cost composition (APU)"}
            </span>
          </div>

          {/* Segmented bar */}
          <div className="px-4 pt-4 pb-2">
            <div className="flex rounded-full overflow-hidden" style={{ height: 10, gap: 2 }}>
              {apuDirect > 0 && [
                { val: apuComposition.mat, color: "#3b82f6" },
                { val: apuComposition.lab, color: "#22c55e" },
                { val: apuComposition.eqp, color: "#f97316" },
              ].map(({ val, color }, idx) => {
                const pct = (val / apuDirect) * 100;
                return pct > 0 ? (
                  <div
                    key={idx}
                    style={{
                      width: `${pct}%`,
                      background: color,
                      borderRadius: 9999,
                      transition: "width 0.4s ease",
                    }}
                  />
                ) : null;
              })}
            </div>
          </div>

          {/* Row labels */}
          {(
            [
              {
                label: lang === "es" ? "Materiales"   : "Materials",
                val: apuComposition.mat, color: "#3b82f6",
              },
              {
                label: lang === "es" ? "Mano de obra" : "Labor",
                val: apuComposition.lab, color: "#22c55e",
              },
              {
                label: lang === "es" ? "Equipos"      : "Equipment",
                val: apuComposition.eqp, color: "#f97316",
              },
            ] as { label: string; val: number; color: string }[]
          ).map(({ label, val, color }) => {
            const pct = apuDirect > 0 ? (val / apuDirect) * 100 : 0;
            return (
              <div
                key={label}
                className="flex items-center gap-4 px-4 py-2.5"
                style={{ borderBottom: `1px solid ${CS.border}` }}
              >
                <span
                  className="shrink-0 rounded-full"
                  style={{ width: 8, height: 8, background: color, display: "inline-block" }}
                />
                <span className="flex-1 text-sm font-dm-sans" style={{ color: CS.text }}>{label}</span>
                <span className="text-sm font-dm-sans" style={{ color: CS.muted }}>
                  {pct.toFixed(1)}%
                </span>
                <span className="text-sm font-semibold font-dm-sans" style={{ color: CS.text }}>
                  {fmt(val)}
                </span>
              </div>
            );
          })}

          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            <span className="text-sm font-dm-sans font-medium" style={{ color: CS.muted }}>
              {lang === "es" ? "Costo directo total APU" : "Total APU direct cost"}
            </span>
            <span className="font-syne font-bold text-lg" style={{ color: CS.accent }}>
              {fmt(apuDirect)}
            </span>
          </div>
        </div>
      )}

      {/* ── Gantt tasks breakdown ────────────────────────────── */}
      {ganttTasks.length > 0 && (
        <div
          className="rounded-[10px] overflow-hidden"
          style={{ border: `1px solid ${CS.border}` }}
        >
          <div
            className="px-4 py-3"
            style={{ borderBottom: `1px solid ${CS.border}`, background: "rgba(255,255,255,0.02)" }}
          >
            <span className="font-syne font-bold text-sm" style={{ color: CS.text }}>
              {lang === "es" ? "Avance del cronograma" : "Schedule progress"}
            </span>
          </div>
          {ganttTasks.map((task) => {
            const pct = task.progress_pct ?? 0;
            const statusColors: Record<string, string> = {
              complete: "#14b8a6",
              "in-progress": "#f97316",
              pending: "#6b7280",
            };
            const barColor = statusColors[task.status] ?? "#6b7280";
            return (
              <div
                key={task.id}
                className="flex items-center gap-4 px-4 py-3"
                style={{ borderBottom: `1px solid ${CS.border}` }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <p className="text-sm font-dm-sans font-medium truncate" style={{ color: CS.text }}>{task.name}</p>
                    {task.assignee && (
                      <span className="text-xs font-dm-sans shrink-0 hidden sm:block" style={{ color: CS.muted }}>
                        · {task.assignee}
                      </span>
                    )}
                  </div>
                  <div
                    className="rounded-full overflow-hidden"
                    style={{ height: 5, background: CS.border }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: barColor, transition: "width 0.3s ease" }}
                    />
                  </div>
                </div>
                <div className="text-right shrink-0" style={{ minWidth: 72 }}>
                  <p className="text-sm font-semibold font-dm-sans" style={{ color: pct === 100 ? "#14b8a6" : CS.text }}>
                    {pct}%
                  </p>
                  <p className="text-xs font-dm-sans" style={{ color: CS.muted }}>
                    {lang === "es"
                      ? ({ complete: "Completo", "in-progress": "En curso", pending: "Pendiente" }[task.status] ?? task.status)
                      : ({ complete: "Complete", "in-progress": "In progress", pending: "Pending" }[task.status] ?? task.status)}
                  </p>
                </div>
              </div>
            );
          })}
          {/* Overall progress row */}
          {ganttTasks.length > 0 && (
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              <span className="text-sm font-dm-sans font-medium" style={{ color: CS.muted }}>
                {lang === "es" ? "Avance promedio" : "Avg. progress"}
              </span>
              <span className="font-syne font-bold text-lg" style={{ color: CS.accent }}>
                {Math.round(ganttTasks.reduce((s, t) => s + (t.progress_pct ?? 0), 0) / ganttTasks.length)}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Takeoff summary ──────────────────────────────────── */}
      {takeoffItems.length > 0 && (
        <div
          className="rounded-[10px] overflow-hidden"
          style={{ border: `1px solid ${CS.border}` }}
        >
          <div
            className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: `1px solid ${CS.border}`, background: "rgba(255,255,255,0.02)" }}
          >
            <span className="font-syne font-bold text-sm" style={{ color: CS.text }}>
              {lang === "es" ? "Generadores de cantidad" : "Quantity takeoff"}
            </span>
            <span className="text-xs font-dm-sans" style={{ color: CS.muted }}>
              {takeoffItems.length} {lang === "es" ? "elementos" : "elements"}
            </span>
          </div>
          {/* Unit summary rows */}
          {takeoffUnitRows.map(([unit, { total, count }]) => (
            <div
              key={unit}
              className="flex items-center gap-4 px-4 py-2.5"
              style={{ borderBottom: `1px solid ${CS.border}` }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-dm-sans font-medium" style={{ color: CS.text }}>{unit}</p>
                <p className="text-xs font-dm-sans mt-0.5" style={{ color: CS.muted }}>
                  {count} {lang === "es" ? "elemento(s)" : "element(s)"}
                </p>
              </div>
              <span className="font-syne font-bold text-base shrink-0" style={{ color: CS.accent }}>
                {total.toLocaleString(undefined, { maximumFractionDigits: 3 })}
              </span>
            </div>
          ))}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ background: "rgba(249,115,22,0.03)" }}
          >
            <span className="text-sm font-dm-sans font-medium" style={{ color: CS.muted }}>
              {lang === "es" ? "Cantidad total registrada" : "Total qty on record"}
            </span>
            <span className="font-syne font-bold text-lg" style={{ color: CS.accent }}>
              {totalQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────── */}
      {budgetRows.length === 0 && apuItems.length === 0 && ganttTasks.length === 0 && takeoffItems.length === 0 && (
        <div
          className="flex flex-col items-center justify-center py-16 rounded-[10px] text-center gap-3"
          style={{ border: `1.5px dashed ${CS.border}` }}
        >
          <p className="font-syne font-bold text-base" style={{ color: CS.text }}>
            {lang === "es" ? "Sin datos para reportar" : "No data to report yet"}
          </p>
          <p className="text-sm font-dm-sans max-w-xs" style={{ color: CS.muted }}>
            {lang === "es"
              ? "Agrega partidas, APUs o tareas en las pestañas correspondientes para ver el resumen aquí."
              : "Add budget rows, APUs, or tasks in their respective tabs to see a summary here."}
          </p>
        </div>
      )}
    </div>
  );
}
