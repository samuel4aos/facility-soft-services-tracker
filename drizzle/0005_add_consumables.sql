-- Consumables tracking tables
CREATE TABLE IF NOT EXISTS consumables (
  id SERIAL PRIMARY KEY,
  facility_id INTEGER NOT NULL REFERENCES facilities(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  unit TEXT NOT NULL DEFAULT 'pcs',
  current_stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 10,
  max_stock INTEGER NOT NULL DEFAULT 100,
  unit_cost DOUBLE PRECISION,
  location TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS consumables_facility_idx ON consumables(facility_id);

-- Delivery records
CREATE TABLE IF NOT EXISTS consumable_deliveries (
  id SERIAL PRIMARY KEY,
  consumable_id INTEGER NOT NULL REFERENCES consumables(id),
  received_by_id INTEGER NOT NULL REFERENCES users(id),
  quantity INTEGER NOT NULL,
  supplier TEXT,
  waybill_number TEXT,
  notes TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS consumable_deliveries_consumable_idx ON consumable_deliveries(consumable_id);

-- Usage records
CREATE TABLE IF NOT EXISTS consumable_usage (
  id SERIAL PRIMARY KEY,
  consumable_id INTEGER NOT NULL REFERENCES consumables(id),
  used_by_id INTEGER NOT NULL REFERENCES users(id),
  quantity INTEGER NOT NULL,
  area TEXT,
  notes TEXT,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS consumable_usage_consumable_idx ON consumable_usage(consumable_id);
