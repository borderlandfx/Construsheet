"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Lang = "es" | "en";

const LABELS: Record<Lang, {
  back: string; title: string; subtitle: string;
  newPassword: string; confirmPassword: string;
  placeholder: string; submit: string; loading: string;
  verifying: string; doneTitle: string; doneDesc: string;
  mismatch: string; tooShort: string;
}> = {
  es: {
    back:            "Volver al inicio de sesión",
    title:           "Nueva contraseña",
    subtitle:        "Elige una contraseña nueva de al menos 8 caracteres.",
    newPassword:     "Nueva contraseña",
    confirmPassword: "Confirmar contraseña",
    placeholder:     "Mínimo 8 caracteres",
    submit:          "Actualizar contraseña",
    loading:         "Actualizando…",
    verifying:       "Verificando enlace…",
    doneTitle:       "Contraseña actualizada",
    doneDesc:        "Redirigiendo al panel de proyectos…",
    mismatch:        "Las contraseñas no coinciden.",
    tooShort:        "La contraseña debe tener al menos 8 caracteres.",
  },
  en: {
    back:            "Back to sign in",
    title:           "New password",
    subtitle:        "Choose a new password with at least 8 characters.",
    newPassword:     "New password",
    confirmPassword: "Confirm password",
    placeholder:     "Minimum 8 characters",
    submit:          "Update password",
    loading:         "Updating…",
    verifying:       "Verifying link…",
    doneTitle:       "Password updated",
    doneDesc:        "Redirecting to your dashboard…",
    mismatch:        "Passwords do not match.",
    tooShort:        "Password must be at least 8 characters.",
  },
};

export default function ResetPasswordPage() {
  const router  = useRouter();
  const [lang, setLang]           = useState<Lang>("es");
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [done, setDone]           = useState(false);
  const [error, setError]         = useState("");
  const [sessionReady, setSessionReady] = useState(false);

  const lbl = LABELS[lang];

  // Supabase sends the recovery token in the URL hash.
  // The client SDK converts it to a session automatically when we call getSession.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSessionReady(true);
    });

    // Listen for the PASSWORD_RECOVERY event emitted after the hash is parsed
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setSessionReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError(lbl.mismatch); return; }
    if (password.length < 8)  { setError(lbl.tooShort); return; }

    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (err) { setError(err.message); return; }
    setDone(true);
    setTimeout(() => router.push("/dashboard"), 2500);
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
          {done ? (
            <div className="flex flex-col items-center text-center gap-4 py-4">
              <div className="flex items-center justify-center rounded-full" style={{ width: 56, height: 56, background: "rgba(34,197,94,0.1)" }}>
                <CheckCircle className="h-6 w-6" style={{ color: "#22c55e" }} />
              </div>
              <div>
                <h2 className="font-syne font-bold text-lg mb-1" style={{ color: "var(--cs-text)" }}>
                  {lbl.doneTitle}
                </h2>
                <p className="text-sm font-dm-sans" style={{ color: "var(--cs-muted)" }}>
                  {lbl.doneDesc}
                </p>
              </div>
            </div>
          ) : !sessionReady ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--cs-muted)" }} />
              <p className="text-sm font-dm-sans" style={{ color: "var(--cs-muted)" }}>{lbl.verifying}</p>
            </div>
          ) : (
            <>
              <h1 className="font-syne font-bold text-lg mb-2" style={{ color: "var(--cs-text)" }}>
                {lbl.title}
              </h1>
              <p className="text-sm font-dm-sans mb-6" style={{ color: "var(--cs-muted)" }}>
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
                    {lbl.newPassword}
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={lbl.placeholder}
                    required
                    minLength={8}
                    autoFocus
                    autoComplete="new-password"
                    style={fieldStyle}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "var(--cs-accent)")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "var(--cs-border)")}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5 font-dm-sans" style={{ color: "var(--cs-text)" }}>
                    {lbl.confirmPassword}
                  </label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                    style={fieldStyle}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "var(--cs-accent)")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "var(--cs-border)")}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !password || !confirm}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold font-dm-sans flex items-center justify-center gap-2 mt-1"
                  style={{
                    background: "var(--cs-accent)", color: "#fff", border: "none",
                    cursor: loading || !password || !confirm ? "not-allowed" : "pointer",
                    opacity: loading || !password || !confirm ? 0.6 : 1,
                  }}
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? lbl.loading : lbl.submit}
                </button>
              </form>

              <p className="mt-5 text-center text-sm font-dm-sans" style={{ color: "var(--cs-muted)" }}>
                <Link href="/auth/login" className="transition-opacity hover:opacity-70" style={{ color: "var(--cs-accent)", textDecoration: "none" }}>
                  {lbl.back}
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
