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
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--cs-bg)" }}>
      {/* Sidebar — static flex child on desktop, overlay on mobile */}
      <Sidebar
        userId={user.id}
        locale={locale}
        fullName={profile?.full_name}
        userEmail={user.email ?? ""}
      />

      {/* Right column: navbar + content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar
          user={user}
          projectCount={count ?? 0}
          locale={locale}
          fullName={profile?.full_name}
        />

        {/* Scrollable content area */}
        <main
          className="flex-1 overflow-y-auto"
          style={{ background: "var(--cs-bg)" }}
        >
          <div
            className="mx-auto"
            style={{
              padding: "2rem",
              maxWidth: 1100,
            }}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
