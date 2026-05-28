"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Loader2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/context/WorkspaceContext";
import type { BudgetRow, ApuItem, GanttTask, Project } from "@/lib/types/database.types";
import type { Locale } from "@/lib/utils/i18n";

// ─── Status colors ───────────────────────────────────────────────────────────

const STATUS_COLORS = {
  approved: "#22c55e",
  "in-review": "#fbbf24",
  pending: "#3b82f6",
} as const;

const STATUS_LABELS: Record<string, Record<Locale, string>> = {
  active:    { es: "Activo",     en: "Active" },
  completed: { es: "Completado", en: "Completed" },
  archived:  { es: "Archivado",  en: "Archived" },
};

// ─── Executive Summary ──────────────────────────────────────────────────────

export default function ExecutiveSummary() {
  const supabaseRef = useRef(createClient());
  const { projectId, language, fmt, currency } = useWorkspace();
  const lang = language as Locale;

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [budgetRows, setBudgetRows] = useState<BudgetRow[]>([]);
  const [apuItems, setApuItems] = useState<ApuItem[]>([]);
  const [ganttTasks, setGanttTasks] = useState<GanttTask[]>([]);

  // ── Fetch all data ───────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const sb = supabaseRef.current;
      const [pRes, bRes, aRes, gRes] = await Promise.all([
        sb.from("projects").select("*").eq("id", projectId).single(),
        sb.from("budget_rows").select("*").eq("project_id", projectId).order("sort_order"),
        sb.from("apu_items").select("*").eq("project_id", projectId),
        sb.from("gantt_tasks").select("*").eq("project_id", projectId).order("sort_order"),
      ]);
      if (cancelled) return;
      setProject((pRes.data as Project) ?? null);
      setBudgetRows((bRes.data as BudgetRow[]) ?? []);
      setApuItems((aRes.data as ApuItem[]) ?? []);
      setGanttTasks((gRes.data as GanttTask[]) ?? []);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [projectId]);

  // ── Derived budget data ────────────────────────────────────────────────
  const itemRows = useMemo(() => budgetRows.filter((r) => !r.is_chapter), [budgetRows]);
  const rowTotal = (r: BudgetRow) => r.total ?? r.quantity * r.unit_price;
  const budgetTotal = useMemo(() => itemRows.reduce((s, r) => s + rowTotal(r), 0), [itemRows]);
  const approvedTotal = useMemo(() => itemRows.filter((r) => r.status === "approved").reduce((s, r) => s + rowTotal(r), 0), [itemRows]);
  const reviewTotal = useMemo(() => itemRows.filter((r) => r.status === "in-review").reduce((s, r) => s + rowTotal(r), 0), [itemRows]);
  const pendingTotal = useMemo(() => itemRows.filter((r) => r.status === "pending").reduce((s, r) => s + rowTotal(r), 0), [itemRows]);
  const approvedPct = budgetTotal > 0 ? ((approvedTotal / budgetTotal) * 100) : 0;

  // ── Chapters ─────────────────────────────────────────────────────────────
  const chapters = useMemo(() => {
    const sectionNames = Array.from(new Set(itemRows.map((r) => r.section)));
    return sectionNames.map((sec) => {
      const rows = itemRows.filter((r) => r.section === sec);
      const total = rows.reduce((s, r) => s + rowTotal(r), 0);
      const approved = rows.filter((r) => r.status === "approved").reduce((s, r) => s + rowTotal(r), 0);
      const pct = total > 0 ? (approved / total) * 100 : 0;
      let status: "approved" | "in-review" | "pending" = "pending";
      if (rows.every((r) => r.status === "approved")) status = "approved";
      else if (rows.some((r) => r.status === "approved" || r.status === "in-review")) status = "in-review";
      return { name: sec, items: rows.length, total, approved, pct, status };
    });
  }, [itemRows]);

  // ── Bar chart data ───────────────────────────────────────────────────────
  const barData = useMemo(
    () => chapters.map((ch) => ({
      name: ch.name.length > 22 ? ch.name.slice(0, 20) + "…" : ch.name,
      total: ch.total,
    })),
    [chapters]
  );

  // ── APU summary ──────────────────────────────────────────────────────────
  const apuSummary = useMemo(() => {
    const categories = Array.from(new Set(apuItems.filter((a) => a.category).map((a) => a.category!)));
    const prices = apuItems.map((a) => a.selling_price).filter((p) => p > 0);
    const avgPrice = prices.length > 0 ? prices.reduce((s, p) => s + p, 0) / prices.length : 0;
    const mostExpensive = apuItems.length > 0 ? apuItems.reduce((a, b) => a.selling_price > b.selling_price ? a : b) : null;
    return { total: apuItems.length, categories, avgPrice, mostExpensive };
  }, [apuItems]);

  // ── Gantt summary ────────────────────────────────────────────────────────
  const ganttSummary = useMemo(() => {
    const chapterTasks = ganttTasks.filter((t) => t.is_chapter);
    const allTasks = ganttTasks.filter((t) => !t.is_chapter);
    const maxWeek = ganttTasks.reduce((m, t) => Math.max(m, t.start_week + t.duration_weeks), 0);
    const pending = allTasks.filter((t) => t.status === "pending").length;
    const inProgress = allTasks.filter((t) => t.status === "in-review").length;
    const complete = allTasks.filter((t) => t.status === "approved").length;
    return { chapters: chapterTasks.length, weeks: maxWeek, pending, inProgress, complete };
  }, [ganttTasks]);

  // ── Date formatters ──────────────────────────────────────────────────────
  const now = new Date();
  const dateStr = now.toLocaleDateString(lang === "es" ? "es-MX" : "en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
  const timeStr = now.toLocaleTimeString(lang === "es" ? "es-MX" : "en-US", {
    hour: "2-digit", minute: "2-digit",
  });

  const fmtShort = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
    return String(Math.round(v));
  };

  // ── Status label for chapter table ───────────────────────────────────────
  const statusLabel = (s: string) => {
    if (s === "approved") return lang === "es" ? "Aprobado" : "Approved";
    if (s === "in-review") return lang === "es" ? "En Revisión" : "Under Review";
    return lang === "es" ? "Pendiente" : "Pending";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#6b7280" }} />
      </div>
    );
  }

  return (
    <div
      id="executive-summary-report"
      className="executive-summary-report"
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
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", margin: 0, letterSpacing: "-0.01em", textTransform: "uppercase" }}>
          {lang === "es" ? "Resumen Ejecutivo de Obra" : "Project Executive Summary"}
        </h1>
      </div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: "0 0 8px 0" }}>
          {project?.name ?? "—"}
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: "#6b7280", flexWrap: "wrap" }}>
          {project?.location && <span>{project.location}</span>}
          {project?.status && (
            <span
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                background: project.status === "active" ? "#dcfce7" : project.status === "completed" ? "#ccfbf1" : "#f3f4f6",
                color: project.status === "active" ? "#16a34a" : project.status === "completed" ? "#0d9488" : "#6b7280",
                padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600,
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }} />
              {STATUS_LABELS[project.status]?.[lang] ?? project.status}
            </span>
          )}
          <span style={{ fontWeight: 600 }}>{currency}</span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          2. KEY METRICS ROW
          ═══════════════════════════════════════════════════════════════ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
        {[
          {
            label: lang === "es" ? "Total Presupuesto" : "Total Budget",
            value: fmt(budgetTotal),
            accent: "#f97316",
          },
          {
            label: lang === "es" ? "Monto Aprobado" : "Approved Amount",
            value: fmt(approvedTotal),
            accent: "#22c55e",
          },
          {
            label: lang === "es" ? "En Revisión" : "Under Review",
            value: fmt(reviewTotal),
            accent: "#f59e0b",
          },
          {
            label: lang === "es" ? "Pendiente" : "Pending",
            value: fmt(pendingTotal),
            accent: "#3b82f6",
          },
        ].map((card) => (
          <div
            key={card.label}
            style={{
              border: `1px solid ${card.accent}30`,
              borderRadius: 8,
              padding: "14px 16px",
              background: `${card.accent}06`,
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
              {card.label}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          3. APPROVAL PROGRESS BAR
          ═══════════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
            {lang === "es" ? "Avance de Aprobación" : "Approval Progress"}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#22c55e" }}>
            {approvedPct.toFixed(1)}%
          </span>
        </div>
        <div style={{ position: "relative", height: 12, background: "#e5e7eb", borderRadius: 6, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${Math.min(approvedPct, 100)}%`,
              background: "linear-gradient(90deg, #22c55e, #16a34a)",
              borderRadius: 6,
              transition: "width 0.5s ease",
            }}
          />
          {/* Milestone markers */}
          {[25, 50, 75].map((m) => (
            <div
              key={m}
              style={{
                position: "absolute",
                left: `${m}%`,
                top: 0,
                bottom: 0,
                width: 1,
                background: "rgba(255,255,255,0.6)",
              }}
            />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 9, color: "#9ca3af" }}>
          <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          4. BUDGET BY CHAPTER TABLE
          ═══════════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", marginBottom: 12 }}>
          {lang === "es" ? "Presupuesto por Capítulo" : "Budget by Chapter"}
        </h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#f97316", color: "#fff" }}>
              {[
                "#",
                lang === "es" ? "Capítulo" : "Chapter",
                lang === "es" ? "Partidas" : "Items",
                lang === "es" ? "Presupuesto" : "Budget",
                lang === "es" ? "Aprobado" : "Approved",
                lang === "es" ? "% Aprobado" : "% Approved",
                lang === "es" ? "Estatus" : "Status",
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "8px 10px",
                    textAlign: h === "#" || h === "Partidas" || h === "Items" ? "center" : "left",
                    fontWeight: 700,
                    fontSize: 11,
                    whiteSpace: "nowrap",
                  }}
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
                style={{ background: i % 2 === 0 ? "#ffffff" : "#f9fafb", borderBottom: "1px solid #f3f4f6" }}
              >
                <td style={{ padding: "8px 10px", textAlign: "center", color: "#6b7280" }}>{i + 1}</td>
                <td style={{ padding: "8px 10px", fontWeight: 600, color: "#1e293b" }}>{ch.name}</td>
                <td style={{ padding: "8px 10px", textAlign: "center", color: "#6b7280" }}>{ch.items}</td>
                <td style={{ padding: "8px 10px", fontWeight: 600, color: "#1e293b" }}>{fmt(ch.total)}</td>
                <td style={{ padding: "8px 10px", color: "#22c55e" }}>{fmt(ch.approved)}</td>
                <td style={{ padding: "8px 10px", color: "#6b7280" }}>{ch.pct.toFixed(1)}%</td>
                <td style={{ padding: "8px 10px" }}>
                  <span
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      background: `${STATUS_COLORS[ch.status]}20`,
                      color: STATUS_COLORS[ch.status],
                      padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 600,
                    }}
                  >
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }} />
                    {statusLabel(ch.status)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: "#fff7ed", borderTop: "2px solid #f97316" }}>
              <td style={{ padding: "8px 10px", fontWeight: 800, color: "#f97316" }} colSpan={2}>
                Total
              </td>
              <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 700, color: "#1e293b" }}>
                {itemRows.length}
              </td>
              <td style={{ padding: "8px 10px", fontWeight: 800, color: "#f97316" }}>
                {fmt(budgetTotal)}
              </td>
              <td style={{ padding: "8px 10px", fontWeight: 700, color: "#22c55e" }}>
                {fmt(approvedTotal)}
              </td>
              <td style={{ padding: "8px 10px", fontWeight: 700, color: "#f97316" }}>
                {approvedPct.toFixed(1)}%
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          5. BUDGET DISTRIBUTION CHART
          ═══════════════════════════════════════════════════════════════ */}
      {barData.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", marginBottom: 12 }}>
            {lang === "es" ? "Distribución del Presupuesto" : "Budget Distribution"}
          </h3>
          <div style={{ height: Math.max(barData.length * 38 + 20, 120) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barData}
                layout="vertical"
                margin={{ top: 4, right: 60, left: 10, bottom: 4 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={160}
                  tick={{ fill: "#4b5563", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Bar dataKey="total" fill="#f97316" radius={[0, 4, 4, 0]} barSize={20}>
                  <LabelList
                    dataKey="total"
                    position="right"
                    formatter={(v) => fmtShort(Number(v ?? 0))}
                    style={{ fill: "#6b7280", fontSize: 10, fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          6. APU SUMMARY
          ═══════════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: 28, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", marginBottom: 12 }}>
            {lang === "es" ? "Resumen APU" : "APU Summary"}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#6b7280" }}>{lang === "es" ? "Total APUs creados" : "Total APUs created"}</span>
              <span style={{ fontWeight: 700, color: "#1e293b" }}>{apuSummary.total}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#6b7280" }}>{lang === "es" ? "Precio unitario promedio" : "Average unit price"}</span>
              <span style={{ fontWeight: 700, color: "#1e293b" }}>{fmt(apuSummary.avgPrice)}</span>
            </div>
            {apuSummary.mostExpensive && (
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ color: "#6b7280" }}>{lang === "es" ? "APU más costoso" : "Most expensive APU"}</span>
                <span style={{ fontWeight: 700, color: "#1e293b", textAlign: "right", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {fmt(apuSummary.mostExpensive.selling_price)}
                </span>
              </div>
            )}
            {apuSummary.mostExpensive && (
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: -4 }}>
                {apuSummary.mostExpensive.description.length > 50
                  ? apuSummary.mostExpensive.description.slice(0, 48) + "…"
                  : apuSummary.mostExpensive.description}
              </div>
            )}
            {apuSummary.categories.length > 0 && (
              <div style={{ marginTop: 4 }}>
                <span style={{ color: "#6b7280", fontSize: 11 }}>{lang === "es" ? "Categorías" : "Categories"}:</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                  {apuSummary.categories.map((cat) => (
                    <span
                      key={cat}
                      style={{
                        background: "#f3f4f6", color: "#4b5563",
                        padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 500,
                      }}
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            7. SCHEDULE SUMMARY
            ═══════════════════════════════════════════════════════════════ */}
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", marginBottom: 12 }}>
            {lang === "es" ? "Resumen de Cronograma" : "Schedule Summary"}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#6b7280" }}>{lang === "es" ? "Capítulos en cronograma" : "Chapters in schedule"}</span>
              <span style={{ fontWeight: 700, color: "#1e293b" }}>{ganttSummary.chapters}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#6b7280" }}>{lang === "es" ? "Semanas planificadas" : "Weeks planned"}</span>
              <span style={{ fontWeight: 700, color: "#1e293b" }}>{ganttSummary.weeks}</span>
            </div>
            <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 8, marginTop: 4 }}>
              <span style={{ color: "#6b7280", fontSize: 11, fontWeight: 600 }}>
                {lang === "es" ? "Desglose de estatus" : "Status breakdown"}
              </span>
              <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6" }} />
                  <span style={{ fontSize: 11, color: "#6b7280" }}>{ganttSummary.pending} {lang === "es" ? "pendiente" : "pending"}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fbbf24" }} />
                  <span style={{ fontSize: 11, color: "#6b7280" }}>{ganttSummary.inProgress} {lang === "es" ? "en progreso" : "in progress"}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
                  <span style={{ fontSize: 11, color: "#6b7280" }}>{ganttSummary.complete} {lang === "es" ? "completo" : "complete"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          8. REPORT FOOTER
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
