-- Add 'cancelled' status for occurrences (used to retire test-period / obsolete slots)
ALTER TYPE occurrence_status ADD VALUE IF NOT EXISTS 'cancelled';