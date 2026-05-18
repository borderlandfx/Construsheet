-- =============================================================================
-- ConstruSheet – Supabase Database Schema
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. PROFILES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id                     UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                  TEXT        NOT NULL,
  full_name              TEXT,
  language               TEXT        DEFAULT 'es' CHECK (language IN ('es', 'en')),
  currency_pref          TEXT        DEFAULT 'USD' CHECK (currency_pref IN ('USD', 'MXN', 'COP')),
  default_indirect_costs JSONB,
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 2. PROJECTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  location         TEXT,
  description      TEXT,
  currency         TEXT        DEFAULT 'USD',
  status           TEXT        DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
  project_settings JSONB       DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Migration helpers (safe to run on existing databases)
ALTER TABLE profiles  ADD COLUMN IF NOT EXISTS default_indirect_costs JSONB;
ALTER TABLE projects  ADD COLUMN IF NOT EXISTS project_settings       JSONB DEFAULT '{}'::jsonb;
-- Drop and re-add check constraint to allow COP (run only if constraint exists)
-- ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_currency_pref_check;
-- ALTER TABLE profiles ADD CONSTRAINT profiles_currency_pref_check CHECK (currency_pref IN ('USD', 'MXN', 'COP'));

-- ---------------------------------------------------------------------------
-- 3. APU_ITEMS  (Unit Price Analysis)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS apu_items (
  id            UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID           NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  code          TEXT           NOT NULL,
  description   TEXT           NOT NULL,
  unit          TEXT           NOT NULL,
  materials     JSONB          DEFAULT '[]'::jsonb,
  labor         JSONB          DEFAULT '[]'::jsonb,
  equipment     JSONB          DEFAULT '[]'::jsonb,
  direct_cost   DECIMAL(12,2)  DEFAULT 0,
  overhead_pct  DECIMAL(5,2)   DEFAULT 12,
  profit_pct    DECIMAL(5,2)   DEFAULT 5,
  category      TEXT,
  selling_price DECIMAL(12,2)  DEFAULT 0,
  created_at    TIMESTAMPTZ    DEFAULT NOW(),
  updated_at    TIMESTAMPTZ    DEFAULT NOW()
);

-- Migration: add category column to existing apu_items tables
ALTER TABLE apu_items ADD COLUMN IF NOT EXISTS category TEXT;

-- Migration: add is_library flag to apu_items
ALTER TABLE apu_items ADD COLUMN IF NOT EXISTS is_library BOOLEAN DEFAULT false;

-- Migration: add user_id to apu_items for user-global library
ALTER TABLE apu_items ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id);

-- ---------------------------------------------------------------------------
-- 4. BUDGET_ROWS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS budget_rows (
  id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID           NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  apu_item_id UUID           REFERENCES apu_items(id) ON DELETE SET NULL,
  budget_id   UUID,
  section     TEXT           NOT NULL,
  code        TEXT,
  description TEXT           NOT NULL,
  unit        TEXT,
  quantity    DECIMAL(12,3)  DEFAULT 0,
  unit_price  DECIMAL(12,2)  DEFAULT 0,
  total       DECIMAL(12,2)  GENERATED ALWAYS AS (quantity * unit_price) STORED,
  status      TEXT           DEFAULT 'pending' CHECK (status IN ('approved', 'in-review', 'pending')),
  assignee    TEXT,
  sort_order  INTEGER        DEFAULT 0,
  is_chapter  BOOLEAN        DEFAULT false,
  created_at  TIMESTAMPTZ    DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 5. GANTT_TASKS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gantt_tasks (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  assignee       TEXT,
  start_week     INTEGER     DEFAULT 1,
  duration_weeks INTEGER     DEFAULT 2,
  color          TEXT        DEFAULT '#f97316',
  status         TEXT        DEFAULT 'pending' CHECK (status IN ('approved', 'in-review', 'pending')),
  progress_pct   INTEGER     DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  parent_task_id UUID        REFERENCES gantt_tasks(id) ON DELETE CASCADE,
  budget_section TEXT,
  is_chapter     BOOLEAN     DEFAULT false,
  budget_row_id  UUID        REFERENCES budget_rows(id) ON DELETE SET NULL,
  sort_order     INTEGER     DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Migration helpers
ALTER TABLE gantt_tasks ADD COLUMN IF NOT EXISTS progress_pct INTEGER DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100);
ALTER TABLE gantt_tasks ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES gantt_tasks(id) ON DELETE CASCADE;
ALTER TABLE gantt_tasks ADD COLUMN IF NOT EXISTS budget_section TEXT;
ALTER TABLE gantt_tasks ADD COLUMN IF NOT EXISTS is_chapter BOOLEAN DEFAULT false;
ALTER TABLE gantt_tasks ADD COLUMN IF NOT EXISTS budget_row_id UUID REFERENCES budget_rows(id) ON DELETE SET NULL;

-- =============================================================================
-- INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_projects_user_id       ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_apu_items_project_id   ON apu_items(project_id);
CREATE INDEX IF NOT EXISTS idx_budget_rows_project_id ON budget_rows(project_id);
CREATE INDEX IF NOT EXISTS idx_gantt_tasks_project_id ON gantt_tasks(project_id);

-- =============================================================================
-- TRIGGER: auto-create profile on new auth.users insert
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _lang TEXT;
BEGIN
  -- Respect the language the user chose on the sign-up form (stored in raw_user_meta_data)
  _lang := COALESCE(NEW.raw_user_meta_data ->> 'language', 'es');
  IF _lang NOT IN ('es', 'en') THEN _lang := 'es'; END IF;

  INSERT INTO public.profiles (id, email, full_name, language)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    _lang
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- TRIGGER: auto-update updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at_projects   ON projects;
CREATE TRIGGER set_updated_at_projects
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_apu_items  ON apu_items;
CREATE TRIGGER set_updated_at_apu_items
  BEFORE UPDATE ON apu_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- profiles ----------------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- projects ----------------------------------------------------------------
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_select_own" ON projects
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "projects_insert_own" ON projects
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "projects_update_own" ON projects
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "projects_delete_own" ON projects
  FOR DELETE USING (user_id = auth.uid());

-- apu_items ---------------------------------------------------------------
ALTER TABLE apu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "apu_items_select_own" ON apu_items
  FOR SELECT USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

CREATE POLICY "apu_items_insert_own" ON apu_items
  FOR INSERT WITH CHECK (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

CREATE POLICY "apu_items_update_own" ON apu_items
  FOR UPDATE USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

CREATE POLICY "apu_items_delete_own" ON apu_items
  FOR DELETE USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

-- budget_rows -------------------------------------------------------------
ALTER TABLE budget_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budget_rows_select_own" ON budget_rows
  FOR SELECT USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

CREATE POLICY "budget_rows_insert_own" ON budget_rows
  FOR INSERT WITH CHECK (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

CREATE POLICY "budget_rows_update_own" ON budget_rows
  FOR UPDATE USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

CREATE POLICY "budget_rows_delete_own" ON budget_rows
  FOR DELETE USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

-- gantt_tasks -------------------------------------------------------------
ALTER TABLE gantt_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gantt_tasks_select_own" ON gantt_tasks
  FOR SELECT USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

CREATE POLICY "gantt_tasks_insert_own" ON gantt_tasks
  FOR INSERT WITH CHECK (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

CREATE POLICY "gantt_tasks_update_own" ON gantt_tasks
  FOR UPDATE USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

CREATE POLICY "gantt_tasks_delete_own" ON gantt_tasks
  FOR DELETE USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 6. TAKEOFF_ITEMS  (Quantity Takeoff)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS takeoff_items (
  id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID           NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  element     TEXT           NOT NULL,
  description TEXT,
  unit        TEXT,
  quantity    DECIMAL(12,3)  DEFAULT 0,
  notes       TEXT,
  sort_order  INTEGER        DEFAULT 0,
  created_at  TIMESTAMPTZ    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_takeoff_items_project_id ON takeoff_items(project_id);

ALTER TABLE takeoff_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "takeoff_items_select_own" ON takeoff_items
  FOR SELECT USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

CREATE POLICY "takeoff_items_insert_own" ON takeoff_items
  FOR INSERT WITH CHECK (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

CREATE POLICY "takeoff_items_update_own" ON takeoff_items
  FOR UPDATE USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

CREATE POLICY "takeoff_items_delete_own" ON takeoff_items
  FOR DELETE USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );