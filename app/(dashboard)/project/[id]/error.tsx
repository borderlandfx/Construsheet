"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ProjectError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ProjectPage Error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <div
        className="rounded-xl border p-8 max-w-md w-full"
        style={{
          background: "var(--cs-surface)",
          borderColor: "var(--cs-border)",
        }}
      >
        <h2
          className="text-lg font-bold mb-2"
          style={{ color: "var(--cs-text)" }}
        >
          Algo salió mal / Something went wrong
        </h2>
        <p
          className="text-sm mb-6"
          style={{ color: "var(--cs-muted)" }}
        >
          {error.message || "An unexpected error occurred while loading the project."}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--cs-accent)" }}
          >
            Reintentar / Retry
          </button>
          <Link
            href="/dashboard"
            className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:opacity-80"
            style={{
              borderColor: "var(--cs-border)",
              color: "var(--cs-text)",
              textDecoration: "none",
            }}
          >
            Volver al Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
