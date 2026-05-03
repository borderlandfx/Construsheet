import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SettingsForm from "@/components/settings/SettingsForm";
import type { Locale } from "@/lib/utils/i18n";
import type { Currency } from "@/lib/utils/currency";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, language, currency_pref, default_indirect_costs")
    .eq("id", user.id)
    .single();

  return (
    <SettingsForm
      userId={user.id}
      email={user.email ?? ""}
      initialFullName={profile?.full_name ?? ""}
      initialLanguage={(profile?.language ?? "es") as Locale}
      initialCurrency={(profile?.currency_pref ?? "USD") as Currency}
      initialDefaultCosts={profile?.default_indirect_costs ?? null}
    />
  );
}
