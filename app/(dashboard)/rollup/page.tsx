import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RollupDashboard from "@/components/project/RollupDashboard";
import type { Locale } from "@/lib/utils/i18n";

export default async function RollupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("language, currency_pref")
    .eq("id", user.id)
    .single();

  const locale = (profile?.language ?? "es") as Locale;
  const currency = (profile?.currency_pref ?? "USD") as "USD" | "MXN";

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto" style={{ padding: "2rem", maxWidth: 1200 }}>
        <RollupDashboard userId={user.id} locale={locale} initialCurrency={currency} />
      </div>
    </div>
  );
}
