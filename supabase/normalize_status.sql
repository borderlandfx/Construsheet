-- Normalize status values across budget_rows and gantt_tasks
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

-- 1. Drop old CHECK constraints and add new ones
ALTER TABLE budget_rows DROP CONSTRAINT IF EXISTS budget_rows_status_check;
ALTER TABLE budget_rows ADD CONSTRAINT budget_rows_status_check CHECK (status IN ('approved', 'in-review', 'pending'));

ALTER TABLE gantt_tasks DROP CONSTRAINT IF EXISTS gantt_tasks_status_check;
ALTER TABLE gantt_tasks ADD CONSTRAINT gantt_tasks_status_check CHECK (status IN ('approved', 'in-review', 'pending'));

-- 2. Budget rows: standardize to 'pending', 'in-review', 'approved'
UPDATE budget_rows SET status = 'pending'   WHERE status IN ('Pending', 'Pendiente', 'PENDING');
UPDATE budget_rows SET status = 'in-review' WHERE status IN ('In Review', 'En revision', 'review', 'Under Review', 'En revisión');
UPDATE budget_rows SET status = 'approved'  WHERE status IN ('Approved', 'Aprobado', 'APPROVED', 'completed', 'complete');

-- 3. Gantt tasks: standardize to 'pending', 'in-review', 'approved'
UPDATE gantt_tasks SET status = 'pending'   WHERE status IN ('Pending', 'Pendiente', 'PENDING');
UPDATE gantt_tasks SET status = 'in-review' WHERE status IN ('In Review', 'En revision', 'review', 'Under Review', 'En revisión', 'in-progress');
UPDATE gantt_tasks SET status = 'approved'  WHERE status IN ('Approved', 'Aprobado', 'APPROVED', 'completed', 'complete');

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
