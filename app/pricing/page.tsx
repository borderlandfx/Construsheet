"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Check, X as XIcon, HardHat } from "lucide-react";
import type { Locale } from "@/lib/utils/i18n";

export default function PricingPage() {
  const [lang, setLang] = useState<Locale>("es");
  const [yearly, setYearly] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("cs-lang") as Locale | null;
    if (saved === "en") setLang("en");
  }, []);

  const isEs = lang === "es";

  const features: { label: { es: string; en: string }; free: string; pro: string; freeCheck: boolean }[] = [
    {
      label: { es: "Proyectos", en: "Projects" },
      free: "1",
      pro: isEs ? "Ilimitados" : "Unlimited",
      freeCheck: true,
    },
    {
      label: { es: "APUs por proyecto", en: "APUs per project" },
      free: "10",
      pro: isEs ? "Ilimitados" : "Unlimited",
      freeCheck: true,
    },
    {
      label: { es: "IA para generar APUs", en: "AI APU generation" },
      free: "",
      pro: "",
      freeCheck: false,
    },
    {
      label: { es: "Exportar PDF y CSV", en: "PDF & CSV export" },
      free: "",
      pro: "",
      freeCheck: false,
    },
    {
      label: { es: "Colaboración en equipo", en: "Team collaboration" },
      free: "",
      pro: isEs ? "Hasta 5 miembros" : "Up to 5 members",
      freeCheck: false,
    },
    {
      label: { es: "Historial de cambios", en: "Version history" },
      free: "",
      pro: "",
      freeCheck: false,
    },
    {
      label: { es: "Reportes avanzados", en: "Advanced reports" },
      free: "",
      pro: isEs ? "Ejecutivo + Varianza" : "Executive + Variance",
      freeCheck: false,
    },
    {
      label: { es: "Cronograma completo", en: "Full schedule" },
      free: isEs ? "8 semanas" : "8 weeks",
      pro: isEs ? "16+ semanas" : "16+ weeks",
      freeCheck: true,
    },
  ];

  const monthlyPrice = 25;
  const yearlyPrice = 250;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#f5f5f5",
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      {/* Nav */}
      <nav
        className="flex items-center justify-between"
        style={{ padding: "16px 24px", maxWidth: 1100, margin: "0 auto" }}
      >
        <Link href="/" className="flex items-center gap-2" style={{ textDecoration: "none" }}>
          <span
            className="flex items-center justify-center rounded-lg"
            style={{ width: 28, height: 28, background: "#f97316" }}
          >
            <HardHat className="h-3.5 w-3.5 text-white" />
          </span>
          <span style={{ fontWeight: 800, fontSize: 14, color: "#f5f5f5", letterSpacing: "-0.02em" }}>
            ConstruSheet
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {/* Lang toggle */}
          <div
            className="inline-flex rounded-lg overflow-hidden"
            style={{ border: "1px solid #333" }}
          >
            {(["es", "en"] as Locale[]).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => { setLang(opt); localStorage.setItem("cs-lang", opt); }}
                className="px-3 py-1 text-xs font-semibold"
                style={{
                  background: opt === lang ? "#f97316" : "transparent",
                  color: opt === lang ? "#fff" : "#888",
                  border: "none",
                  cursor: "pointer",
                  minWidth: 36,
                }}
              >
                {opt.toUpperCase()}
              </button>
            ))}
          </div>
          <Link
            href="/auth/login"
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ border: "1px solid #333", color: "#ccc", textDecoration: "none" }}
          >
            {isEs ? "Iniciar sesión" : "Log in"}
          </Link>
        </div>
      </nav>

      {/* Header */}
      <div className="text-center" style={{ padding: "48px 24px 32px", maxWidth: 700, margin: "0 auto" }}>
        <h1
          style={{
            fontSize: 36,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.2,
            margin: "0 0 12px",
            color: "#fff",
          }}
        >
          {isEs ? "Precios simples y transparentes" : "Simple, transparent pricing"}
        </h1>
        <p style={{ fontSize: 16, color: "#888", lineHeight: 1.6, margin: 0 }}>
          {isEs
            ? "Comienza gratis. Actualiza cuando necesites más."
            : "Start free. Upgrade when you need more."}
        </p>

        {/* Monthly / Yearly toggle */}
        <div className="flex items-center justify-center gap-3 mt-6">
          <span style={{ fontSize: 13, color: !yearly ? "#fff" : "#888", fontWeight: !yearly ? 600 : 400 }}>
            {isEs ? "Mensual" : "Monthly"}
          </span>
          <button
            type="button"
            onClick={() => setYearly(!yearly)}
            style={{
              width: 44,
              height: 24,
              borderRadius: 12,
              background: yearly ? "#f97316" : "#333",
              border: "none",
              cursor: "pointer",
              position: "relative",
              transition: "background 200ms",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 3,
                left: yearly ? 23 : 3,
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "#fff",
                transition: "left 200ms",
              }}
            />
          </button>
          <span style={{ fontSize: 13, color: yearly ? "#fff" : "#888", fontWeight: yearly ? 600 : 400 }}>
            {isEs ? "Anual" : "Yearly"}
          </span>
          {yearly && (
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}
            >
              {isEs ? "Ahorra 2 meses" : "Save 2 months"}
            </span>
          )}
        </div>
      </div>

      {/* Plan cards */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
        style={{ maxWidth: 780, margin: "0 auto", padding: "0 24px 48px" }}
      >
        {/* FREE card */}
        <div
          className="flex flex-col rounded-2xl"
          style={{
            background: "#141414",
            border: "1px solid #222",
            padding: "32px 28px",
          }}
        >
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: "#fff", margin: "0 0 4px" }}>
              {isEs ? "Gratis" : "Free"}
            </h3>
            <p style={{ fontSize: 13, color: "#888", margin: 0 }}>
              {isEs ? "Para individuos y proyectos pequeños" : "For individuals and small projects"}
            </p>
          </div>
          <div style={{ marginBottom: 24 }}>
            <span style={{ fontSize: 40, fontWeight: 800, color: "#fff" }}>$0</span>
            <span style={{ fontSize: 14, color: "#888" }}> /{isEs ? "mes" : "mo"}</span>
          </div>
          <Link
            href="/auth/signup"
            className="block text-center rounded-xl py-3 text-sm font-semibold"
            style={{
              background: "#222",
              color: "#ccc",
              textDecoration: "none",
              border: "1px solid #333",
              marginBottom: 28,
            }}
          >
            {isEs ? "Comenzar gratis" : "Start free"}
          </Link>
          <div className="flex flex-col gap-3">
            {features.map((f) => (
              <div key={f.label.en} className="flex items-start gap-2.5">
                {f.freeCheck ? (
                  <Check className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#22c55e" }} />
                ) : (
                  <XIcon className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#555" }} />
                )}
                <span style={{ fontSize: 13, color: f.freeCheck ? "#ccc" : "#555" }}>
                  {f.label[lang]}{f.free ? ` (${f.free})` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* PRO card */}
        <div
          className="flex flex-col rounded-2xl"
          style={{
            background: "#141414",
            border: "2px solid #f97316",
            padding: "32px 28px",
            position: "relative",
          }}
        >
          {/* Most popular badge */}
          <span
            className="absolute rounded-full px-3 py-1 text-xs font-bold"
            style={{
              top: -12,
              left: "50%",
              transform: "translateX(-50%)",
              background: "#f97316",
              color: "#fff",
            }}
          >
            {isEs ? "Más popular" : "Most popular"}
          </span>

          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: "#fff", margin: "0 0 4px" }}>Pro</h3>
            <p style={{ fontSize: 13, color: "#888", margin: 0 }}>
              {isEs ? "Para profesionales y equipos" : "For professionals and teams"}
            </p>
          </div>
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 40, fontWeight: 800, color: "#fff" }}>
              ${yearly ? yearlyPrice : monthlyPrice}
            </span>
            <span style={{ fontSize: 14, color: "#888" }}>
              {" "}/{yearly ? (isEs ? "año" : "yr") : (isEs ? "mes" : "mo")}
            </span>
          </div>
          <p style={{ fontSize: 11, color: "#888", margin: "0 0 20px" }}>
            {isEs
              ? "14 días gratis, sin tarjeta de crédito"
              : "14 days free, no credit card required"}
          </p>
          <Link
            href="/auth/signup"
            className="block text-center rounded-xl py-3 text-sm font-semibold"
            style={{
              background: "#f97316",
              color: "#fff",
              textDecoration: "none",
              border: "none",
              marginBottom: 28,
            }}
          >
            {isEs ? "Comenzar prueba" : "Start trial"}
          </Link>
          <div className="flex flex-col gap-3">
            {features.map((f) => (
              <div key={f.label.en} className="flex items-start gap-2.5">
                <Check className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#22c55e" }} />
                <span style={{ fontSize: 13, color: "#ccc" }}>
                  {f.label[lang]}{f.pro ? ` (${f.pro})` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center" style={{ padding: "24px", borderTop: "1px solid #1a1a1a" }}>
        <p style={{ fontSize: 12, color: "#555" }}>
          {isEs
            ? "¿Preguntas? Escríbenos a soporte@construsheet.app"
            : "Questions? Email us at support@construsheet.app"}
        </p>
      </div>
    </div>
  );
}
