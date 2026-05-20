"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export const TOOLBAR_PORTAL_ID = "cs-contextual-toolbar";

/** Toolbar container — rendered once in WorkspaceShell between TabBar and content */
export function ContextualToolbar() {
  return (
    <div
      id={TOOLBAR_PORTAL_ID}
      className="flex items-center gap-2 px-5 shrink-0"
      style={{
        height: 42,
        background: "var(--color-background-secondary)",
        borderBottom: "0.5px solid var(--color-border-tertiary)",
        fontFamily: "var(--font-dm-sans)",
        fontSize: 12,
      }}
    />
  );
}

/** Renders children into the toolbar via portal (client-only) */
export function ToolbarPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  const target = document.getElementById(TOOLBAR_PORTAL_ID);
  if (!target) return null;
  return createPortal(children, target);
}

/** Vertical separator between button groups */
export function ToolbarSep() {
  return <div style={{ width: 0.5, height: 20, background: "var(--color-border-tertiary)", flexShrink: 0 }} />;
}

/** Group label + buttons */
export function ToolbarGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          color: "var(--color-text-tertiary)",
          fontWeight: 600,
          letterSpacing: "0.04em",
          whiteSpace: "nowrap",
          marginRight: 2,
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

/* Shared base style for toolbar buttons */
const BASE: React.CSSProperties = {
  padding: "5px 10px",
  fontSize: 12,
  borderRadius: 6,
  border: "1px solid var(--color-border-tertiary)",
  background: "transparent",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  whiteSpace: "nowrap",
  fontFamily: "var(--font-dm-sans)",
  fontWeight: 500,
  lineHeight: 1,
};

/** Standard toolbar button */
export function TBtn({
  children,
  disabled,
  active,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled}
      style={{
        ...BASE,
        color: active ? "var(--color-text-primary)" : "var(--color-text-secondary)",
        ...(active ? { background: "rgba(255,255,255,0.06)", borderColor: "var(--color-border-tertiary)" } : {}),
        ...(disabled ? { opacity: 0.4, cursor: "not-allowed" } : {}),
        ...props.style,
      }}
      onMouseEnter={(e) => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-primary)";
        props.onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-secondary)";
        props.onMouseLeave?.(e);
      }}
    >
      {children}
    </button>
  );
}

/** Primary action button (orange) */
export function TBtnPrimary({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      style={{
        ...BASE,
        background: "#f97316",
        borderColor: "#f97316",
        color: "#fff",
        fontWeight: 600,
        ...props.style,
      }}
    >
      {children}
    </button>
  );
}

/** AI button (purple) */
export function TBtnAI({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      style={{
        ...BASE,
        background: "var(--color-background-secondary)",
        borderColor: "#4c3a8c",
        color: "#a78bfa",
        fontWeight: 600,
        ...props.style,
      }}
    >
      {children}
    </button>
  );
}

/** Muted non-clickable badge */
export function TBadge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="flex items-center gap-1.5"
      style={{
        ...BASE,
        cursor: "default",
        color: "var(--color-text-tertiary)",
        borderColor: "var(--color-border-tertiary)",
        fontSize: 11,
      }}
    >
      {children}
    </span>
  );
}
