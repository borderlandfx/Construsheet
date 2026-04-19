"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    // navigation happens via OAuth redirect — no need to reset loading
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
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
            Inicia sesión en tu cuenta
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
          {/* Inline error */}
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

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-sm font-medium"
                style={{ color: "var(--cs-text)" }}
              >
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                autoComplete="email"
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

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium"
                  style={{ color: "var(--cs-text)" }}
                >
                  Contraseña
                </label>
                <Link
                  href="/auth/forgot-password"
                  className="text-xs transition-opacity hover:opacity-70"
                  style={{ color: "var(--cs-accent)" }}
                >
                  ¿Olvidaste tu contraseña?
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

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: "var(--cs-accent)", color: "#ffffff" }}
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              Iniciar sesión
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <div
                className="w-full"
                style={{ borderTop: "1px solid var(--cs-border)" }}
              />
            </div>
            <div className="relative flex justify-center">
              <span
                className="px-3 text-xs"
                style={{
                  background: "var(--cs-surface)",
                  color: "var(--cs-muted)",
                }}
              >
                o continúa con
              </span>
            </div>
          </div>

          {/* Google OAuth */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-2.5"
            style={{
              background: "transparent",
              border: "1px solid var(--cs-border)",
              color: "var(--cs-text)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.borderColor = "var(--cs-accent)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.borderColor = "var(--cs-border)")
            }
          >
            {googleLoading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            Continuar con Google
          </button>

          <p
            className="mt-6 text-center text-sm"
            style={{ color: "var(--cs-muted)" }}
          >
            ¿No tienes cuenta?{" "}
            <Link
              href="/auth/signup"
              className="font-medium transition-opacity hover:opacity-70"
              style={{ color: "var(--cs-accent)" }}
            >
              Regístrate gratis
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
      <path
        d="M15.68 8.18c0-.57-.05-1.11-.14-1.64H8v3.1h4.3a3.68 3.68 0 01-1.6 2.42v2h2.59c1.52-1.4 2.39-3.46 2.39-5.88z"
        fill="#4285F4"
      />
      <path
        d="M8 16c2.16 0 3.97-.72 5.29-1.94l-2.59-2a4.8 4.8 0 01-2.7.75 4.8 4.8 0 01-4.52-3.32H.81v2.07A8 8 0 008 16z"
        fill="#34A853"
      />
      <path
        d="M3.48 9.49A4.83 4.83 0 013.23 8c0-.52.09-1.02.25-1.49V4.44H.81A8 8 0 000 8c0 1.29.31 2.51.81 3.56l2.67-2.07z"
        fill="#FBBC05"
      />
      <path
        d="M8 3.2a4.34 4.34 0 013.07 1.2l2.3-2.3A7.72 7.72 0 008 0 8 8 0 00.81 4.44l2.67 2.07A4.8 4.8 0 018 3.2z"
        fill="#EA4335"
      />
    </svg>
  );
}
