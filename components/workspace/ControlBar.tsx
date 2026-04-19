"use client";

import { useState } from "react";
import { UserPlus, X, Mail } from "lucide-react";
import { useWorkspace } from "@/lib/context/WorkspaceContext";
import { t } from "@/lib/utils/i18n";
import type { Currency } from "@/lib/utils/currency";
import type { Locale } from "@/lib/utils/i18n";

interface PillToggleProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}

function PillToggle<T extends string>({ options, value, onChange }: PillToggleProps<T>) {
  return (
    <div
      className="inline-flex rounded-lg overflow-hidden"
      style={{ border: "1px solid var(--cs-border)", background: "rgba(255,255,255,0.03)" }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className="px-3 py-1 text-xs font-semibold font-dm-sans transition-all duration-150"
            style={{
              background: active ? "var(--cs-accent)" : "transparent",
              color: active ? "#fff" : "var(--cs-muted)",
              border: "none",
              cursor: "pointer",
              minWidth: 36,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function Avatar({ letter, color }: { letter: string; color: string }) {
  return (
    <div
      className="inline-flex items-center justify-center rounded-full text-xs font-bold font-dm-sans text-white"
      style={{
        width: 28,
        height: 28,
        background: color,
        marginLeft: -6,
        border: "2px solid var(--cs-surface)",
        flexShrink: 0,
      }}
    >
      {letter.toUpperCase()}
    </div>
  );
}

const AVATAR_COLORS = ["#f97316", "#22c55e", "#3b82f6", "#a855f7", "#ef4444"];

interface ControlBarProps {
  userEmail: string;
  userInitial: string;
}

export default function ControlBar({ userEmail: _userEmail, userInitial }: ControlBarProps) {
  const { currency, unitSys, language, setCurrency, setUnitSys, setLanguage } =
    useWorkspace();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {/* Currency toggle */}
        <PillToggle<Currency>
          options={[
            { value: "USD", label: "USD" },
            { value: "MXN", label: "MXN" },
          ]}
          value={currency}
          onChange={setCurrency}
        />

        {/* Unit system toggle */}
        <PillToggle<"m" | "ft">
          options={[
            { value: "m", label: "m" },
            { value: "ft", label: "ft" },
          ]}
          value={unitSys}
          onChange={setUnitSys}
        />

        {/* Language toggle */}
        <PillToggle<Locale>
          options={[
            { value: "es", label: "ES" },
            { value: "en", label: "EN" },
          ]}
          value={language}
          onChange={setLanguage}
        />

        {/* Divider */}
        <div
          className="hidden sm:block self-stretch"
          style={{ width: 1, background: "var(--cs-border)", margin: "0 4px" }}
        />

        {/* Collaborator avatars */}
        <div className="flex items-center" style={{ paddingLeft: 6 }}>
          <Avatar letter={userInitial} color={AVATAR_COLORS[0]} />
        </div>

        {/* Invite button */}
        <button
          onClick={() => setInviteOpen(true)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold font-dm-sans transition-colors"
          style={{
            border: "1px solid var(--cs-border)",
            background: "transparent",
            color: "var(--cs-muted)",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--cs-text)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.2)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--cs-muted)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--cs-border)";
          }}
        >
          <UserPlus className="h-3.5 w-3.5" />
          {t("invite" as never, language) || "+ Invite"}
        </button>
      </div>

      {/* Invite modal */}
      {inviteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={(e) => e.target === e.currentTarget && setInviteOpen(false)}
        >
          <div
            className="w-full flex flex-col gap-5"
            style={{
              maxWidth: 400,
              background: "var(--cs-surface)",
              border: "1px solid var(--cs-border)",
              borderRadius: 16,
              padding: "1.5rem",
              boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
            }}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-syne font-bold text-base" style={{ color: "var(--cs-text)" }}>
                {language === "es" ? "Invitar colaborador" : "Invite collaborator"}
              </h3>
              <button
                onClick={() => setInviteOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--cs-muted)" }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex gap-2">
              <div
                className="flex items-center gap-2 flex-1 rounded-lg px-3"
                style={{ border: "1px solid var(--cs-border)", background: "rgba(255,255,255,0.04)" }}
              >
                <Mail className="h-4 w-4 shrink-0" style={{ color: "var(--cs-muted)" }} />
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder={language === "es" ? "correo@ejemplo.com" : "email@example.com"}
                  className="flex-1 py-2 bg-transparent text-sm font-dm-sans outline-none"
                  style={{ color: "var(--cs-text)" }}
                />
              </div>
              <button
                className="px-4 py-2 rounded-lg text-sm font-semibold font-dm-sans"
                style={{ background: "var(--cs-accent)", color: "#fff", border: "none", cursor: "pointer" }}
              >
                {language === "es" ? "Invitar" : "Invite"}
              </button>
            </div>

            <p className="text-xs font-dm-sans" style={{ color: "var(--cs-muted)" }}>
              {language === "es"
                ? "La invitación por colaboradores estará disponible próximamente."
                : "Collaborator invitations are coming soon."}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
