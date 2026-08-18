-- Add area grouping and timing metadata to task_templates
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS area_group TEXT;
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS timing_type TEXT;
CREATE INDEX IF NOT EXISTS task_templates_area_group_idx ON task_templates(area_group);
