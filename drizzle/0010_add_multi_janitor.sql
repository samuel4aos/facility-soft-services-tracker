-- Add multi-janitor support columns to task_templates
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS max_assignees INTEGER NOT NULL DEFAULT 1;
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS assigned_user_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS task_templates_assigned_user_ids_idx ON task_templates USING GIN (assigned_user_ids);