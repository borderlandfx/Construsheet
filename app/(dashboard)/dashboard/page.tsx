import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProjectsDashboard from "@/components/project/ProjectsDashboard";
import type { Locale } from "@/lib/utils/i18n";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("language")
    .eq("id", user.id)
    .single();

  const locale = (profile?.language ?? "es") as Locale;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto" style={{ padding: "2rem", maxWidth: 1100 }}>
        <ProjectsDashboard userId={user.id} locale={locale} />
      </div>
    </div>
  );
}
