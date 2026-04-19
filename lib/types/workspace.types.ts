/**
 * Workspace-level TypeScript types.
 *
 * The canonical row shapes live in database.types.ts (generated from the
 * Supabase schema).  This file re-exports them under the names used
 * throughout the workspace UI, and adds any workspace-specific types that
 * have no direct DB equivalent.
 */

// ─── Re-exports from the database schema ─────────────────────────────────────

export type {
  Profile,
  Project,
  ProjectInsert,
  ProjectUpdate,
  ApuItem,
  ApuItemInsert,
  ApuItemUpdate,
  BudgetRow,
  BudgetRowInsert,
  BudgetRowUpdate,
  GanttTask,
  GanttTaskInsert,
  GanttTaskUpdate,
} from "@/lib/types/database.types";

// ─── APU line-item (materials / labour / equipment row) ───────────────────────

/**
 * A single row inside an APU item's materials, labor, or equipment array.
 * Stored as JSONB in apu_items.materials / .labor / .equipment.
 */
export interface APUMaterialRow {
  name:       string;
  unit:       string;
  qty:        number;
  unit_price: number;
}

// Alias kept for naming consistency with the DB interface name
export type { ApuLineItem } from "@/lib/types/database.types";

// ─── Workspace UI state types ────────────────────────────────────────────────

export type TabId = "apu" | "budget" | "gantt";

export type BudgetRowStatus  = "approved" | "review"     | "pending";
export type GanttTaskStatus  = "complete" | "in-progress"| "pending";
export type ProjectStatus    = "active"   | "archived"   | "completed";

/** Currency options supported by ConstruSheet */
export type Currency = "USD" | "MXN";

/** UI locale */
export type Locale = "es" | "en";

/** Unit system toggle */
export type UnitSys = "m" | "ft";
