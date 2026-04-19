"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ProjectCard, { type ProjectWithBudget } from "./ProjectCard";
import CreateProjectModal from "./CreateProjectModal";
import { FolderOpen } from "lucide-react";
import type { Locale } from "@/lib/utils/i18n";
import { t } from "@/lib/utils/i18n";

interface ProjectsDashboardProps {
  userId: string;
  locale: Locale;
}

function CardSkeleton() {
  return (
    <div
      className="flex flex-col gap-4 rounded-[10px]"
      style={{
        background: "var(--cs-surface)",
        border: "1px solid var(--cs-border)",
        padding: "1.25rem",
        height: 200,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="skeleton h-5 rounded flex-1" style={{ maxWidth: "60%" }} />
        <div className="skeleton h-6 w-20 rounded-full" />
      </div>
      <div className="skeleton h-4 w-1/3 rounded" />
      <div
        className="skeleton rounded-lg mt-auto"
        style={{ height: 52 }}
      />
      <div className="flex justify-between">
        <div className="skeleton h-3 w-24 rounded" />
        <div className="skeleton h-3 w-16 rounded" />
      </div>
    </div>
  );
}

export default function ProjectsDashboard({ userId, locale }: ProjectsDashboardProps) {
  const router = useRouter();
  const supabase = createClient();
  const [projects, setProjects] = useState<ProjectWithBudget[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProjects() {
      const { data } = await supabase
        .from("projects")
        .select("*, budget_rows(id, total)")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      setProjects((data as ProjectWithBudget[]) ?? []);
      setLoading(false);
    }

    fetchProjects();
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleProjectCreated(newProject: ProjectWithBudget) {
    setProjects((prev) => [newProject, ...prev]);
    // Refresh server components (layout) so the navbar project count stays in sync.
    router.refresh();
  }

  return (
    <>
      {/* Page header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <h1
            className="font-syne font-bold text-2xl"
            style={{ color: "var(--cs-text)", letterSpacing: "-0.03em" }}
          >
            {t("myProjects", locale)}
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
              {projects.length}
            </span>
          )}
        </div>
        <CreateProjectModal
          userId={userId}
          locale={locale}
          onProjectCreated={handleProjectCreated}
        />
      </div>

      {/* Skeleton grid */}
      {loading && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
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
            style={{
              width: 64,
              height: 64,
              background: "rgba(249,115,22,0.1)",
            }}
          >
            <FolderOpen
              className="h-8 w-8"
              style={{ color: "var(--cs-accent)" }}
            />
          </span>
          <h2
            className="font-syne font-bold text-xl mb-2"
            style={{ color: "var(--cs-text)" }}
          >
            {t("noProjectsTitle", locale)}
          </h2>
          <p
            className="font-dm-sans text-sm mb-8 max-w-xs"
            style={{ color: "var(--cs-muted)", lineHeight: 1.6 }}
          >
            {t("noProjectsDesc", locale)}
          </p>
          <CreateProjectModal
            userId={userId}
            locale={locale}
            onProjectCreated={handleProjectCreated}
          />
        </div>
      )}

      {/* Projects grid */}
      {!loading && projects.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} locale={locale} />
          ))}
        </div>
      )}
    </>
  );
}
