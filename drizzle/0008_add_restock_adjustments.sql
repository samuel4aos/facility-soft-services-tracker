CREATE TYPE restock_request_status AS ENUM ('pending', 'approved', 'ordered', 'received', 'cancelled');

CREATE TABLE IF NOT EXISTS restock_requests (
  id SERIAL PRIMARY KEY,
  facility_id INTEGER NOT NULL REFERENCES facilities(id),
  consumable_id INTEGER NOT NULL REFERENCES consumables(id),
  requested_by_id INTEGER NOT NULL REFERENCES users(id),
  approved_by_id INTEGER REFERENCES users(id),
  quantity INTEGER NOT NULL,
  supplier TEXT,
  notes TEXT,
  status restock_request_status NOT NULL DEFAULT 'pending',
  approved_at TIMESTAMPTZ,
  ordered_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS restock_requests_facility_idx ON restock_requests(facility_id);
CREATE INDEX IF NOT EXISTS restock_requests_status_idx ON restock_requests(status);
CREATE INDEX IF NOT EXISTS restock_requests_consumable_idx ON restock_requests(consumable_id);

CREATE TABLE IF NOT EXISTS stock_adjustments (
  id SERIAL PRIMARY KEY,
  facility_id INTEGER NOT NULL REFERENCES facilities(id),
  consumable_id INTEGER NOT NULL REFERENCES consumables(id),
  adjusted_by_id INTEGER NOT NULL REFERENCES users(id),
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  adjustment INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stock_adjustments_consumable_idx ON stock_adjustments(consumable_id);
