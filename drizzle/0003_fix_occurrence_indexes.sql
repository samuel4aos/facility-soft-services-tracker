-- Fix unique indexes: use partial indexes so daily tasks (due_hour=NULL) 
-- are limited to one per date, and hourly tasks (due_hour NOT NULL) 
-- are limited to one per date+hour.
DROP INDEX IF EXISTS occurrence_template_due_uq;
CREATE UNIQUE INDEX occurrence_daily_uq ON task_occurrences (task_template_id, due_date) WHERE due_hour IS NULL;
CREATE UNIQUE INDEX occurrence_hourly_uq ON task_occurrences (task_template_id, due_date, due_hour) WHERE due_hour IS NOT NULL;
