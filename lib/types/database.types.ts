export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ---------------------------------------------------------------------------
// Indirect Costs Settings (stored in project_settings JSONB)
// ---------------------------------------------------------------------------
export interface IndirectCostLine {
  label: string;
  pct: number;
}

export interface ProjectIndirectCosts {
  // Materials indirects
  pmat1: IndirectCostLine; // e.g. "Flete y acarreos" 3%
  pmat2: IndirectCostLine; // e.g. "Merma y desperdicio" 2%
  // Labor indirects
  pmob1: IndirectCostLine; // e.g. "Seguridad y higiene" 3.5%
  pmob2: IndirectCostLine; // e.g. "FSR" 2%
  // Equipment indirects
  pmaq1: IndirectCostLine; // e.g. "Herramienta menor" 3%
  pmaq2: IndirectCostLine;
  // General & admin expenses (applied to direct cost)
  ggen:  IndirectCostLine; // e.g. "Gastos generales" 15%
  pgas1: IndirectCostLine; // e.g. "Mochada" 0%
  pgas2: IndirectCostLine;
  // Profit (applied to net cost)
  util:  IndirectCostLine; // e.g. "Utilidad" 10%
  // Taxes (applied to selling price)
  tot1:  IndirectCostLine; // e.g. "IVA" 16%
  tot2:  IndirectCostLine;
}

export const DEFAULT_INDIRECT_COSTS: ProjectIndirectCosts = {
  pmat1: { label: "Flete y acarreos",          pct: 3   },
  pmat2: { label: "Merma y desperdicio",        pct: 2   },
  pmob1: { label: "Seguridad y higiene",        pct: 3.5 },
  pmob2: { label: "FSR",                        pct: 2   },
  pmaq1: { label: "Herramienta menor",          pct: 3   },
  pmaq2: { label: "",                           pct: 0   },
  ggen:  { label: "Gastos generales y admin.",  pct: 15  },
  pgas1: { label: "Mochada",                    pct: 0   },
  pgas2: { label: "",                           pct: 0   },
  util:  { label: "Utilidad",                   pct: 10  },
  tot1:  { label: "IVA 16%",                    pct: 16  },
  tot2:  { label: "",                           pct: 0   },
};

// ---------------------------------------------------------------------------
// JSONB component shapes used in apu_items
// ---------------------------------------------------------------------------
export interface ApuLineItem {
  name: string;
  unit: string;
  qty: number;
  unit_price: number;
}

// ---------------------------------------------------------------------------
// Database schema
// ---------------------------------------------------------------------------
export interface Database {
  public: {
    Tables: {
      // --- profiles ---------------------------------------------------------
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          language: "es" | "en";
          currency_pref: "USD" | "MXN";
          default_indirect_costs: ProjectIndirectCosts | null;
          plan: "free" | "pro";
          plan_expires_at: string | null;
          stripe_customer_id: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          language?: "es" | "en";
          currency_pref?: "USD" | "MXN";
          default_indirect_costs?: ProjectIndirectCosts | null;
          plan?: "free" | "pro";
          plan_expires_at?: string | null;
          stripe_customer_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          language?: "es" | "en";
          currency_pref?: "USD" | "MXN";
          default_indirect_costs?: ProjectIndirectCosts | null;
          plan?: "free" | "pro";
          plan_expires_at?: string | null;
          stripe_customer_id?: string | null;
        };
        Relationships: [];
      };

      // --- projects ---------------------------------------------------------
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          location: string | null;
          description: string | null;
          currency: string;
          status: "active" | "archived" | "completed";
          project_settings: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          location?: string | null;
          description?: string | null;
          currency?: string;
          status?: "active" | "archived" | "completed";
          project_settings?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          location?: string | null;
          description?: string | null;
          currency?: string;
          status?: "active" | "archived" | "completed";
          project_settings?: Json | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };

      // --- apu_items --------------------------------------------------------
      apu_items: {
        Row: {
          id: string;
          project_id: string;
          code: string;
          description: string;
          unit: string;
          category: string | null;
          is_library: boolean;
          user_id: string | null;
          materials: ApuLineItem[];
          labor: ApuLineItem[];
          equipment: ApuLineItem[];
          direct_cost: number;
          overhead_pct: number;
          profit_pct: number;
          selling_price: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          code: string;
          description: string;
          unit: string;
          category?: string | null;
          is_library?: boolean;
          user_id?: string | null;
          materials?: ApuLineItem[];
          labor?: ApuLineItem[];
          equipment?: ApuLineItem[];
          direct_cost?: number;
          overhead_pct?: number;
          profit_pct?: number;
          selling_price?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          code?: string;
          description?: string;
          unit?: string;
          category?: string | null;
          is_library?: boolean;
          user_id?: string | null;
          materials?: ApuLineItem[];
          labor?: ApuLineItem[];
          equipment?: ApuLineItem[];
          direct_cost?: number;
          overhead_pct?: number;
          profit_pct?: number;
          selling_price?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "apu_items_project_id_fkey";
            columns: ["project_id"];
            referencedRelation: "projects";
            referencedColumns: ["id"];
          }
        ];
      };

      // --- budget_rows ------------------------------------------------------
      budget_rows: {
        Row: {
          id: string;
          project_id: string;
          apu_item_id: string | null;
          budget_id: string | null;
          section: string;
          code: string | null;
          description: string;
          unit: string | null;
          quantity: number;
          unit_price: number;
          total: number; // generated column – read-only

          original_quantity: number | null;
          status: "approved" | "in-review" | "pending";
          assignee: string | null;
          sort_order: number;
          is_chapter: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          apu_item_id?: string | null;
          budget_id?: string | null;
          section: string;
          code?: string | null;
          description: string;
          unit?: string | null;
          quantity?: number;
          unit_price?: number;

          original_quantity?: number | null;
          // total is generated – omit on insert
          status?: "approved" | "in-review" | "pending";
          assignee?: string | null;
          sort_order?: number;
          is_chapter?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          apu_item_id?: string | null;
          budget_id?: string | null;
          section?: string;
          code?: string | null;
          description?: string;
          unit?: string | null;
          quantity?: number;
          unit_price?: number;
          // total is generated – omit on update
          // original_quantity is baseline — not updated
          status?: "approved" | "in-review" | "pending";
          assignee?: string | null;
          sort_order?: number;
          is_chapter?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "budget_rows_project_id_fkey";
            columns: ["project_id"];
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "budget_rows_apu_item_id_fkey";
            columns: ["apu_item_id"];
            referencedRelation: "apu_items";
            referencedColumns: ["id"];
          }
        ];
      };

      // --- takeoff_items ----------------------------------------------------
      takeoff_items: {
        Row: {
          id: string;
          project_id: string;
          element: string;
          description: string | null;
          unit: string | null;
          quantity: number;
          notes: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          element: string;
          description?: string | null;
          unit?: string | null;
          quantity?: number;
          notes?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          element?: string;
          description?: string | null;
          unit?: string | null;
          quantity?: number;
          notes?: string | null;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "takeoff_items_project_id_fkey";
            columns: ["project_id"];
            referencedRelation: "projects";
            referencedColumns: ["id"];
          }
        ];
      };

      // --- gantt_tasks ------------------------------------------------------
      gantt_tasks: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          start_week: number;
          duration_weeks: number;
          color: string;
          status: "approved" | "in-review" | "pending";
          progress_pct: number;
          parent_task_id: string | null;
          budget_section: string | null;
          is_chapter: boolean;

          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          start_week?: number;
          duration_weeks?: number;
          color?: string;
          status?: "approved" | "in-review" | "pending";
          progress_pct?: number;
          parent_task_id?: string | null;
          budget_section?: string | null;
          is_chapter?: boolean;

          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          name?: string;
          start_week?: number;
          duration_weeks?: number;
          color?: string;
          status?: "approved" | "in-review" | "pending";
          progress_pct?: number;
          parent_task_id?: string | null;
          budget_section?: string | null;
          is_chapter?: boolean;

          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "gantt_tasks_project_id_fkey";
            columns: ["project_id"];
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gantt_tasks_parent_task_id_fkey";
            columns: ["parent_task_id"];
            referencedRelation: "gantt_tasks";
            referencedColumns: ["id"];
          }
        ];
      };

      // --- budget_row_history ------------------------------------------------
      budget_row_history: {
        Row: {
          id: string;
          budget_row_id: string;
          project_id: string;
          user_id: string | null;
          user_name: string | null;
          field_changed: string;
          old_value: string | null;
          new_value: string | null;
          changed_at: string;
        };
        Insert: {
          id?: string;
          budget_row_id: string;
          project_id: string;
          user_id?: string | null;
          user_name?: string | null;
          field_changed: string;
          old_value?: string | null;
          new_value?: string | null;
          changed_at?: string;
        };
        Update: {
          id?: string;
          budget_row_id?: string;
          project_id?: string;
          user_id?: string | null;
          user_name?: string | null;
          field_changed?: string;
          old_value?: string | null;
          new_value?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "budget_row_history_budget_row_id_fkey";
            columns: ["budget_row_id"];
            referencedRelation: "budget_rows";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "budget_row_history_project_id_fkey";
            columns: ["project_id"];
            referencedRelation: "projects";
            referencedColumns: ["id"];
          }
        ];
      };
    };

    Views: Record<string, never>;
    Functions: Record<string, never>;

    Enums: {
      language: "es" | "en";
      currency_pref: "USD" | "MXN";
      project_status: "active" | "archived" | "completed";
      row_status: "approved" | "in-review" | "pending";
      task_status: "approved" | "in-review" | "pending";
    };

    CompositeTypes: Record<string, never>;
  };
}

// ---------------------------------------------------------------------------
// Convenience row-level aliases
// ---------------------------------------------------------------------------
export type Profile    = Database["public"]["Tables"]["profiles"]["Row"];
export type Project    = Database["public"]["Tables"]["projects"]["Row"];
export type ApuItem    = Database["public"]["Tables"]["apu_items"]["Row"];
export type BudgetRow  = Database["public"]["Tables"]["budget_rows"]["Row"];
export type GanttTask    = Database["public"]["Tables"]["gantt_tasks"]["Row"];
export type TakeoffItem  = Database["public"]["Tables"]["takeoff_items"]["Row"];

// Insert / Update helpers
export type ProjectInsert     = Database["public"]["Tables"]["projects"]["Insert"];
export type ProjectUpdate     = Database["public"]["Tables"]["projects"]["Update"];
export type ApuItemInsert     = Database["public"]["Tables"]["apu_items"]["Insert"];
export type ApuItemUpdate     = Database["public"]["Tables"]["apu_items"]["Update"];
export type BudgetRowInsert   = Database["public"]["Tables"]["budget_rows"]["Insert"];
export type BudgetRowUpdate   = Database["public"]["Tables"]["budget_rows"]["Update"];
export type GanttTaskInsert   = Database["public"]["Tables"]["gantt_tasks"]["Insert"];
export type GanttTaskUpdate   = Database["public"]["Tables"]["gantt_tasks"]["Update"];
export type TakeoffItemInsert = Database["public"]["Tables"]["takeoff_items"]["Insert"];
export type TakeoffItemUpdate = Database["public"]["Tables"]["takeoff_items"]["Update"];

// ---------------------------------------------------------------------------
// Legacy aliases — keep workspace components compiling while they are migrated
// ---------------------------------------------------------------------------
/** @deprecated Use ApuItem */
export type APUItem = ApuItem;
/** @deprecated Use BudgetRow */
export type BudgetItem = BudgetRow;
