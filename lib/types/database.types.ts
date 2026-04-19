export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

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
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          language?: "es" | "en";
          currency_pref?: "USD" | "MXN";
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          language?: "es" | "en";
          currency_pref?: "USD" | "MXN";
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
          section: string;
          code: string | null;
          description: string;
          unit: string | null;
          quantity: number;
          unit_price: number;
          total: number; // generated column – read-only
          status: "approved" | "review" | "pending";
          assignee: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          apu_item_id?: string | null;
          section: string;
          code?: string | null;
          description: string;
          unit?: string | null;
          quantity?: number;
          unit_price?: number;
          // total is generated – omit on insert
          status?: "approved" | "review" | "pending";
          assignee?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          apu_item_id?: string | null;
          section?: string;
          code?: string | null;
          description?: string;
          unit?: string | null;
          quantity?: number;
          unit_price?: number;
          // total is generated – omit on update
          status?: "approved" | "review" | "pending";
          assignee?: string | null;
          sort_order?: number;
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

      // --- gantt_tasks ------------------------------------------------------
      gantt_tasks: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          assignee: string | null;
          start_week: number;
          duration_weeks: number;
          color: string;
          status: "complete" | "in-progress" | "pending";
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          assignee?: string | null;
          start_week?: number;
          duration_weeks?: number;
          color?: string;
          status?: "complete" | "in-progress" | "pending";
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          name?: string;
          assignee?: string | null;
          start_week?: number;
          duration_weeks?: number;
          color?: string;
          status?: "complete" | "in-progress" | "pending";
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "gantt_tasks_project_id_fkey";
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
      row_status: "approved" | "review" | "pending";
      task_status: "complete" | "in-progress" | "pending";
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
export type GanttTask  = Database["public"]["Tables"]["gantt_tasks"]["Row"];

// Insert / Update helpers
export type ProjectInsert   = Database["public"]["Tables"]["projects"]["Insert"];
export type ProjectUpdate   = Database["public"]["Tables"]["projects"]["Update"];
export type ApuItemInsert   = Database["public"]["Tables"]["apu_items"]["Insert"];
export type ApuItemUpdate   = Database["public"]["Tables"]["apu_items"]["Update"];
export type BudgetRowInsert = Database["public"]["Tables"]["budget_rows"]["Insert"];
export type BudgetRowUpdate = Database["public"]["Tables"]["budget_rows"]["Update"];
export type GanttTaskInsert = Database["public"]["Tables"]["gantt_tasks"]["Insert"];
export type GanttTaskUpdate = Database["public"]["Tables"]["gantt_tasks"]["Update"];

// ---------------------------------------------------------------------------
// Legacy aliases — keep workspace components compiling while they are migrated
// ---------------------------------------------------------------------------
/** @deprecated Use ApuItem */
export type APUItem = ApuItem;
/** @deprecated Use BudgetRow */
export type BudgetItem = BudgetRow;
