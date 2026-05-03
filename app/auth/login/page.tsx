"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { t as translate } from "@/lib/utils/i18n";

type Lang = "es" | "en";

const LABELS: Record<Lang, {
  subtitle: string; emailLabel: string; passwordLabel: string;
  forgotPassword: string; submit: string; or: string;
  googleCta: string; noAccount: string; signup: string;
}> = {
  es: {
    subtitle:       "Inicia sesión en tu cuenta",
    emailLabel:     "Correo electrónico",
    passwordLabel:  "Contraseña",
    forgotPassword: "¿Olvidaste tu contraseña?",
    submit:         "Iniciar sesión",
    or:             "o continúa con",
    googleCta:      "Continuar con Google",
    noAccount:      "¿No tienes cuenta?",
    signup:         "Regístrate gratis",
  },
  en: {
    subtitle:       "Sign in to your account",
    emailLabel:     "Email address",
    passwordLabel:  "Password",
    forgotPassword: "Forgot password?",
    submit:         "Sign in",
    or:             "or continue with",
    googleCta:      "Continue with Google",
    noAccount:      "Don't have an account?",
    signup:         "Sign up free",
  },
};

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [lang, setLang]               = useState<Lang>("es");
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [error, setError]             = useState(() => {
    const e = searchParams.get("error");
    return e ? (e === "auth_failed" ? translate("authFailed", "es") : decodeURIComponent(e)) : "";
  });
  const [loading, setLoading]         = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Pick up any error injected by the OAuth callback redirect, translating known codes
  useEffect(() => {
    const e = searchParams.get("error");
    if (e) setError(e === "auth_failed" ? translate("authFailed", lang) : decodeURIComponent(e));
  }, [searchParams, lang]);

  const t = LABELS[lang];

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) { setError(err.message); return; }
    router.push("/dashboard");
    router.refresh();
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    // navigation happens via OAuth redirect
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "0.625rem 0.875rem", borderRadius: 8,
    border: "1px solid var(--cs-border)", background: "var(--cs-bg)",
    color: "var(--cs-text)", fontSize: "0.875rem", outline: "none",
    fontFamily: "var(--font-dm-sans)",
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--cs-bg)" }}
    >
      <div className="w-full max-w-[420px]">
        {/* Logo + lang toggle */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <span style={{ color: "var(--cs-accent)", fontSize: "1.75rem", lineHeight: 1 }}>⬡</span>
            <span
              className="text-2xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-syne)", color: "var(--cs-text)" }}
            >
              ConstruSheet
            </span>
          </div>
          {/* Language toggle */}
          <div
            className="flex rounded-lg overflow-hidden"
            style={{ border: "1px solid var(--cs-border)" }}
          >
            {(["es", "en"] as Lang[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className="px-3 py-1 text-xs font-semibold font-dm-sans transition-all"
                style={{
                  background: lang === l ? "var(--cs-accent)" : "transparent",
                  color: lang === l ? "#fff" : "var(--cs-muted)",
                  border: "none",
                  cursor: "pointer",
                  minWidth: 34,
                }}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <p className="text-sm font-dm-sans mb-6 text-center" style={{ color: "var(--cs-muted)" }}>
          {t.subtitle}
        </p>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{ background: "var(--cs-surface)", border: "1px solid var(--cs-border)" }}
        >
          {error && (
            <div
              className="mb-5 px-4 py-3 rounded-lg text-sm font-dm-sans"
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#f87171",
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-sm font-medium font-dm-sans"
                style={{ color: "var(--cs-text)" }}
              >
                {t.emailLabel}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                autoComplete="email"
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--cs-accent)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--cs-border)")}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium font-dm-sans"
                  style={{ color: "var(--cs-text)" }}
                >
                  {t.passwordLabel}
                </label>
                <Link
                  href="/auth/forgot-password"
                  className="text-xs font-dm-sans transition-opacity hover:opacity-70"
                  style={{ color: "var(--cs-accent)" }}
                >
                  {t.forgotPassword}
                </Link>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--cs-accent)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--cs-border)")}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold font-dm-sans flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: "var(--cs-accent)", color: "#fff", border: "none", cursor: loading ? "not-allowed" : "pointer" }}
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {t.submit}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <div className="w-full" style={{ borderTop: "1px solid var(--cs-border)" }} />
            </div>
            <div className="relative flex justify-center">
              <span
                className="px-3 text-xs font-dm-sans"
                style={{ background: "var(--cs-surface)", color: "var(--cs-muted)" }}
              >
                {t.or}
              </span>
            </div>
          </div>

          {/* Google OAuth */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full py-2.5 rounded-lg text-sm font-medium font-dm-sans flex items-center justify-center gap-2.5 disabled:opacity-60"
            style={{
              background: "transparent",
              border: "1px solid var(--cs-border)",
              color: "var(--cs-text)",
              cursor: googleLoading ? "not-allowed" : "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--cs-accent)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--cs-border)")}
          >
            {googleLoading ? <Loader2 size={15} className="animate-spin" /> : <GoogleIcon />}
            {t.googleCta}
          </button>

          <p className="mt-6 text-center text-sm font-dm-sans" style={{ color: "var(--cs-muted)" }}>
            {t.noAccount}{" "}
            <Link
              href="/auth/signup"
              className="font-medium transition-opacity hover:opacity-70"
              style={{ color: "var(--cs-accent)" }}
            >
              {t.signup}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M15.68 8.18c0-.57-.05-1.11-.14-1.64H8v3.1h4.3a3.68 3.68 0 01-1.6 2.42v2h2.59c1.52-1.4 2.39-3.46 2.39-5.88z" fill="#4285F4" />
      <path d="M8 16c2.16 0 3.97-.72 5.29-1.94l-2.59-2a4.8 4.8 0 01-2.7.75 4.8 4.8 0 01-4.52-3.32H.81v2.07A8 8 0 008 16z" fill="#34A853" />
      <path d="M3.48 9.49A4.83 4.83 0 013.23 8c0-.52.09-1.02.25-1.49V4.44H.81A8 8 0 000 8c0 1.29.31 2.51.81 3.56l2.67-2.07z" fill="#FBBC05" />
      <path d="M8 3.2a4.34 4.34 0 013.07 1.2l2.3-2.3A7.72 7.72 0 008 0 8 8 0 00.81 4.44l2.67 2.07A4.8 4.8 0 018 3.2z" fill="#EA4335" />
    </svg>
  );
}
