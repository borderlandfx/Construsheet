import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
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
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--cs-bg)" }}>
      {/* Sidebar — static flex child on desktop, overlay on mobile */}
      <Sidebar
        userId={user.id}
        locale={locale}
        fullName={profile?.full_name}
        userEmail={user.email ?? ""}
      />

      {/* Right column: navbar + content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        <Navbar
          user={user}
          projectCount={count ?? 0}
          locale={locale}
          fullName={profile?.full_name}
        />

        {/* Content area — each page handles its own scrolling */}
        <main style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
