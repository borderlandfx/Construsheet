"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Lang = "es" | "en";

const LABELS: Record<Lang, { title: string; subtitle: string; fullName: string; email: string; password: string; confirm: string; langLabel: string; submit: string; hasAccount: string; login: string; minChars: string; mismatch: string; checkEmail: string }> = {
  es: {
    title: "Crear cuenta",
    subtitle: "Empieza a gestionar tus proyectos",
    fullName: "Nombre completo",
    email: "Correo electrónico",
    password: "Contraseña",
    confirm: "Confirmar contraseña",
    langLabel: "Idioma preferido",
    submit: "Crear cuenta",
    hasAccount: "¿Ya tienes cuenta?",
    login: "Inicia sesión",
    minChars: "Mínimo 8 caracteres",
    mismatch: "Las contraseñas no coinciden",
    checkEmail: "Revisa tu correo para confirmar tu cuenta antes de iniciar sesión.",
  },
  en: {
    title: "Create account",
    subtitle: "Start managing your projects",
    fullName: "Full name",
    email: "Email address",
    password: "Password",
    confirm: "Confirm password",
    langLabel: "Preferred language",
    submit: "Create account",
    hasAccount: "Already have an account?",
    login: "Sign in",
    minChars: "Minimum 8 characters",
    mismatch: "Passwords do not match",
    checkEmail: "Check your email to confirm your account before signing in.",
  },
};

export default function SignupPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>("es");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const t = LABELS[lang];

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (password !== confirm) {
      setError(t.mismatch);
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, language: lang },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signupError) {
      setLoading(false);
      setError(signupError.message);
      return;
    }

    // If session is immediately available (email confirmation disabled), set
    // language preference then redirect. Otherwise show email confirmation message.
    if (data.session && data.user) {
      if (lang !== "es") {
        await supabase
          .from("profiles")
          .update({ language: lang })
          .eq("id", data.user.id);
      }
      router.push("/dashboard");
      router.refresh();
      return;
    }

    setLoading(false);
    setMessage(t.checkEmail);
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: "var(--cs-bg)" }}
    >
      <div className="w-full max-w-[420px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span style={{ color: "var(--cs-accent)", fontSize: "1.75rem", lineHeight: 1 }}>
              ⬡
            </span>
            <span
              className="text-2xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-syne)", color: "var(--cs-text)" }}
            >
              ConstruSheet
            </span>
          </div>
          <p className="text-sm" style={{ color: "var(--cs-muted)" }}>
            {t.subtitle}
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: "var(--cs-surface)",
            border: "1px solid var(--cs-border)",
          }}
        >
          <h1
            className="text-lg font-bold mb-6"
            style={{ fontFamily: "var(--font-syne)", color: "var(--cs-text)" }}
          >
            {t.title}
          </h1>

          {/* Error */}
          {error && (
            <div
              className="mb-5 px-4 py-3 rounded-lg text-sm"
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#f87171",
              }}
            >
              {error}
            </div>
          )}

          {/* Email confirmation message */}
          {message && (
            <div
              className="mb-5 px-4 py-3 rounded-lg text-sm"
              style={{
                background: "rgba(249, 115, 22, 0.1)",
                border: "1px solid rgba(249, 115, 22, 0.3)",
                color: "var(--cs-accent)",
              }}
            >
              {message}
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">
            {/* Full name */}
            <Field
              id="fullName"
              label={t.fullName}
              type="text"
              value={fullName}
              onChange={setFullName}
              placeholder="Ana García"
              autoComplete="name"
              required
            />

            {/* Email */}
            <Field
              id="email"
              label={t.email}
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="tu@email.com"
              autoComplete="email"
              required
            />

            {/* Password */}
            <Field
              id="password"
              label={t.password}
              type="password"
              value={password}
              onChange={setPassword}
              placeholder={t.minChars}
              autoComplete="new-password"
              minLength={8}
              required
            />

            {/* Confirm password */}
            <Field
              id="confirm"
              label={t.confirm}
              type="password"
              value={confirm}
              onChange={setConfirm}
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />

            {/* Language toggle */}
            <div className="space-y-1.5">
              <span
                className="block text-sm font-medium"
                style={{ color: "var(--cs-text)" }}
              >
                {t.langLabel}
              </span>
              <div
                className="flex rounded-lg overflow-hidden"
                style={{ border: "1px solid var(--cs-border)" }}
              >
                {(["es", "en"] as Lang[]).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLang(l)}
                    className="flex-1 py-2 text-sm font-medium transition-colors"
                    style={{
                      background: lang === l ? "var(--cs-accent)" : "transparent",
                      color: lang === l ? "#ffffff" : "var(--cs-muted)",
                      borderRight: l === "es" ? "1px solid var(--cs-border)" : undefined,
                    }}
                  >
                    {l === "es" ? "🇲🇽  Español" : "🇺🇸  English"}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
              style={{ background: "var(--cs-accent)", color: "#ffffff" }}
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {t.submit}
            </button>
          </form>

          <p
            className="mt-6 text-center text-sm"
            style={{ color: "var(--cs-muted)" }}
          >
            {t.hasAccount}{" "}
            <Link
              href="/auth/login"
              className="font-medium transition-opacity hover:opacity-70"
              style={{ color: "var(--cs-accent)" }}
            >
              {t.login}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reusable field
// ---------------------------------------------------------------------------
function Field({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
  minLength,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-sm font-medium"
        style={{ color: "var(--cs-text)" }}
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none transition-colors"
        style={{
          background: "var(--cs-bg)",
          border: "1px solid var(--cs-border)",
          color: "var(--cs-text)",
        }}
        onFocus={(e) =>
          (e.currentTarget.style.borderColor = "var(--cs-accent)")
        }
        onBlur={(e) =>
          (e.currentTarget.style.borderColor = "var(--cs-border)")
        }
      />
    </div>
  );
}
