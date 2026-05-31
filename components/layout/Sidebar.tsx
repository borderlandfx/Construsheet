"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  HardHat, Home, Building2, Settings, LogOut, Menu, X, LayoutDashboard, Crown,
} from "lucide-react";
import { usePlan } from "@/lib/hooks/usePlan";
import type { Locale } from "@/lib/utils/i18n";

interface SidebarProps {
  userId: string;
  locale: Locale;
  fullName?: string | null;
  userEmail: string;
}

interface ProjectStub {
  id: string;
  name: string;
  status: string;
}

export default function Sidebar({ userId, locale, fullName, userEmail }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const isEs = locale === "es";
  const { isPro } = usePlan(userId);

  const [projects, setProjects] = useState<ProjectStub[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Derive active project ID from URL
  const activeProjectId = pathname.startsWith("/project/")
    ? pathname.split("/")[2] ?? null
    : null;

  useEffect(() => {
    supabase
      .from("projects")
      .select("id, name, status")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setProjects(data as ProjectStub[]);
      });
  }, [userId, supabase]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  const displayName = fullName || userEmail.split("@")[0] || "User";
  const displayInitial = displayName.charAt(0).toUpperCase();

  const sidebarInner = (
    <>
      {/* Logo */}
      <Link
        href="/dashboard"
        onClick={() => setMobileOpen(false)}
        className="flex items-center gap-2 shrink-0"
        style={{ padding: "14px 16px", textDecoration: "none" }}
      >
        <span
          className="flex items-center justify-center rounded-lg shrink-0"
          style={{ width: 28, height: 28, background: "var(--cs-accent)" }}
        >
          <HardHat className="h-3.5 w-3.5 text-white" />
        </span>
        <span
          className="font-syne"
          style={{ fontWeight: 800, fontSize: 14, color: "var(--cs-text)", letterSpacing: "-0.02em" }}
        >
          ConstruSheet
        </span>
      </Link>

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5 px-2">
        <NavItem
          href="/dashboard"
          icon={Home}
          label={isEs ? "Inicio" : "Dashboard"}
          active={pathname === "/dashboard"}
          onClick={() => setMobileOpen(false)}
        />
        <NavItem
          href="/rollup"
          icon={LayoutDashboard}
          label={isEs ? "Vista General" : "Overview"}
          active={pathname === "/rollup"}
          onClick={() => setMobileOpen(false)}
        />
      </nav>

      {/* Divider */}
      <div className="mx-3 my-2" style={{ height: 0.5, background: "var(--cs-border)" }} />

      {/* Projects section */}
      <div
        className="font-dm-sans"
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--cs-muted)",
          padding: "6px 16px 6px",
          fontWeight: 600,
        }}
      >
        {isEs ? "Proyectos" : "Projects"}
      </div>

      {/* Scrollable projects list */}
      <div className="flex-1 overflow-y-auto scrollbar-none flex flex-col gap-0.5 px-2">
        {projects.map((p) => {
          const isActive = p.id === activeProjectId;
          return (
            <Link
              key={p.id}
              href={`/project/${p.id}`}
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 shrink-0"
              style={{
                height: 36,
                padding: "0 12px",
                borderRadius: 6,
                margin: "1px 0",
                fontSize: 13,
                fontFamily: "var(--font-dm-sans)",
                textDecoration: "none",
                cursor: "pointer",
                transition: "background 150ms",
                borderLeft: isActive ? "2px solid #f97316" : "2px solid transparent",
                background: isActive ? "rgba(249,115,22,0.1)" : "transparent",
                color: isActive ? "var(--cs-text)" : "var(--cs-muted)",
                fontWeight: isActive ? 600 : 400,
              }}
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget as HTMLAnchorElement).style.background = "var(--cs-bg2, rgba(255,255,255,0.04))";
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
              }}
            >
              <Building2
                className="h-4 w-4 shrink-0"
                style={{ color: isActive ? "#f97316" : "var(--cs-muted)" }}
              />
              <span className="truncate flex-1">{p.name}</span>
              <span
                className="shrink-0 rounded-full"
                style={{
                  width: 6,
                  height: 6,
                  background: p.status === "active" ? "#22c55e" : "var(--cs-muted)",
                  opacity: p.status === "active" ? 1 : 0.4,
                }}
              />
            </Link>
          );
        })}
        {projects.length === 0 && (
          <span
            className="font-dm-sans text-center py-4"
            style={{ fontSize: 12, color: "var(--cs-muted)", opacity: 0.6 }}
          >
            {isEs ? "Sin proyectos" : "No projects"}
          </span>
        )}
      </div>

      {/* Bottom section */}
      <div
        className="shrink-0 flex flex-col gap-1 px-2 pb-3 pt-2"
        style={{ borderTop: "0.5px solid var(--cs-border)" }}
      >
        {/* User info */}
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span
            className="flex items-center justify-center rounded-full shrink-0 text-xs font-bold"
            style={{
              width: 26,
              height: 26,
              background: "rgba(249,115,22,0.15)",
              color: "#f97316",
              fontFamily: "var(--font-dm-sans)",
            }}
          >
            {displayInitial}
          </span>
          <div className="flex flex-col min-w-0">
            <span className="flex items-center gap-1.5">
              <span
                className="font-dm-sans truncate"
                style={{ fontSize: 12, fontWeight: 500, color: "var(--cs-text)" }}
              >
                {displayName}
              </span>
              {isPro ? (
                <span
                  className="inline-flex items-center gap-0.5 rounded px-1.5 py-px text-[9px] font-bold font-dm-sans shrink-0"
                  style={{ background: "rgba(249,115,22,0.15)", color: "#f97316" }}
                >
                  <Crown className="h-2.5 w-2.5" /> PRO
                </span>
              ) : (
                <Link
                  href="/pricing"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex items-center rounded px-1.5 py-px text-[9px] font-bold font-dm-sans shrink-0"
                  style={{ background: "rgba(255,255,255,0.06)", color: "var(--cs-muted)", textDecoration: "none" }}
                >
                  FREE
                </Link>
              )}
            </span>
            <span
              className="font-dm-sans truncate"
              style={{ fontSize: 10, color: "var(--cs-muted)" }}
            >
              {userEmail}
            </span>
          </div>
        </div>

        {/* Settings + Logout */}
        <div className="flex gap-1">
          <NavItem
            href="/settings"
            icon={Settings}
            label={isEs ? "Ajustes" : "Settings"}
            active={pathname === "/settings"}
            onClick={() => setMobileOpen(false)}
            compact
          />
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 flex-1 rounded-md px-2 py-1.5 font-dm-sans"
            style={{
              fontSize: 12,
              border: "none",
              background: "transparent",
              color: "var(--cs-muted)",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--cs-bg2, rgba(255,255,255,0.04))";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
          >
            <LogOut className="h-3.5 w-3.5" />
            {isEs ? "Salir" : "Log out"}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar — static flex child, not fixed */}
      <aside
        className="hidden md:flex flex-col shrink-0 overflow-y-auto h-full"
        style={{
          width: 220,
          background: "var(--cs-surface)",
          borderRight: "0.5px solid var(--cs-border)",
        }}
      >
        {sidebarInner}
      </aside>

      {/* Mobile hamburger button */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-50 flex items-center justify-center rounded-lg md:hidden"
        style={{
          width: 34,
          height: 34,
          border: "1px solid var(--cs-border)",
          background: "var(--cs-surface)",
          color: "var(--cs-muted)",
          cursor: "pointer",
        }}
        aria-label="Open menu"
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* Mobile overlay sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.5)" }}
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="relative flex flex-col h-full overflow-y-auto"
            style={{
              width: 220,
              background: "var(--cs-surface)",
              borderRight: "0.5px solid var(--cs-border)",
            }}
          >
            {sidebarInner}
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3"
              style={{ background: "none", border: "none", color: "var(--cs-muted)", cursor: "pointer" }}
            >
              <X className="h-4 w-4" />
            </button>
          </aside>
        </div>
      )}
    </>
  );
}

function NavItem({
  href,
  icon: Icon,
  label,
  active,
  onClick,
  compact,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick?: () => void;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-2 rounded-md font-dm-sans ${compact ? "flex-1 px-2 py-1.5" : "px-3 py-2"}`}
      style={{
        fontSize: compact ? 12 : 13,
        textDecoration: "none",
        color: active ? "var(--cs-text)" : "var(--cs-muted)",
        background: active ? "var(--cs-bg2, rgba(255,255,255,0.06))" : "transparent",
        fontWeight: active ? 500 : 400,
        transition: "background 150ms",
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLAnchorElement).style.background = "var(--cs-bg2, rgba(255,255,255,0.04))";
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
      }}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}
