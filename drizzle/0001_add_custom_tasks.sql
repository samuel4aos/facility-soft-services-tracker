-- Add hourly to recurrence_type enum
ALTER TYPE recurrence_type ADD VALUE IF NOT EXISTS 'hourly' AFTER 'daily';

-- Add custom_task_status enum
DO $$ BEGIN
  CREATE TYPE custom_task_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Custom tasks (ad-hoc supervisor-created tasks)
CREATE TABLE IF NOT EXISTS custom_tasks (
  id SERIAL PRIMARY KEY,
  facility_id INTEGER NOT NULL REFERENCES facilities(id),
  created_by_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  area TEXT,
  instructions TEXT,
  due_date DATE,
  priority TEXT NOT NULL DEFAULT 'standard',
  status custom_task_status NOT NULL DEFAULT 'pending',
  requires_photo BOOLEAN NOT NULL DEFAULT true,
  completed_at TIMESTAMPTZ,
  completed_by INTEGER REFERENCES users(id),
  completion_notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS custom_tasks_facility_idx ON custom_tasks(facility_id);
CREATE INDEX IF NOT EXISTS custom_tasks_status_idx ON custom_tasks(status);

-- Task assignments (links janitors to custom tasks)
CREATE TABLE IF NOT EXISTS task_assignments (
  id SERIAL PRIMARY KEY,
  custom_task_id INTEGER NOT NULL REFERENCES custom_tasks(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS task_assignments_task_idx ON task_assignments(custom_task_id);
CREATE INDEX IF NOT EXISTS task_assignments_user_idx ON task_assignments(user_id);

-- Photos for custom task completions
CREATE TABLE IF NOT EXISTS custom_task_photos (
  id SERIAL PRIMARY KEY,
  custom_task_id INTEGER NOT NULL REFERENCES custom_tasks(id),
  uploaded_by INTEGER NOT NULL REFERENCES users(id),
  url TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
