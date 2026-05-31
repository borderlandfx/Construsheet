"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ProjectCard, { type ProjectWithBudget } from "./ProjectCard";
import CreateProjectModal from "./CreateProjectModal";
import { FolderOpen, Search, X } from "lucide-react";
import type { Locale } from "@/lib/utils/i18n";
import { t } from "@/lib/utils/i18n";
import { usePlan } from "@/lib/hooks/usePlan";
import UpgradePrompt from "@/components/ui/UpgradePrompt";

type StatusFilter = "all" | "active" | "completed" | "archived";

interface ProjectsDashboardProps {
  userId: string;
  locale: Locale;
}

function CardSkeleton() {
  return (
    <div
      className="flex flex-col gap-3 rounded-xl"
      style={{
        background: "var(--cs-surface)",
        border: "1px solid var(--cs-border)",
        padding: "1.25rem",
        height: 240,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="skeleton h-5 rounded flex-1" style={{ maxWidth: "60%" }} />
        <div className="skeleton h-6 w-20 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton rounded-lg" style={{ height: 48 }} />
        ))}
      </div>
      <div className="skeleton h-1.5 w-full rounded-full" />
      <div className="flex justify-between mt-auto">
        <div className="skeleton h-3 w-28 rounded" />
        <div className="skeleton h-3 w-16 rounded" />
      </div>
    </div>
  );
}

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

export default function ProjectsDashboard({ userId, locale: initialLocale }: ProjectsDashboardProps) {
  const router = useRouter();
  const supabase = createClient();
  const [projects, setProjects] = useState<ProjectWithBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [lang, setLang] = useState<Locale>(initialLocale);
  const { can } = usePlan(userId);
  const [upgradePrompt, setUpgradePrompt] = useState<{ feature: string; description: string } | null>(null);

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

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.location ?? "").toLowerCase().includes(q)
      );
    });
  }, [projects, search, statusFilter]);

  useEffect(() => {
    async function fetchProjects() {
      const { data } = await supabase
        .from("projects")
        .select("*, budget_rows(id, total, status, is_chapter), apu_items(id)")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      setProjects((data as ProjectWithBudget[]) ?? []);
      setLoading(false);
    }

    fetchProjects();
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleProjectCreated(newProject: ProjectWithBudget) {
    setProjects((prev) => [newProject, ...prev]);
    router.refresh();
  }

  function handleProjectUpdated(updated: ProjectWithBudget) {
    setProjects((prev) => prev.map((p) => p.id === updated.id ? updated : p));
  }

  function handleProjectDeleted(id: string) {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    router.refresh();
  }

  function handleProjectDuplicated(newProject: ProjectWithBudget) {
    setProjects((prev) => [newProject, ...prev]);
  }

  const isEs = lang === "es";

  // Portfolio-level aggregates (derived from full list, not filtered)
  const portfolioTotal = projects.reduce(
    (sum, p) => sum + p.budget_rows.filter((r) => !r.is_chapter).reduce((s, r) => s + (r.total ?? 0), 0),
    0
  );
  const activeCount    = projects.filter((p) => p.status === "active").length;
  const completedCount = projects.filter((p) => p.status === "completed").length;
  const archivedCount  = projects.filter((p) => p.status === "archived").length;

  function fmtPortfolio(n: number) {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
  }

  const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
    { key: "all",       label: isEs ? "Todos"      : "All"       },
    { key: "active",    label: isEs ? "Activo"     : "Active"    },
    { key: "completed", label: isEs ? "Completado" : "Completed" },
    { key: "archived",  label: isEs ? "Archivado"  : "Archived"  },
  ];

  return (
    <>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <h1
            className="font-syne font-bold text-2xl"
            style={{ color: "var(--cs-text)", letterSpacing: "-0.03em" }}
          >
            {t("myProjects", lang)}
          </h1>
          {!loading && (
            <span
              className="inline-flex items-center justify-center rounded-full text-sm font-semibold font-dm-sans"
              style={{
                minWidth: 28,
                height: 28,
                padding: "0 8px",
                background: "rgba(249,115,22,0.12)",
                color: "var(--cs-accent)",
              }}
            >
              {filteredProjects.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <LangToggle value={lang} onChange={handleLangChange} />
          <div onClickCapture={(e) => {
            if (!can.createProject(projects.length)) {
              e.stopPropagation();
              e.preventDefault();
              setUpgradePrompt({
                feature: isEs ? "Proyectos ilimitados" : "Unlimited projects",
                description: isEs
                  ? "El plan gratuito incluye 1 proyecto. Actualiza a Pro para crear ilimitados."
                  : "The free plan includes 1 project. Upgrade to Pro for unlimited.",
              });
            }
          }}>
            <CreateProjectModal
              userId={userId}
              locale={lang}
              onProjectCreated={handleProjectCreated}
            />
          </div>
        </div>
      </div>

      {/* Portfolio stats strip */}
      {!loading && projects.length > 0 && (
        <div
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5"
        >
          {[
            {
              label: isEs ? "Valor del portafolio" : "Portfolio value",
              value: fmtPortfolio(portfolioTotal),
              accent: true,
            },
            {
              label: isEs ? "Proyectos activos" : "Active projects",
              value: String(activeCount),
            },
            {
              label: isEs ? "Completados" : "Completed",
              value: String(completedCount),
            },
            {
              label: isEs ? "Archivados" : "Archived",
              value: String(archivedCount),
            },
          ].map(({ label, value, accent }) => (
            <div
              key={label}
              className="flex flex-col gap-0.5 rounded-[10px] px-4 py-3"
              style={{
                border: `1px solid ${accent ? "rgba(249,115,22,0.25)" : "var(--cs-border)"}`,
                background: accent ? "rgba(249,115,22,0.04)" : "rgba(255,255,255,0.02)",
              }}
            >
              <span className="text-xs font-dm-sans" style={{ color: "var(--cs-muted)" }}>
                {label}
              </span>
              <span
                className="font-syne font-bold text-xl"
                style={{ color: accent ? "var(--cs-accent)" : "var(--cs-text)" }}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Search + status filter bar */}
      {!loading && projects.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {/* Search input */}
          <div className="relative flex-1" style={{ minWidth: 200, maxWidth: 320 }}>
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none"
              style={{ color: "var(--cs-muted)" }}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isEs ? "Buscar por nombre o ubicación…" : "Search by name or location…"}
              className="w-full font-dm-sans text-sm"
              style={{
                padding: "0.45rem 2rem 0.45rem 2.125rem",
                borderRadius: 10,
                border: "1px solid var(--cs-border)",
                background: "rgba(255,255,255,0.04)",
                color: "var(--cs-text)",
                outline: "none",
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center"
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--cs-muted)", padding: 2 }}
                aria-label={isEs ? "Limpiar búsqueda" : "Clear search"}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Status pills */}
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
        </div>
      )}

      {/* Skeleton grid */}
      {loading && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* No projects at all */}
      {!loading && projects.length === 0 && (
        <div
          className="flex flex-col items-center justify-center rounded-[16px] py-20 px-8 text-center"
          style={{
            border: "1.5px dashed var(--cs-border)",
            background: "rgba(255,255,255,0.01)",
          }}
        >
          <span
            className="flex items-center justify-center rounded-2xl mb-5"
            style={{ width: 64, height: 64, background: "rgba(249,115,22,0.1)" }}
          >
            <FolderOpen className="h-8 w-8" style={{ color: "var(--cs-accent)" }} />
          </span>
          <h2 className="font-syne font-bold text-xl mb-2" style={{ color: "var(--cs-text)" }}>
            {t("noProjectsTitle", lang)}
          </h2>
          <p className="font-dm-sans text-sm mb-8 max-w-xs" style={{ color: "var(--cs-muted)", lineHeight: 1.6 }}>
            {t("noProjectsDesc", lang)}
          </p>
          <CreateProjectModal userId={userId} locale={lang} onProjectCreated={handleProjectCreated} />
        </div>
      )}

      {/* No results from filter/search */}
      {!loading && projects.length > 0 && filteredProjects.length === 0 && (
        <div
          className="flex flex-col items-center justify-center rounded-[16px] py-16 px-8 text-center"
          style={{ border: "1.5px dashed var(--cs-border)" }}
        >
          <Search className="h-8 w-8 mb-3" style={{ color: "var(--cs-muted)" }} />
          <p className="font-syne font-semibold text-base mb-1" style={{ color: "var(--cs-text)" }}>
            {isEs ? "Sin resultados" : "No results"}
          </p>
          <p className="font-dm-sans text-sm" style={{ color: "var(--cs-muted)" }}>
            {isEs
              ? "Prueba con otro nombre, ubicación o filtro de estado."
              : "Try a different name, location, or status filter."}
          </p>
          <button
            type="button"
            onClick={() => { setSearch(""); setStatusFilter("all"); }}
            className="mt-4 px-4 py-2 rounded-[10px] text-sm font-medium font-dm-sans"
            style={{
              border: "1px solid var(--cs-border)",
              background: "transparent",
              color: "var(--cs-muted)",
              cursor: "pointer",
            }}
          >
            {isEs ? "Limpiar filtros" : "Clear filters"}
          </button>
        </div>
      )}

      {/* Projects grid */}
      {!loading && filteredProjects.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              locale={lang}
              onUpdated={handleProjectUpdated}
              onDeleted={handleProjectDeleted}
              onDuplicated={handleProjectDuplicated}
            />
          ))}
        </div>
      )}

      {upgradePrompt && (
        <UpgradePrompt
          feature={upgradePrompt.feature}
          description={upgradePrompt.description}
          lang={lang}
          onClose={() => setUpgradePrompt(null)}
        />
      )}
    </>
  );
}
