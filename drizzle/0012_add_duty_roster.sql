-- Duty roster: track which janitors are on/off duty each day
CREATE TABLE IF NOT EXISTS duty_roster (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  date DATE NOT NULL,
  on_duty BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS duty_roster_user_date_uq ON duty_roster(user_id, date);
