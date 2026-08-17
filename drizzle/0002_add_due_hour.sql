-- Add due_hour to task_occurrences for hourly scheduling
ALTER TABLE task_occurrences ADD COLUMN due_hour integer;

-- Drop the old unique constraint and create a new one that includes the hour
DROP INDEX IF EXISTS occurrence_template_due_uq;
CREATE UNIQUE INDEX occurrence_template_due_uq ON task_occurrences (task_template_id, due_date, due_hour);
