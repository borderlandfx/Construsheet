"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Lang = "es" | "en";

const LABELS: Record<Lang, {
  back: string; title: string; subtitle: string;
  emailLabel: string; submit: string; loading: string;
  sentTitle: string; sentDesc: string; notSeen: string; resend: string;
}> = {
  es: {
    back:       "Volver al inicio de sesión",
    title:      "¿Olvidaste tu contraseña?",
    subtitle:   "Escribe tu correo y te enviaremos un enlace para restablecer tu contraseña.",
    emailLabel: "Correo electrónico",
    submit:     "Enviar enlace de recuperación",
    loading:    "Enviando…",
    sentTitle:  "Revisa tu correo",
    sentDesc:   "Enviamos un enlace de recuperación a {email}. El enlace expira en 1 hora.",
    notSeen:    "¿No lo ves?",
    resend:     "Reenviar correo",
  },
  en: {
    back:       "Back to sign in",
    title:      "Forgot your password?",
    subtitle:   "Enter your email and we'll send you a link to reset your password.",
    emailLabel: "Email address",
    submit:     "Send reset link",
    loading:    "Sending…",
    sentTitle:  "Check your email",
    sentDesc:   "We sent a recovery link to {email}. The link expires in 1 hour.",
    notSeen:    "Didn't receive it?",
    resend:     "Resend email",
  },
};

export default function ForgotPasswordPage() {
  const [lang, setLang]     = useState<Lang>("es");
  const [email, setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent]     = useState(false);
  const [error, setError]   = useState("");

  const lbl = LABELS[lang];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setSent(true);
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%", padding: "0.625rem 0.875rem", borderRadius: 8,
    border: "1px solid var(--cs-border)", background: "var(--cs-bg)",
    color: "var(--cs-text)", fontSize: "0.875rem", outline: "none",
    fontFamily: "var(--font-dm-sans)",
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--cs-bg)" }}>
      <div className="w-full max-w-[420px]">
        {/* Logo + lang toggle */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <span style={{ color: "var(--cs-accent)", fontSize: "1.75rem", lineHeight: 1 }}>⬡</span>
            <span className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-syne)", color: "var(--cs-text)" }}>
              ConstruSheet
            </span>
          </div>
          <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--cs-border)" }}>
            {(["es", "en"] as Lang[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className="px-3 py-1 text-xs font-semibold font-dm-sans transition-all"
                style={{
                  background: lang === l ? "var(--cs-accent)" : "transparent",
                  color: lang === l ? "#fff" : "var(--cs-muted)",
                  border: "none", cursor: "pointer", minWidth: 34,
                }}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl p-8" style={{ background: "var(--cs-surface)", border: "1px solid var(--cs-border)" }}>
          {/* Back link */}
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-1.5 text-sm mb-6 transition-opacity hover:opacity-70"
            style={{ color: "var(--cs-muted)", textDecoration: "none", fontFamily: "var(--font-dm-sans)" }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {lbl.back}
          </Link>

          {sent ? (
            <div className="flex flex-col items-center text-center gap-4 py-4">
              <div className="flex items-center justify-center rounded-full" style={{ width: 56, height: 56, background: "rgba(249,115,22,0.1)" }}>
                <Mail className="h-6 w-6" style={{ color: "var(--cs-accent)" }} />
              </div>
              <div>
                <h2 className="font-syne font-bold text-lg mb-1" style={{ color: "var(--cs-text)" }}>
                  {lbl.sentTitle}
                </h2>
                <p className="text-sm font-dm-sans" style={{ color: "var(--cs-muted)", lineHeight: 1.6 }}>
                  {lbl.sentDesc.split("{email}")[0]}
                  <strong style={{ color: "var(--cs-text)" }}>{email}</strong>
                  {lbl.sentDesc.split("{email}")[1]}
                </p>
              </div>
              <p className="text-xs font-dm-sans" style={{ color: "var(--cs-muted)" }}>
                {lbl.notSeen}{" "}
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="transition-opacity hover:opacity-70"
                  style={{ color: "var(--cs-accent)", background: "none", border: "none", cursor: "pointer", fontSize: "inherit", fontFamily: "inherit" }}
                >
                  {lbl.resend}
                </button>
              </p>
            </div>
          ) : (
            <>
              <h1 className="font-syne font-bold text-lg mb-2" style={{ color: "var(--cs-text)" }}>
                {lbl.title}
              </h1>
              <p className="text-sm font-dm-sans mb-6" style={{ color: "var(--cs-muted)", lineHeight: 1.6 }}>
                {lbl.subtitle}
              </p>

              {error && (
                <div className="mb-5 px-4 py-3 rounded-lg text-sm font-dm-sans" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5 font-dm-sans" style={{ color: "var(--cs-text)" }}>
                    {lbl.emailLabel}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    required
                    autoFocus
                    autoComplete="email"
                    style={fieldStyle}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "var(--cs-accent)")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "var(--cs-border)")}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold font-dm-sans flex items-center justify-center gap-2"
                  style={{
                    background: "var(--cs-accent)", color: "#fff", border: "none",
                    cursor: loading || !email.trim() ? "not-allowed" : "pointer",
                    opacity: loading || !email.trim() ? 0.6 : 1,
                  }}
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? lbl.loading : lbl.submit}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
