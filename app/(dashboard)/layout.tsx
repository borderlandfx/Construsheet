import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/layout/Navbar";
import type { Locale } from "@/lib/utils/i18n";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const [{ data: profile }, { count }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, language, currency_pref")
      .eq("id", user.id)
      .single(),
    supabase
      .from("projects")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  const locale = (profile?.language ?? "es") as Locale;

  return (
    <div className="min-h-screen" style={{ background: "var(--cs-bg)" }}>
      <Navbar
        user={user}
        projectCount={count ?? 0}
        locale={locale}
        fullName={profile?.full_name}
      />
      {/* offset for fixed navbar */}
      <main
        className="mx-auto"
        style={{
          paddingTop: "calc(56px + 2rem)",
          paddingBottom: "2rem",
          paddingLeft: "2rem",
          paddingRight: "2rem",
          maxWidth: "1100px",
        }}
      >
        {children}
      </main>
    </div>
  );
}
