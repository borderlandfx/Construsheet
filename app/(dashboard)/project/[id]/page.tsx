import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import type { Currency } from "@/lib/utils/currency";
import type { Locale } from "@/lib/utils/i18n";
import type { ApuItem, BudgetRow, GanttTask, TakeoffItem, ProjectIndirectCosts } from "@/lib/types/database.types";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Auth guard
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // Load project — must belong to current user
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!project) notFound();

  // Load profile for language/currency preference and default indirect costs
  const { data: profile } = await supabase
    .from("profiles")
    .select("language, currency_pref, default_indirect_costs")
    .eq("id", user.id)
    .single();

  // Load workspace data in parallel — each query is individually safe so one
  // table missing (e.g. takeoff_items not yet migrated) won't crash the page.
  async function safeQuery<T>(promise: Promise<{ data: T | null; error: unknown }>) {
    try {
      const { data } = await promise;
      return data;
    } catch {
      return null;
    }
  }

  const [apuItems, budgetRows, ganttTasks, takeoffItems] = await Promise.all([
    safeQuery(supabase.from("apu_items").select("*").eq("project_id", id).order("created_at")),
    safeQuery(supabase.from("budget_rows").select("*").eq("project_id", id).order("sort_order")),
    safeQuery(supabase.from("gantt_tasks").select("*").eq("project_id", id).order("sort_order")),
    safeQuery(supabase.from("takeoff_items").select("*").eq("project_id", id).order("sort_order")),
  ]);

  const initialCurrency = (project.currency ?? profile?.currency_pref ?? "USD") as Currency;
  const initialLanguage = (profile?.language ?? "es") as Locale;
  // Project-level settings take precedence; fall back to user default
  const initialSettings = (
    (project.project_settings && Object.keys(project.project_settings as object).length > 0
      ? project.project_settings
      : profile?.default_indirect_costs) ?? undefined
  ) as ProjectIndirectCosts | undefined;

  return (
    <WorkspaceShell
      project={project}
      apuItems={(apuItems as ApuItem[]) ?? []}
      budgetRows={(budgetRows as BudgetRow[]) ?? []}
      ganttTasks={(ganttTasks as GanttTask[]) ?? []}
      takeoffItems={(takeoffItems as TakeoffItem[]) ?? []}
      userId={user.id}
      userEmail={user.email ?? ""}
      initialCurrency={initialCurrency}
      initialLanguage={initialLanguage}
      initialSettings={initialSettings}
    />
  );
}
