"use client";

import { useState } from "react";
import Link from "next/link";
import {
  HardHat, Table2, BarChart3, GanttChartSquare, Sparkles,
  ArrowRight, Check, ChevronRight,
} from "lucide-react";
import { t, type Locale } from "@/lib/utils/i18n";

// ─── Constants ────────────────────────────────────────────────────────────────

const CS = {
  accent: "var(--cs-accent)",
  text:   "var(--cs-text)",
  muted:  "var(--cs-muted)",
  border: "var(--cs-border)",
  surface:"var(--cs-surface)",
  bg:     "var(--cs-bg)",
} as const;

// ─── Logo ─────────────────────────────────────────────────────────────────────

function Logo({ lang }: { lang: Locale }) {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 shrink-0"
      style={{ textDecoration: "none" }}
      aria-label={`ConstruSheet — ${lang === "es" ? "inicio" : "home"}`}
    >
      <span
        className="flex items-center justify-center rounded-lg"
        style={{ width: 30, height: 30, background: CS.accent }}
      >
        <HardHat className="h-4 w-4 text-white" aria-hidden />
      </span>
      <span
        className="font-syne font-extrabold text-base hidden sm:block"
        style={{ color: CS.text, letterSpacing: "-0.02em" }}
      >
        ConstruSheet
      </span>
    </Link>
  );
}

// ─── Feature cards ────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Table2,
    color: "#60a5fa",
    keyTitle: "featureAPU" as const,
    keyDesc:  "featureAPUDesc" as const,
  },
  {
    icon: BarChart3,
    color: "#4ade80",
    keyTitle: "featureBudget" as const,
    keyDesc:  "featureBudgetDesc" as const,
  },
  {
    icon: GanttChartSquare,
    color: CS.accent,
    keyTitle: "featureGantt" as const,
    keyDesc:  "featureGanttDesc" as const,
  },
  {
    icon: Sparkles,
    color: "#f472b6",
    keyTitle: "featureAI" as const,
    keyDesc:  "featureAIDesc" as const,
  },
];

// ─── Pricing tiers ────────────────────────────────────────────────────────────

const PRICING_FREE_FEATURES = {
  es: ["3 proyectos activos", "APU con IA (10/mes)", "Cronograma Gantt", "Exportar a CSV"],
  en: ["3 active projects", "AI APU (10/month)", "Gantt schedule", "Export to CSV"],
};

const PRICING_PRO_FEATURES = {
  es: ["Proyectos ilimitados", "APU con IA ilimitado", "Reportes PDF", "Costos indirectos personalizados", "Soporte prioritario"],
  en: ["Unlimited projects", "Unlimited AI APU", "PDF reports", "Custom indirect costs", "Priority support"],
};

const PRICING_ENT_FEATURES = {
  es: ["Todo en Pro", "Multi-usuario", "API access", "Onboarding personalizado", "SLA garantizado"],
  en: ["Everything in Pro", "Multi-user", "API access", "Custom onboarding", "Guaranteed SLA"],
};

// ─── LandingPage ──────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [lang, setLang] = useState<Locale>("es");
  const L = (key: Parameters<typeof t>[0]) => t(key, lang);
  const isEs = lang === "es";

  return (
    <div style={{ background: CS.bg, color: CS.text, minHeight: "100vh" }}>

      {/* ── NAVBAR ──────────────────────────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 sm:px-8"
        style={{
          height: 60,
          background: "rgba(var(--cs-surface-rgb, 18,18,20),0.8)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: `1px solid ${CS.border}`,
        }}
      >
        <Logo lang={lang} />

        <nav className="flex items-center gap-2 sm:gap-3">
          {/* Language toggle */}
          <div
            className="flex rounded-lg overflow-hidden"
            style={{ border: `1px solid ${CS.border}` }}
          >
            {(["es", "en"] as Locale[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className="px-3 py-1 text-xs font-semibold font-dm-sans transition-all"
                style={{
                  background: lang === l ? CS.accent : "transparent",
                  color: lang === l ? "#fff" : CS.muted,
                  border: "none",
                  cursor: "pointer",
                  minWidth: 34,
                }}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>

          <Link
            href="/auth/login"
            className="hidden sm:flex items-center px-4 py-1.5 rounded-lg text-sm font-medium font-dm-sans transition-colors"
            style={{
              border: `1px solid ${CS.border}`,
              background: "transparent",
              color: CS.muted,
              textDecoration: "none",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = CS.text)}
            onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = CS.muted)}
          >
            {L("login")}
          </Link>

          <Link
            href="/auth/signup"
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold font-dm-sans"
            style={{
              background: CS.accent,
              color: "#fff",
              textDecoration: "none",
            }}
          >
            {L("heroCta")}
          </Link>
        </nav>
      </header>

      {/* ── HERO ────────────────────────────────────────────── */}
      <section
        className="relative flex flex-col items-center justify-center text-center px-5"
        style={{ paddingTop: "calc(60px + 96px)", paddingBottom: 96 }}
      >
        {/* Background gradient */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(249,115,22,0.12) 0%, transparent 70%)",
          }}
        />

        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 mb-6 text-xs font-semibold font-dm-sans"
          style={{
            background: "rgba(249,115,22,0.1)",
            border: `1px solid rgba(249,115,22,0.25)`,
            color: CS.accent,
          }}
        >
          <span className="relative flex h-2 w-2">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ background: CS.accent }}
            />
            <span
              className="relative inline-flex rounded-full h-2 w-2"
              style={{ background: CS.accent }}
            />
          </span>
          {isEs ? "Ahora disponible — v0.1 Beta" : "Now available — v0.1 Beta"}
        </div>

        <h1
          className="font-syne font-extrabold max-w-3xl"
          style={{
            fontSize: "clamp(2rem, 5vw, 3.5rem)",
            lineHeight: 1.1,
            letterSpacing: "-0.035em",
            color: CS.text,
          }}
        >
          {L("heroHeadline")}
        </h1>

        <p
          className="mt-5 max-w-xl font-dm-sans"
          style={{ fontSize: "clamp(0.9rem, 2vw, 1.125rem)", color: CS.muted, lineHeight: 1.7 }}
        >
          {L("heroSub")}
        </p>

        <div className="flex items-center gap-3 mt-8 flex-wrap justify-center">
          <Link
            href="/auth/signup"
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-base font-semibold font-dm-sans"
            style={{ background: CS.accent, color: "#fff", textDecoration: "none" }}
          >
            {L("heroCta")}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/auth/login"
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-base font-medium font-dm-sans"
            style={{
              border: `1px solid ${CS.border}`,
              background: "transparent",
              color: CS.muted,
              textDecoration: "none",
            }}
          >
            {L("login")}
          </Link>
        </div>

        {/* Social proof */}
        <p className="mt-6 text-xs font-dm-sans" style={{ color: CS.muted }}>
          {isEs
            ? "Sin tarjeta de crédito · Cancela cuando quieras"
            : "No credit card required · Cancel anytime"}
        </p>
      </section>

      {/* ── FEATURES ────────────────────────────────────────── */}
      <section
        id="features"
        className="px-5 sm:px-8"
        style={{ paddingBottom: 96 }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          {/* Section header */}
          <div className="text-center mb-12">
            <h2
              className="font-syne font-bold"
              style={{ fontSize: "clamp(1.5rem, 3.5vw, 2.25rem)", letterSpacing: "-0.025em", color: CS.text }}
            >
              {L("featuresTitle")}
            </h2>
            <p
              className="mt-3 font-dm-sans max-w-xl mx-auto"
              style={{ fontSize: "0.9375rem", color: CS.muted, lineHeight: 1.65 }}
            >
              {L("featuresSub")}
            </p>
          </div>

          {/* Cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(({ icon: Icon, color, keyTitle, keyDesc }) => (
              <div
                key={keyTitle}
                className="flex flex-col gap-4 rounded-2xl p-6"
                style={{
                  background: CS.surface,
                  border: `1px solid ${CS.border}`,
                  transition: "border-color 0.2s",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = color)}
                onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = CS.border)}
              >
                <div
                  className="flex items-center justify-center rounded-xl"
                  style={{ width: 44, height: 44, background: `${color}18`, flexShrink: 0 }}
                >
                  <Icon className="h-5 w-5" style={{ color }} />
                </div>
                <div>
                  <h3
                    className="font-syne font-bold text-base mb-1.5"
                    style={{ color: CS.text }}
                  >
                    {L(keyTitle)}
                  </h3>
                  <p
                    className="font-dm-sans text-sm"
                    style={{ color: CS.muted, lineHeight: 1.6 }}
                  >
                    {L(keyDesc)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ─────────────────────────────────────────── */}
      <section
        id="pricing"
        className="px-5 sm:px-8"
        style={{ paddingBottom: 96 }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          {/* Section header */}
          <div className="text-center mb-12">
            <h2
              className="font-syne font-bold"
              style={{ fontSize: "clamp(1.5rem, 3.5vw, 2.25rem)", letterSpacing: "-0.025em", color: CS.text }}
            >
              {L("pricingTitle")}
            </h2>
            <p
              className="mt-3 font-dm-sans"
              style={{ fontSize: "0.9375rem", color: CS.muted }}
            >
              {L("pricingSub")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
            {/* Free */}
            <PricingCard
              title={L("pricingFreeTitle")}
              desc={L("pricingFreeDesc")}
              price={L("pricingFreePrice")}
              period={L("pricingFreePerMonth")}
              features={isEs ? PRICING_FREE_FEATURES.es : PRICING_FREE_FEATURES.en}
              ctaLabel={L("pricingCta")}
              ctaHref="/auth/signup"
              highlight={false}
            />

            {/* Pro */}
            <PricingCard
              title={L("pricingProTitle")}
              desc={L("pricingProDesc")}
              price={L("pricingProPrice")}
              period={L("pricingFreePerMonth")}
              features={isEs ? PRICING_PRO_FEATURES.es : PRICING_PRO_FEATURES.en}
              ctaLabel={L("pricingCta")}
              ctaHref="/auth/signup"
              highlight
              badge={L("pricingMostPop")}
            />

            {/* Enterprise */}
            <PricingCard
              title={L("pricingEntTitle")}
              desc={L("pricingEntDesc")}
              price={L("pricingEntPrice")}
              features={isEs ? PRICING_ENT_FEATURES.es : PRICING_ENT_FEATURES.en}
              ctaLabel={L("pricingContactUs")}
              ctaHref="mailto:hola@construsheet.com"
              highlight={false}
            />
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <footer
        className="px-5 sm:px-8 py-12"
        style={{ borderTop: `1px solid ${CS.border}` }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="flex flex-col sm:flex-row items-start justify-between gap-8 mb-10">
            {/* Brand */}
            <div className="max-w-xs">
              <Logo lang={lang} />
              <p
                className="mt-3 text-sm font-dm-sans"
                style={{ color: CS.muted, lineHeight: 1.65 }}
              >
                {L("footerTagline")}
              </p>
            </div>

            {/* Link columns */}
            <div className="grid grid-cols-3 gap-8 text-sm font-dm-sans">
              <FooterCol title={L("footerProduct")} links={[
                { label: L("footerFeatures"), href: "#features" },
                { label: L("footerPricing"),  href: "#pricing"  },
                { label: L("footerChangelog"), href: "#"        },
              ]} />
              <FooterCol title={L("footerCompany")} links={[
                { label: L("footerAbout"),   href: "#" },
                { label: L("footerBlog"),    href: "#" },
                { label: L("footerCareers"), href: "#" },
              ]} />
              <FooterCol title={L("footerLegal")} links={[
                { label: L("footerPrivacy"), href: "#" },
                { label: L("footerTerms"),   href: "#" },
              ]} />
            </div>
          </div>

          {/* Bottom bar */}
          <div
            className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-6"
            style={{ borderTop: `1px solid ${CS.border}` }}
          >
            <p className="text-xs font-dm-sans" style={{ color: CS.muted }}>
              {L("footerCopyright").replace("{year}", String(new Date().getFullYear()))}
            </p>
            <div className="flex items-center gap-1 text-xs font-dm-sans" style={{ color: CS.muted }}>
              {isEs ? "Hecho con" : "Made with"}
              <span style={{ color: "#ef4444" }}>♥</span>
              {isEs ? "para la construcción latinoamericana" : "for Latin American construction"}
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}

// ─── PricingCard ──────────────────────────────────────────────────────────────

function PricingCard({
  title, desc, price, period, features,
  ctaLabel, ctaHref, highlight, badge,
}: {
  title: string;
  desc: string;
  price: string;
  period?: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  highlight: boolean;
  badge?: string;
}) {
  return (
    <div
      className="relative flex flex-col rounded-2xl p-7"
      style={{
        background: highlight ? "rgba(249,115,22,0.05)" : CS.surface,
        border: highlight ? "1.5px solid rgba(249,115,22,0.45)" : `1px solid ${CS.border}`,
        boxShadow: highlight ? "0 0 40px rgba(249,115,22,0.1)" : "none",
      }}
    >
      {badge && (
        <div
          className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full text-xs font-semibold font-dm-sans"
          style={{ background: CS.accent, color: "#fff" }}
        >
          {badge}
        </div>
      )}

      <p className="font-syne font-bold text-base mb-1" style={{ color: CS.text }}>{title}</p>
      <p className="text-xs font-dm-sans mb-5" style={{ color: CS.muted }}>{desc}</p>

      <div className="flex items-baseline gap-1 mb-6">
        <span className="font-syne font-extrabold text-4xl" style={{ color: highlight ? CS.accent : CS.text }}>
          {price}
        </span>
        {period && (
          <span className="font-dm-sans text-sm" style={{ color: CS.muted }}>{period}</span>
        )}
      </div>

      <ul className="flex flex-col gap-2.5 mb-7">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <Check
              className="h-4 w-4 shrink-0 mt-0.5"
              style={{ color: highlight ? CS.accent : "#4ade80" }}
            />
            <span className="text-sm font-dm-sans" style={{ color: CS.muted }}>{f}</span>
          </li>
        ))}
      </ul>

      <Link
        href={ctaHref}
        className="mt-auto flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold font-dm-sans"
        style={{
          background: highlight ? CS.accent : "transparent",
          color: highlight ? "#fff" : CS.text,
          border: highlight ? "none" : `1px solid ${CS.border}`,
          textDecoration: "none",
        }}
      >
        {ctaLabel}
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

// ─── FooterCol ────────────────────────────────────────────────────────────────

function FooterCol({ title, links }: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <p className="font-semibold mb-3" style={{ color: CS.text }}>{title}</p>
      <ul className="flex flex-col gap-2">
        {links.map(({ label, href }) => (
          <li key={label}>
            <Link
              href={href}
              className="transition-opacity hover:opacity-70"
              style={{ color: CS.muted, textDecoration: "none" }}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
