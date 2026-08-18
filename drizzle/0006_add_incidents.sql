CREATE TYPE incident_status AS ENUM ('open', 'assigned', 'in_progress', 'resolved');

CREATE TABLE IF NOT EXISTS incidents (
  id SERIAL PRIMARY KEY,
  facility_id INTEGER NOT NULL REFERENCES facilities(id),
  reported_by_id INTEGER NOT NULL REFERENCES users(id),
  assigned_to_id INTEGER REFERENCES users(id),
  area TEXT NOT NULL,
  description TEXT,
  status incident_status NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'standard',
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS incidents_facility_idx ON incidents(facility_id);
CREATE INDEX IF NOT EXISTS incidents_status_idx ON incidents(status);
CREATE INDEX IF NOT EXISTS incidents_assigned_idx ON incidents(assigned_to_id);

CREATE TABLE IF NOT EXISTS incident_photos (
  id SERIAL PRIMARY KEY,
  incident_id INTEGER NOT NULL REFERENCES incidents(id),
  uploaded_by INTEGER NOT NULL REFERENCES users(id),
  photo_type TEXT NOT NULL DEFAULT 'before',
  url TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS incident_photos_incident_idx ON incident_photos(incident_id);
