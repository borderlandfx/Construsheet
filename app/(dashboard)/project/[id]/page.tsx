import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import type { Currency } from "@/lib/utils/currency";
import type { Locale } from "@/lib/utils/i18n";
import type { ApuItem, BudgetRow, GanttTask } from "@/lib/types/database.types";

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

  // Load profile for language/currency preference
  const { data: profile } = await supabase
    .from("profiles")
    .select("language, currency_pref")
    .eq("id", user.id)
    .single();

  // Load workspace data in parallel
  const [{ data: apuItems }, { data: budgetRows }, { data: ganttTasks }] =
    await Promise.all([
      supabase
        .from("apu_items")
        .select("*")
        .eq("project_id", id)
        .order("created_at"),
      supabase
        .from("budget_rows")
        .select("*")
        .eq("project_id", id)
        .order("sort_order"),
      supabase
        .from("gantt_tasks")
        .select("*")
        .eq("project_id", id)
        .order("sort_order"),
    ]);

  const initialCurrency = (project.currency ?? profile?.currency_pref ?? "USD") as Currency;
  const initialLanguage = (profile?.language ?? "es") as Locale;

  return (
    <WorkspaceShell
      project={project}
      apuItems={(apuItems as ApuItem[]) ?? []}
      budgetRows={(budgetRows as BudgetRow[]) ?? []}
      ganttTasks={(ganttTasks as GanttTask[]) ?? []}
      userId={user.id}
      userEmail={user.email ?? ""}
      initialCurrency={initialCurrency}
      initialLanguage={initialLanguage}
    />
  );
}
