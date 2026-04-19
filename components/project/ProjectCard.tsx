"use client";

import Link from "next/link";
import { format } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { MapPin, Calendar, Receipt, TrendingUp, ArrowRight } from "lucide-react";
import type { Locale } from "@/lib/utils/i18n";
import { t } from "@/lib/utils/i18n";
import type { Project, BudgetRow } from "@/lib/types/database.types";

export type ProjectWithBudget = Project & {
  budget_rows: Pick<BudgetRow, "id" | "total">[];
};

interface ProjectCardProps {
  project: ProjectWithBudget;
  locale: Locale;
}

const STATUS_CONFIG = {
  active: {
    labelKey: "statusActive" as const,
    dot: "#22c55e",
    bg: "rgba(34,197,94,0.1)",
    text: "#22c55e",
  },
  completed: {
    labelKey: "statusCompleted" as const,
    dot: "#14b8a6",
    bg: "rgba(20,184,166,0.1)",
    text: "#14b8a6",
  },
  archived: {
    labelKey: "statusArchived" as const,
    dot: "#6b7280",
    bg: "rgba(107,114,128,0.1)",
    text: "#6b7280",
  },
};

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ProjectCard({ project, locale }: ProjectCardProps) {
  const statusCfg = STATUS_CONFIG[project.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.active;
  const itemCount = project.budget_rows.length;
  const totalBudget = project.budget_rows.reduce((sum, r) => sum + (r.total ?? 0), 0);
  const dateLocale = locale === "en" ? enUS : es;
  const createdDate = format(new Date(project.created_at), "d MMM yyyy", { locale: dateLocale });

  return (
    <Link href={`/project/${project.id}`} style={{ textDecoration: "none" }}>
      <article
        className="group flex flex-col gap-4 rounded-[10px] transition-all duration-200"
        style={{
          background: "var(--cs-surface)",
          border: "1px solid var(--cs-border)",
          padding: "1.25rem",
          cursor: "pointer",
          height: "100%",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(249,115,22,0.5)";
          (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 1px rgba(249,115,22,0.15), 0 4px 24px rgba(249,115,22,0.08)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--cs-border)";
          (e.currentTarget as HTMLElement).style.boxShadow = "none";
        }}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <h3
            className="font-syne font-bold text-base leading-snug line-clamp-2 flex-1"
            style={{ color: "var(--cs-text)" }}
          >
            {project.name}
          </h3>
          {/* Status badge */}
          <span
            className="shrink-0 inline-flex items-center gap-1.5 rounded-full text-xs font-medium px-2.5 py-1"
            style={{
              background: statusCfg.bg,
              color: statusCfg.text,
              fontFamily: "var(--font-dm-sans)",
            }}
          >
            <span
              className="rounded-full"
              style={{ width: 6, height: 6, background: statusCfg.dot, display: "inline-block" }}
            />
            {t(statusCfg.labelKey, locale)}
          </span>
        </div>

        {/* Location */}
        {project.location && (
          <div className="flex items-center gap-1.5" style={{ color: "var(--cs-muted)" }}>
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="text-sm font-dm-sans truncate">{project.location}</span>
          </div>
        )}

        {/* Stats row */}
        <div
          className="flex items-center gap-4 rounded-lg py-3 px-3 mt-auto"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--cs-border)" }}
        >
          <div className="flex items-center gap-1.5 flex-1">
            <Receipt className="h-3.5 w-3.5" style={{ color: "var(--cs-muted)" }} />
            <span className="text-sm font-dm-sans" style={{ color: "var(--cs-text)" }}>
              {itemCount}
            </span>
            <span className="text-xs font-dm-sans" style={{ color: "var(--cs-muted)" }}>
              {t("budgetItems", locale)}
            </span>
          </div>
          <div
            className="w-px self-stretch"
            style={{ background: "var(--cs-border)" }}
          />
          <div className="flex items-center gap-1.5 flex-1 justify-end">
            <TrendingUp className="h-3.5 w-3.5" style={{ color: "var(--cs-accent)" }} />
            <span
              className="text-sm font-semibold font-dm-sans"
              style={{ color: "var(--cs-text)" }}
            >
              {formatCurrency(totalBudget, project.currency)}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5" style={{ color: "var(--cs-muted)" }}>
            <Calendar className="h-3 w-3" />
            <span className="text-xs font-dm-sans">{createdDate}</span>
          </div>
          <span
            className="flex items-center gap-1 text-xs font-medium font-dm-sans transition-colors"
            style={{ color: "var(--cs-muted)" }}
          >
            {t("openProject", locale)}
            <ArrowRight
              className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
              style={{ color: "var(--cs-accent)" }}
            />
          </span>
        </div>
      </article>
    </Link>
  );
}
