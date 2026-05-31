"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  DollarSign,
  CheckCircle2,
  FolderOpen,
  AlertTriangle,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Building2,
  TrendingUp,
  Clock,
  ExternalLink,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import type { Locale } from "@/lib/utils/i18n";
import type { Project, BudgetRow, ApuItem } from "@/lib/types/database.types";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils/currency";
import type { Currency } from "@/lib/utils/currency";

// ─── Types ──────────────────────────────────────────────────────────────────

type StatusFilter = "all" | "active" | "completed" | "archived";
type SortKey = "name" | "status" | "budget" | "approved" | "approvedPct" | "items" | "apus";
type SortDir = "asc" | "desc";

interface ProjectRollup {
  project: Project;
  budget: number;
  approved: number;
  review: number;
  pending: number;
  approvedPct: number;
  itemCount: number;
  apuCount: number;
  hasVarianceAlert: boolean;
}

interface RollupDashboardProps {
  userId: string;
  locale: Locale;
  initialCurrency: Currency;
}

// ─── Status badge colors ────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  active:    { bg: "#dcfce7", color: "#16a34a" },
  completed: { bg: "#ccfbf1", color: "#0d9488" },
  archived:  { bg: "#f3f4f6", color: "#6b7280" },
};

// ─── Chart tooltip ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "var(--cs-surface)",
        border: "1px solid var(--cs-border)",
        borderRadius: 8,
        padding: "10px 14px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      }}
    >
      <p style={{ fontSize: 11, fontWeight: 600, color: "var(--cs-muted)", marginBottom: 6 }}>{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((entry: any, i: number) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: entry.color, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: "var(--cs-muted)" }}>{entry.name}:</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--cs-text)" }}>
            {formatCurrency(entry.value, currency)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Skeleton loaders ───────────────────────────────────────────────────────

function StatSkeleton() {
  return (
    <div
      className="flex flex-col gap-2 rounded-xl"
      style={{ background: "var(--cs-surface)", border: "1px solid var(--cs-border)", padding: "1.25rem" }}
    >
      <div className="skeleton h-4 w-24 rounded" />
      <div className="skeleton h-7 w-32 rounded" />
      <div className="skeleton h-3 w-20 rounded" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="skeleton rounded-lg" style={{ height: 52 }} />
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return <div className="skeleton rounded-xl" style={{ height: 300 }} />;
}

// ─── Main Component ────────────────────────────────────────────────────────

// ─── Language pill toggle ───────────────────────────────────────────────────

function LangToggle({ value, onChange }: { value: Locale; onChange: (v: Locale) => void }) {
  return (
    <div
      className="inline-flex rounded-lg overflow-hidden"
      style={{ border: "1px solid var(--cs-border)", background: "rgba(255,255,255,0.03)" }}
    >
      {(["es", "en"] as Locale[]).map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className="px-3 py-1 text-xs font-semibold font-dm-sans transition-all duration-150"
            style={{
              background: active ? "var(--cs-accent)" : "transparent",
              color: active ? "#fff" : "var(--cs-muted)",
              border: "none",
              cursor: "pointer",
              minWidth: 36,
            }}
          >
            {opt.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function RollupDashboard({ userId, locale: initialLocale, initialCurrency }: RollupDashboardProps) {
  const supabase = createClient();

  const [lang, setLang] = useState<Locale>(initialLocale);
  const isEs = lang === "es";

  // Sync language from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("cs-lang") as Locale | null;
    if (saved && (saved === "es" || saved === "en")) setLang(saved);
  }, []);

  // Language change handler — persist to localStorage + Supabase profile
  const handleLangChange = useCallback((newLang: Locale) => {
    setLang(newLang);
    localStorage.setItem("cs-lang", newLang);
    supabase.from("profiles").update({ language: newLang }).eq("id", userId);
  }, [supabase, userId]);

  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [budgetRows, setBudgetRows] = useState<Pick<BudgetRow, "project_id" | "quantity" | "unit_price" | "status" | "is_chapter" | "section" | "original_unit_price">[]>([]);
  const [apuCounts, setApuCounts] = useState<Pick<ApuItem, "project_id" | "id">[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [currency] = useState<Currency>(initialCurrency);

  const fmt = useCallback((v: number) => formatCurrency(v, currency), [currency]);
  const fmtCompact = useCallback((v: number) => formatCurrencyCompact(v, currency), [currency]);

  // ── Fetch all data in parallel ──────────────────────────────────────────
  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      const [pRes, bRes, aRes] = await Promise.all([
        supabase.from("projects").select("*").eq("user_id", userId),
        supabase.from("budget_rows").select("project_id, quantity, unit_price, status, is_chapter, section, original_unit_price").eq("is_chapter", false),
        supabase.from("apu_items").select("project_id, id"),
      ]);
      // Filter budget rows and APU items to only include rows belonging to user's projects
      const projectIds = new Set((pRes.data ?? []).map((p: Project) => p.id));
      setProjects((pRes.data as Project[]) ?? []);
      setBudgetRows((bRes.data ?? []).filter((r: { project_id: string }) => projectIds.has(r.project_id)));
      setApuCounts((aRes.data ?? []).filter((a: { project_id: string }) => projectIds.has(a.project_id)));
      setLoading(false);
    }
    fetchAll();
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Per-project rollups ───────────────────────────────────────────────
  const rollups: ProjectRollup[] = useMemo(() => {
    return projects.map((project) => {
      const rows = budgetRows.filter((r) => r.project_id === project.id);
      const budget = rows.reduce((s, r) => s + r.quantity * r.unit_price, 0);
      const approved = rows.filter((r) => r.status === "approved").reduce((s, r) => s + r.quantity * r.unit_price, 0);
      const review = rows.filter((r) => r.status === "in-review").reduce((s, r) => s + r.quantity * r.unit_price, 0);
      const pending = rows.filter((r) => r.status === "pending").reduce((s, r) => s + r.quantity * r.unit_price, 0);
      const approvedPct = budget > 0 ? (approved / budget) * 100 : 0;
      const itemCount = rows.length;
      const apuCount = apuCounts.filter((a) => a.project_id === project.id).length;

      // Variance alert: check if any section has >10% variance
      const sections = Array.from(new Set(rows.map((r) => r.section)));
      let hasVarianceAlert = false;
      for (const sec of sections) {
        const secRows = rows.filter((r) => r.section === sec);
        const currentTotal = secRows.reduce((s, r) => s + r.quantity * r.unit_price, 0);
        const originalTotal = secRows.reduce((s, r) => {
          const origPrice = (r as { original_unit_price?: number | null }).original_unit_price ?? r.unit_price;
          return s + r.quantity * origPrice;
        }, 0);
        if (originalTotal > 0) {
          const variance = ((currentTotal - originalTotal) / originalTotal) * 100;
          if (variance > 10) { hasVarianceAlert = true; break; }
        }
      }

      return { project, budget, approved, review, pending, approvedPct, itemCount, apuCount, hasVarianceAlert };
    });
  }, [projects, budgetRows, apuCounts]);

  // ── Filter + sort ─────────────────────────────────────────────────────
  const filteredRollups = useMemo(() => {
    let list = rollups;
    if (statusFilter !== "all") {
      list = list.filter((r) => r.project.status === statusFilter);
    }

    const statusOrder: Record<string, number> = { active: 0, completed: 1, archived: 2 };

    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name": cmp = a.project.name.localeCompare(b.project.name); break;
        case "status": cmp = (statusOrder[a.project.status] ?? 3) - (statusOrder[b.project.status] ?? 3); break;
        case "budget": cmp = a.budget - b.budget; break;
        case "approved": cmp = a.approved - b.approved; break;
        case "approvedPct": cmp = a.approvedPct - b.approvedPct; break;
        case "items": cmp = a.itemCount - b.itemCount; break;
        case "apus": cmp = a.apuCount - b.apuCount; break;
      }
      // For status, secondary sort by budget desc
      if (sortKey === "status" && cmp === 0) cmp = b.budget - a.budget;
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [rollups, statusFilter, sortKey, sortDir]);

  // ── Totals ────────────────────────────────────────────────────────────
  const totalBudget = useMemo(() => rollups.reduce((s, r) => s + r.budget, 0), [rollups]);
  const totalApproved = useMemo(() => rollups.reduce((s, r) => s + r.approved, 0), [rollups]);
  const avgApprovedPct = useMemo(() => {
    const withBudget = rollups.filter((r) => r.budget > 0);
    if (withBudget.length === 0) return 0;
    return withBudget.reduce((s, r) => s + r.approvedPct, 0) / withBudget.length;
  }, [rollups]);

  // ── Alerts ────────────────────────────────────────────────────────────
  const alerts = useMemo(() => {
    const list: { projectId: string; name: string; type: "variance" | "inactive" | "zero"; message: string }[] = [];

    rollups.forEach((r) => {
      if (r.hasVarianceAlert) {
        list.push({
          projectId: r.project.id,
          name: r.project.name,
          type: "variance",
          message: isEs
            ? `Capítulos sobre presupuesto (>10%)`
            : `Chapters over budget (>10%)`,
        });
      }
      if (r.project.status === "active" && r.budget > 0 && r.approvedPct === 0) {
        list.push({
          projectId: r.project.id,
          name: r.project.name,
          type: "zero",
          message: isEs
            ? `0% aprobado — revisar presupuesto`
            : `0% approved — review budget`,
        });
      }
      if (r.project.status === "active") {
        const updated = new Date(r.project.updated_at);
        const daysSince = Math.floor((Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSince > 30) {
          list.push({
            projectId: r.project.id,
            name: r.project.name,
            type: "inactive",
            message: isEs
              ? `Sin actividad en ${daysSince} días`
              : `No activity in ${daysSince} days`,
          });
        }
      }
    });

    return list;
  }, [rollups, isEs]);

  // ── Chart data ────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    return [...rollups]
      .sort((a, b) => b.budget - a.budget)
      .slice(0, 15)
      .map((r) => ({
        name: r.project.name.length > 20 ? r.project.name.slice(0, 18) + "…" : r.project.name,
        fullName: r.project.name,
        [isEs ? "Aprobado" : "Approved"]: r.approved,
        [isEs ? "En Revisión" : "Under Review"]: r.review,
        [isEs ? "Pendiente" : "Pending"]: r.pending,
      }));
  }, [rollups, isEs]);

  // ── Sort handler ──────────────────────────────────────────────────────
  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  }

  const statusLabel = (s: string) => {
    if (s === "active") return isEs ? "Activo" : "Active";
    if (s === "completed") return isEs ? "Completado" : "Completed";
    return isEs ? "Archivado" : "Archived";
  };

  const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
    { key: "all",       label: isEs ? "Todos"      : "All" },
    { key: "active",    label: isEs ? "Activos"    : "Active" },
    { key: "completed", label: isEs ? "Completados": "Completed" },
    { key: "archived",  label: isEs ? "Archivados" : "Archived" },
  ];

  const activeCount = projects.filter((p) => p.status === "active").length;

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* ── 1. PAGE HEADER ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1
            className="font-syne font-bold text-2xl"
            style={{ color: "var(--cs-text)", letterSpacing: "-0.03em" }}
          >
            {isEs ? "Vista General de Proyectos" : "Projects Overview"}
          </h1>
          {!loading && (
            <p className="font-dm-sans text-sm mt-1" style={{ color: "var(--cs-muted)" }}>
              {activeCount} {isEs ? "proyectos activos" : "active projects"}
              {" · "}
              {isEs ? "Total:" : "Total:"} {fmtCompact(totalBudget)} {isEs ? "presupuestado" : "budgeted"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <LangToggle value={lang} onChange={handleLangChange} />
          <Link
            href="/dashboard"
            className="px-3 py-1.5 rounded-lg text-xs font-medium font-dm-sans"
            style={{
              border: "1px solid var(--cs-border)",
              background: "transparent",
              color: "var(--cs-muted)",
              textDecoration: "none",
            }}
          >
            {isEs ? "Mis Proyectos" : "My Projects"}
          </Link>
        </div>
      </div>

      {/* ── Filter pills ───────────────────────────────────────────── */}
      {!loading && projects.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(({ key, label }) => {
            const active = statusFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className="px-3 py-1.5 rounded-full text-xs font-medium font-dm-sans transition-colors"
                style={{
                  border: active ? "1px solid var(--cs-accent)" : "1px solid var(--cs-border)",
                  background: active ? "rgba(249,115,22,0.12)" : "transparent",
                  color: active ? "var(--cs-accent)" : "var(--cs-muted)",
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── 2. SUMMARY STATS BAR ───────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)}
        </div>
      ) : projects.length > 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              icon: FolderOpen,
              label: isEs ? "Total Proyectos" : "Total Projects",
              value: String(projects.length),
              sub: `${activeCount} ${isEs ? "activos" : "active"}`,
              accent: "#f97316",
            },
            {
              icon: DollarSign,
              label: isEs ? "Presupuesto Total" : "Total Budget",
              value: fmtCompact(totalBudget),
              sub: fmt(totalBudget),
              accent: "#3b82f6",
            },
            {
              icon: CheckCircle2,
              label: isEs ? "Total Aprobado" : "Total Approved",
              value: fmtCompact(totalApproved),
              sub: fmt(totalApproved),
              accent: "#22c55e",
            },
            {
              icon: TrendingUp,
              label: isEs ? "% Aprobado Promedio" : "Avg % Approved",
              value: `${avgApprovedPct.toFixed(0)}%`,
              sub: isEs ? "promedio entre proyectos" : "average across projects",
              accent: "#8b5cf6",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="relative overflow-hidden rounded-xl p-5 transition-all"
              style={{
                background: "var(--cs-surface)",
                border: "1px solid var(--cs-border)",
              }}
            >
              <div
                className="absolute -right-4 -top-4 h-24 w-24 rounded-full opacity-10 blur-2xl"
                style={{ background: stat.accent }}
              />
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-medium uppercase tracking-wider font-dm-sans" style={{ color: "var(--cs-muted)" }}>
                    {stat.label}
                  </p>
                  <p className="text-2xl font-bold font-syne" style={{ color: "var(--cs-text)" }}>
                    {stat.value}
                  </p>
                  <p className="text-xs font-dm-sans" style={{ color: "var(--cs-muted)" }}>
                    {stat.sub}
                  </p>
                </div>
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ background: `${stat.accent}15` }}
                >
                  <stat.icon className="h-5 w-5" style={{ color: stat.accent }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* ── Loading skeletons ──────────────────────────────────────── */}
      {loading && (
        <div className="flex flex-col gap-6">
          <TableSkeleton />
          <ChartSkeleton />
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────────────── */}
      {!loading && projects.length === 0 && (
        <div
          className="flex flex-col items-center justify-center rounded-[16px] py-20 px-8 text-center"
          style={{ border: "1.5px dashed var(--cs-border)", background: "rgba(255,255,255,0.01)" }}
        >
          <span
            className="flex items-center justify-center rounded-2xl mb-5"
            style={{ width: 64, height: 64, background: "rgba(249,115,22,0.1)" }}
          >
            <LayoutDashboard className="h-8 w-8" style={{ color: "var(--cs-accent)" }} />
          </span>
          <h2 className="font-syne font-bold text-xl mb-2" style={{ color: "var(--cs-text)" }}>
            {isEs ? "No hay proyectos todavía" : "No projects yet"}
          </h2>
          <p className="font-dm-sans text-sm mb-6" style={{ color: "var(--cs-muted)", maxWidth: 360 }}>
            {isEs
              ? "Crea tu primer proyecto para ver la vista general"
              : "Create your first project to see the overview"}
          </p>
          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-[10px] text-sm font-semibold font-dm-sans"
            style={{ background: "var(--cs-accent)", color: "#fff", textDecoration: "none" }}
          >
            {isEs ? "Crear primer proyecto" : "Create first project"}
          </Link>
        </div>
      )}

      {/* ── 3. PROJECTS COMPARISON TABLE (Desktop/Tablet) ──────────── */}
      {!loading && filteredRollups.length > 0 && (
        <div
          className="rounded-xl overflow-hidden hidden md:block"
          style={{ background: "var(--cs-surface)", border: "1px solid var(--cs-border)" }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--cs-border)" }}>
                  {([
                    { key: "name" as SortKey,        label: isEs ? "Proyecto" : "Project" },
                    { key: "status" as SortKey,      label: isEs ? "Estado" : "Status" },
                    { key: "budget" as SortKey,      label: isEs ? "Presupuesto" : "Budget" },
                    { key: "approved" as SortKey,    label: isEs ? "Aprobado" : "Approved" },
                    { key: "approvedPct" as SortKey, label: isEs ? "% Aprobado" : "% Approved" },
                    { key: "items" as SortKey,       label: isEs ? "Partidas" : "Items" },
                    { key: "apus" as SortKey,        label: "APUs" },
                  ]).map(({ key, label }) => (
                    <th
                      key={key}
                      onClick={() => handleSort(key)}
                      className="px-4 py-3 text-xs font-semibold uppercase tracking-wider font-dm-sans whitespace-nowrap select-none"
                      style={{ color: "var(--cs-muted)", cursor: "pointer" }}
                    >
                      <span className="flex items-center gap-1">
                        {label}
                        <SortIcon col={key} />
                      </span>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider font-dm-sans" style={{ color: "var(--cs-muted)" }}>
                    {isEs ? "Alerta" : "Alert"}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider font-dm-sans" style={{ color: "var(--cs-muted)" }}>
                    {isEs ? "Acciones" : "Actions"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRollups.map((r) => {
                  const st = STATUS_STYLE[r.project.status] ?? STATUS_STYLE.archived;
                  return (
                    <tr
                      key={r.project.id}
                      className="transition-colors"
                      style={{ borderBottom: "1px solid var(--cs-border)" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "var(--cs-bg2, rgba(255,255,255,0.02))"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                    >
                      {/* Project */}
                      <td className="px-4 py-3" style={{ maxWidth: 220 }}>
                        <Link href={`/project/${r.project.id}`} style={{ textDecoration: "none" }}>
                          <div className="font-dm-sans text-sm font-semibold truncate" style={{ color: "var(--cs-text)" }}>
                            {r.project.name}
                          </div>
                          {r.project.location && (
                            <div className="font-dm-sans text-xs truncate" style={{ color: "var(--cs-muted)" }}>
                              {r.project.location}
                            </div>
                          )}
                        </Link>
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium font-dm-sans"
                          style={{ background: st.bg, color: st.color }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.color }} />
                          {statusLabel(r.project.status)}
                        </span>
                      </td>
                      {/* Budget */}
                      <td className="px-4 py-3 text-sm font-semibold font-dm-sans" style={{ color: "var(--cs-text)" }}>
                        {fmt(r.budget)}
                      </td>
                      {/* Approved */}
                      <td className="px-4 py-3 text-sm font-dm-sans" style={{ color: "#22c55e" }}>
                        {fmt(r.approved)}
                      </td>
                      {/* % Approved */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--cs-border)", maxWidth: 60 }}>
                            <div className="h-full rounded-full" style={{ width: `${Math.min(r.approvedPct, 100)}%`, background: "#22c55e" }} />
                          </div>
                          <span className="text-xs font-semibold font-dm-sans" style={{ color: "var(--cs-muted)" }}>
                            {r.approvedPct.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      {/* Items */}
                      <td className="px-4 py-3 text-sm font-dm-sans text-center" style={{ color: "var(--cs-muted)" }}>
                        {r.itemCount}
                      </td>
                      {/* APUs */}
                      <td className="px-4 py-3 text-sm font-dm-sans text-center" style={{ color: "var(--cs-muted)" }}>
                        {r.apuCount}
                      </td>
                      {/* Alert */}
                      <td className="px-4 py-3 text-center">
                        {r.hasVarianceAlert ? (
                          <AlertTriangle className="h-4 w-4 inline-block" style={{ color: "#f59e0b" }} />
                        ) : (
                          <span style={{ color: "var(--cs-border)" }}>—</span>
                        )}
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3">
                        <Link
                          href={`/project/${r.project.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium font-dm-sans"
                          style={{
                            background: "rgba(249,115,22,0.1)",
                            color: "var(--cs-accent)",
                            textDecoration: "none",
                            border: "1px solid rgba(249,115,22,0.2)",
                          }}
                        >
                          <ExternalLink className="h-3 w-3" />
                          {isEs ? "Abrir" : "Open"}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Totals row */}
              <tfoot>
                <tr style={{ borderTop: "2px solid var(--cs-accent)" }}>
                  <td className="px-4 py-3 text-xs font-bold font-dm-sans uppercase" style={{ color: "var(--cs-accent)" }}>
                    Total
                  </td>
                  <td className="px-4 py-3 text-xs font-bold font-dm-sans" style={{ color: "var(--cs-muted)" }}>
                    {filteredRollups.length} {isEs ? "proyectos" : "projects"}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold font-dm-sans" style={{ color: "var(--cs-accent)" }}>
                    {fmt(filteredRollups.reduce((s, r) => s + r.budget, 0))}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold font-dm-sans" style={{ color: "#22c55e" }}>
                    {fmt(filteredRollups.reduce((s, r) => s + r.approved, 0))}
                  </td>
                  <td className="px-4 py-3 text-xs font-bold font-dm-sans" style={{ color: "var(--cs-accent)" }}>
                    {(() => {
                      const withBudget = filteredRollups.filter((r) => r.budget > 0);
                      return withBudget.length > 0
                        ? `${(withBudget.reduce((s, r) => s + r.approvedPct, 0) / withBudget.length).toFixed(0)}%`
                        : "0%";
                    })()}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold font-dm-sans text-center" style={{ color: "var(--cs-text)" }}>
                    {filteredRollups.reduce((s, r) => s + r.itemCount, 0)}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold font-dm-sans text-center" style={{ color: "var(--cs-text)" }}>
                    {filteredRollups.reduce((s, r) => s + r.apuCount, 0)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── 4. BUDGET DISTRIBUTION CHART ───────────────────────────── */}
      {!loading && chartData.length > 0 && (
        <div
          className="rounded-xl p-5"
          style={{ background: "var(--cs-surface)", border: "1px solid var(--cs-border)" }}
        >
          <h3 className="text-sm font-semibold font-dm-sans mb-4" style={{ color: "var(--cs-text)" }}>
            {isEs ? "Distribución por Proyecto" : "Distribution by Project"}
          </h3>
          <div style={{ height: Math.max(chartData.length * 44 + 40, 200) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 4, right: 60, left: 10, bottom: 4 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={160}
                  tick={{ fill: "var(--cs-muted)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip currency={currency} />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Bar dataKey={isEs ? "Aprobado" : "Approved"} stackId="a" fill="#22c55e" barSize={22} />
                <Bar dataKey={isEs ? "En Revisión" : "Under Review"} stackId="a" fill="#fbbf24" barSize={22} />
                <Bar dataKey={isEs ? "Pendiente" : "Pending"} stackId="a" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── 5. PROJECT CARDS GRID (Mobile + compact desktop) ───────── */}
      {!loading && filteredRollups.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold font-dm-sans mb-3 md:mt-2" style={{ color: "var(--cs-text)" }}>
            {isEs ? "Resumen por Proyecto" : "Project Summary"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRollups.map((r) => {
              const st = STATUS_STYLE[r.project.status] ?? STATUS_STYLE.archived;
              const daysSince = Math.floor(
                (Date.now() - new Date(r.project.updated_at).getTime()) / (1000 * 60 * 60 * 24)
              );
              const lastActivity = daysSince === 0
                ? (isEs ? "Hoy" : "Today")
                : daysSince === 1
                ? (isEs ? "Ayer" : "Yesterday")
                : (isEs ? `hace ${daysSince} días` : `${daysSince} days ago`);

              return (
                <Link
                  key={r.project.id}
                  href={`/project/${r.project.id}`}
                  className="flex flex-col gap-3 rounded-xl p-4 transition-all"
                  style={{
                    background: "var(--cs-surface)",
                    border: "1px solid var(--cs-border)",
                    textDecoration: "none",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--cs-accent)";
                    (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 4px 16px rgba(249,115,22,0.08)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--cs-border)";
                    (e.currentTarget as HTMLAnchorElement).style.boxShadow = "none";
                  }}
                >
                  {/* Name + status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="h-4 w-4 shrink-0" style={{ color: "var(--cs-accent)" }} />
                      <span className="font-dm-sans text-sm font-semibold truncate" style={{ color: "var(--cs-text)" }}>
                        {r.project.name}
                      </span>
                    </div>
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium font-dm-sans shrink-0"
                      style={{ background: st.bg, color: st.color }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.color }} />
                      {statusLabel(r.project.status)}
                    </span>
                  </div>

                  {/* 4-metric grid */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: isEs ? "Presupuesto" : "Budget", value: fmtCompact(r.budget), accent: false },
                      { label: isEs ? "Aprobado" : "Approved", value: `${r.approvedPct.toFixed(0)}%`, accent: false },
                      { label: "APUs", value: String(r.apuCount), accent: false },
                      { label: isEs ? "Partidas" : "Items", value: String(r.itemCount), accent: false },
                    ].map((m) => (
                      <div
                        key={m.label}
                        className="flex flex-col rounded-lg px-2.5 py-2"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--cs-border)" }}
                      >
                        <span className="text-xs font-dm-sans" style={{ color: "var(--cs-muted)", fontSize: 10 }}>{m.label}</span>
                        <span className="font-dm-sans font-semibold text-sm" style={{ color: "var(--cs-text)" }}>{m.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Progress bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--cs-border)" }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.min(r.approvedPct, 100)}%`, background: "#22c55e", transition: "width 0.3s ease" }} />
                    </div>
                    <span className="text-xs font-semibold font-dm-sans" style={{ color: "var(--cs-muted)" }}>
                      {r.approvedPct.toFixed(0)}%
                    </span>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    {r.project.location && (
                      <span className="text-xs font-dm-sans truncate" style={{ color: "var(--cs-muted)" }}>
                        {r.project.location}
                      </span>
                    )}
                    <span className="text-xs font-dm-sans flex items-center gap-1 ml-auto" style={{ color: "var(--cs-muted)" }}>
                      <Clock className="h-3 w-3" />
                      {lastActivity}
                    </span>
                  </div>

                  {/* Variance alert */}
                  {r.hasVarianceAlert && (
                    <div
                      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-dm-sans"
                      style={{ background: "#fffbeb", color: "#d97706", border: "1px solid #fcd34d" }}
                    >
                      <AlertTriangle className="h-3 w-3" />
                      {isEs ? "Capítulos sobre presupuesto" : "Chapters over budget"}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 6. ALERTS PANEL ────────────────────────────────────────── */}
      {!loading && alerts.length > 0 && (
        <div
          className="rounded-xl p-5"
          style={{ background: "var(--cs-surface)", border: "1px solid var(--cs-border)" }}
        >
          <h3 className="text-sm font-semibold font-dm-sans mb-3 flex items-center gap-2" style={{ color: "var(--cs-text)" }}>
            <AlertTriangle className="h-4 w-4" style={{ color: "#f59e0b" }} />
            {isEs ? "Alertas" : "Alerts"}
            <span
              className="inline-flex items-center justify-center rounded-full text-xs font-bold font-dm-sans"
              style={{ minWidth: 20, height: 20, background: "rgba(245,158,11,0.15)", color: "#f59e0b", padding: "0 6px" }}
            >
              {alerts.length}
            </span>
          </h3>
          <div className="flex flex-col gap-2">
            {alerts.map((alert, i) => (
              <Link
                key={`${alert.projectId}-${alert.type}-${i}`}
                href={`/project/${alert.projectId}`}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors"
                style={{
                  background: alert.type === "variance" ? "#fffbeb" : alert.type === "zero" ? "#eff6ff" : "#f9fafb",
                  border: `1px solid ${alert.type === "variance" ? "#fcd34d" : alert.type === "zero" ? "#bfdbfe" : "#e5e7eb"}`,
                  textDecoration: "none",
                  cursor: "pointer",
                }}
              >
                <AlertTriangle
                  className="h-4 w-4 shrink-0"
                  style={{ color: alert.type === "variance" ? "#f59e0b" : alert.type === "zero" ? "#3b82f6" : "#6b7280" }}
                />
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold font-dm-sans" style={{ color: "#1e293b" }}>
                    {alert.name}
                  </span>
                  <span className="text-xs font-dm-sans ml-2" style={{ color: "#6b7280" }}>
                    {alert.message}
                  </span>
                </div>
                <ExternalLink className="h-3.5 w-3.5 shrink-0" style={{ color: "#9ca3af" }} />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
