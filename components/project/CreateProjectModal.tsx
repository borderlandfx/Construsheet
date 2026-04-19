"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, X, Loader2 } from "lucide-react";
import type { Locale } from "@/lib/utils/i18n";
import { t } from "@/lib/utils/i18n";
import type { ProjectWithBudget } from "./ProjectCard";

interface CreateProjectModalProps {
  userId: string;
  locale: Locale;
  onProjectCreated: (project: ProjectWithBudget) => void;
}

export default function CreateProjectModal({
  userId,
  locale,
  onProjectCreated,
}: CreateProjectModalProps) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // form state
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState<"USD" | "MXN">("MXN");

  function reset() {
    setName("");
    setLocation("");
    setDescription("");
    setCurrency("MXN");
    setError(null);
  }

  function close() {
    setOpen(false);
    reset();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);

    const { data, error: insertError } = await supabase
      .from("projects")
      .insert({
        name: name.trim(),
        location: location.trim() || null,
        description: description.trim() || null,
        user_id: userId,
        currency,
        status: "active",
      })
      .select()
      .single();

    setLoading(false);

    if (insertError || !data) {
      setError(t("error", locale));
      return;
    }

    // optimistic: add with empty budget_rows
    onProjectCreated({ ...data, budget_rows: [] });
    close();
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.5rem 0.75rem",
    borderRadius: 8,
    border: "1px solid var(--cs-border)",
    background: "rgba(255,255,255,0.04)",
    color: "var(--cs-text)",
    fontSize: "0.875rem",
    fontFamily: "var(--font-dm-sans)",
    outline: "none",
    transition: "border-color 0.15s",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: "0.375rem",
    fontSize: "0.8125rem",
    fontWeight: 500,
    color: "var(--cs-muted)",
    fontFamily: "var(--font-dm-sans)",
  };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 font-dm-sans font-semibold text-sm transition-all duration-150 rounded-[10px] px-4 py-2"
        style={{
          background: "var(--cs-accent)",
          color: "#fff",
          border: "none",
          cursor: "pointer",
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.opacity = "0.9")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.opacity = "1")
        }
      >
        <Plus className="h-4 w-4" />
        {t("createProject", locale)}
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          <div
            className="w-full flex flex-col gap-5"
            style={{
              maxWidth: 480,
              background: "var(--cs-surface)",
              border: "1px solid var(--cs-border)",
              borderRadius: 16,
              padding: "1.75rem",
              boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
            }}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between">
              <h2
                className="font-syne font-bold text-lg"
                style={{ color: "var(--cs-text)" }}
              >
                {t("newProject", locale)}
              </h2>
              <button
                onClick={close}
                className="flex items-center justify-center rounded-lg"
                style={{
                  width: 30,
                  height: 30,
                  background: "transparent",
                  border: "1px solid var(--cs-border)",
                  color: "var(--cs-muted)",
                  cursor: "pointer",
                }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Name */}
              <div>
                <label style={labelStyle}>
                  {t("projectName", locale)}{" "}
                  <span style={{ color: "var(--cs-accent)" }}>*</span>
                </label>
                <input
                  style={fieldStyle}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("projectNamePlaceholder", locale)}
                  required
                  autoFocus
                  onFocus={(e) =>
                    ((e.currentTarget as HTMLInputElement).style.borderColor =
                      "var(--cs-accent)")
                  }
                  onBlur={(e) =>
                    ((e.currentTarget as HTMLInputElement).style.borderColor =
                      "var(--cs-border)")
                  }
                />
              </div>

              {/* Location */}
              <div>
                <label style={labelStyle}>{t("location", locale)}</label>
                <input
                  style={fieldStyle}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder={t("locationPlaceholder", locale)}
                  onFocus={(e) =>
                    ((e.currentTarget as HTMLInputElement).style.borderColor =
                      "var(--cs-accent)")
                  }
                  onBlur={(e) =>
                    ((e.currentTarget as HTMLInputElement).style.borderColor =
                      "var(--cs-border)")
                  }
                />
              </div>

              {/* Description */}
              <div>
                <label style={labelStyle}>{t("description", locale)}</label>
                <textarea
                  style={{ ...fieldStyle, resize: "vertical", minHeight: 72 }}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("descriptionPlaceholder", locale)}
                  rows={3}
                  onFocus={(e) =>
                    ((e.currentTarget as HTMLTextAreaElement).style.borderColor =
                      "var(--cs-accent)")
                  }
                  onBlur={(e) =>
                    ((e.currentTarget as HTMLTextAreaElement).style.borderColor =
                      "var(--cs-border)")
                  }
                />
              </div>

              {/* Currency toggle */}
              <div>
                <label style={labelStyle}>{t("currency", locale)}</label>
                <div
                  className="flex rounded-lg overflow-hidden"
                  style={{ border: "1px solid var(--cs-border)", display: "inline-flex", width: "100%" }}
                >
                  {(["MXN", "USD"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCurrency(c)}
                      className="flex-1 py-2 text-sm font-medium font-dm-sans transition-all duration-150"
                      style={{
                        background:
                          currency === c
                            ? "var(--cs-accent)"
                            : "transparent",
                        color:
                          currency === c ? "#fff" : "var(--cs-muted)",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      {c === "MXN" ? "MXN — Peso" : "USD — Dólar"}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <p
                  className="text-sm font-dm-sans"
                  style={{ color: "#ef4444" }}
                >
                  {error}
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={close}
                  className="flex-1 py-2.5 rounded-[10px] text-sm font-medium font-dm-sans transition-colors"
                  style={{
                    background: "transparent",
                    border: "1px solid var(--cs-border)",
                    color: "var(--cs-muted)",
                    cursor: "pointer",
                  }}
                >
                  {t("cancel", locale)}
                </button>
                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[10px] text-sm font-semibold font-dm-sans transition-opacity"
                  style={{
                    background: "var(--cs-accent)",
                    color: "#fff",
                    border: "none",
                    cursor: loading || !name.trim() ? "not-allowed" : "pointer",
                    opacity: loading || !name.trim() ? 0.6 : 1,
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("creating", locale)}
                    </>
                  ) : (
                    t("createProject", locale)
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
