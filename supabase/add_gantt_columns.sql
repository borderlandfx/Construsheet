-- =============================================================================
-- Migration: gantt_tasks columns for budget sync
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- =============================================================================

-- 1. Parent-child hierarchy
ALTER TABLE gantt_tasks
  ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES gantt_tasks(id) ON DELETE CASCADE;

-- 2. Section name for chapter grouping
ALTER TABLE gantt_tasks
  ADD COLUMN IF NOT EXISTS budget_section TEXT;

-- 3. Chapter flag
ALTER TABLE gantt_tasks
  ADD COLUMN IF NOT EXISTS is_chapter BOOLEAN DEFAULT false;

-- 4. Direct FK to budget_rows (the key link)
ALTER TABLE gantt_tasks
  ADD COLUMN IF NOT EXISTS budget_row_id UUID REFERENCES budget_rows(id) ON DELETE SET NULL;

-- 5. Clean out any stale gantt_tasks so the sync starts fresh
DELETE FROM gantt_tasks WHERE TRUE;
