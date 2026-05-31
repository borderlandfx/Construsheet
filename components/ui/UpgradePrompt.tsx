"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import type { Locale } from "@/lib/utils/i18n";

interface UpgradePromptProps {
  feature: string;
  description: string;
  lang: Locale;
  onClose: () => void;
}

export default function UpgradePrompt({ feature, description, lang, onClose }: UpgradePromptProps) {
  const isEs = lang === "es";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full flex flex-col items-center text-center gap-5"
        style={{
          maxWidth: 400,
          background: "var(--cs-surface)",
          border: "1px solid var(--cs-border)",
          borderRadius: 16,
          padding: "2rem 1.75rem",
          boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Gradient glow */}
        <div
          style={{
            position: "absolute",
            top: -60,
            left: "50%",
            transform: "translateX(-50%)",
            width: 200,
            height: 200,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(249,115,22,0.12) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* Lock icon */}
        <div
          className="flex items-center justify-center rounded-2xl"
          style={{
            width: 56,
            height: 56,
            background: "rgba(249,115,22,0.1)",
            border: "1px solid rgba(249,115,22,0.2)",
          }}
        >
          <Lock className="h-6 w-6" style={{ color: "#f97316" }} />
        </div>

        {/* Feature name */}
        <div>
          <h3 className="font-syne font-bold text-lg" style={{ color: "var(--cs-text)" }}>
            {feature}
          </h3>
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold font-dm-sans mt-2"
            style={{ background: "rgba(249,115,22,0.12)", color: "#f97316" }}
          >
            PRO
          </span>
        </div>

        {/* Description */}
        <p className="font-dm-sans text-sm" style={{ color: "var(--cs-muted)", lineHeight: 1.6, maxWidth: 320 }}>
          {description}
        </p>

        {/* Buttons */}
        <div className="flex items-center gap-3 w-full" style={{ maxWidth: 300 }}>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium font-dm-sans"
            style={{
              border: "1px solid var(--cs-border)",
              background: "transparent",
              color: "var(--cs-muted)",
              cursor: "pointer",
            }}
          >
            {isEs ? "Ahora no" : "Not now"}
          </button>
          <Link
            href="/pricing"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold font-dm-sans text-center"
            style={{
              background: "#f97316",
              color: "#fff",
              textDecoration: "none",
              border: "none",
            }}
          >
            {isEs ? "Ver planes" : "See plans"}
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Small lock icon to show next to gated feature buttons */
export function LockBadge() {
  return (
    <Lock
      className="h-2.5 w-2.5 ml-0.5 opacity-50"
      style={{ color: "var(--cs-muted)" }}
    />
  );
}
