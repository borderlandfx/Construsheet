"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { HardHat, LogOut, Moon, Settings, Sun } from "lucide-react";
import type { Locale } from "@/lib/utils/i18n";
import { t } from "@/lib/utils/i18n";

interface NavbarProps {
  user: User;
  projectCount: number;
  locale: Locale;
  fullName?: string | null;
}

export default function Navbar({ user, projectCount, locale, fullName }: NavbarProps) {
  const router = useRouter();
  const supabase = createClient();
  const { theme, setTheme } = useTheme();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  function toggleTheme() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  const displayName = fullName || user.email?.split("@")[0] || "User";
  const isDark = theme !== "light";

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center px-4 sm:px-6 gap-3 sm:gap-4"
      style={{
        height: "56px",
        background: "var(--cs-surface)",
        borderBottom: "1px solid var(--cs-border)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {/* Logo */}
      <Link
        href="/dashboard"
        className="flex items-center gap-2 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cs-accent)] rounded-lg"
        style={{ textDecoration: "none" }}
        aria-label="ConstruSheet — go to dashboard"
      >
        <span
          className="flex items-center justify-center rounded-lg shrink-0"
          style={{ width: 30, height: 30, background: "var(--cs-accent)" }}
        >
          <HardHat className="h-4 w-4 text-white" aria-hidden="true" />
        </span>
        <span
          className="font-syne font-800 text-base hidden sm:block"
          style={{ color: "var(--cs-text)", fontWeight: 800, letterSpacing: "-0.02em" }}
        >
          ConstruSheet
        </span>
      </Link>

      {/* Project count — center */}
      <div className="flex-1 flex justify-center">
        <span
          className="font-dm-sans text-sm hidden sm:flex items-center gap-2"
          style={{ color: "var(--cs-muted)" }}
          aria-label={`${projectCount} ${t("projects", locale)}`}
        >
          {t("projects", locale)}
          <span
            className="inline-flex items-center justify-center rounded-full text-xs font-semibold"
            style={{
              minWidth: 22,
              height: 22,
              padding: "0 6px",
              background: "rgba(249,115,22,0.15)",
              color: "var(--cs-accent)",
              fontFamily: "var(--font-dm-sans)",
            }}
            aria-hidden="true"
          >
            {projectCount}
          </span>
        </span>
      </div>

      {/* Controls — right */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* User display name */}
        <span
          className="text-sm font-dm-sans hidden md:block truncate max-w-[140px]"
          style={{ color: "var(--cs-muted)" }}
        >
          {displayName}
        </span>

        {/* Settings link */}
        <Link
          href="/settings"
          aria-label={t("settings", locale)}
          title={t("settings", locale)}
          className="flex items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cs-accent)]"
          style={{
            width: 34,
            height: 34,
            border: "1px solid var(--cs-border)",
            background: "transparent",
            color: "var(--cs-muted)",
            textDecoration: "none",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--cs-text)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--cs-muted)")}
        >
          <Settings className="h-4 w-4" aria-hidden="true" />
        </Link>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          title={isDark ? "Light mode" : "Dark mode"}
          className="flex items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cs-accent)]"
          style={{
            width: 34,
            height: 34,
            border: "1px solid var(--cs-border)",
            background: "transparent",
            color: "var(--cs-muted)",
            cursor: "pointer",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--cs-text)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--cs-muted)";
          }}
        >
          {isDark ? (
            <Sun className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Moon className="h-4 w-4" aria-hidden="true" />
          )}
        </button>

        {/* Logout */}
        <button
          onClick={handleLogout}
          aria-label={t("logout", locale)}
          title={t("logout", locale)}
          className="flex items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cs-accent)]"
          style={{
            width: 34,
            height: 34,
            border: "1px solid var(--cs-border)",
            background: "transparent",
            color: "var(--cs-muted)",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--cs-text)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.2)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--cs-muted)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--cs-border)";
          }}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
