-- Services offered (driven from DB — add more from admin later if you want)
CREATE TABLE IF NOT EXISTS services (
  id           SERIAL PRIMARY KEY,
  slug         TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  description  TEXT,
  base_price   NUMERIC(10,2) NOT NULL,
  unit         TEXT DEFAULT 'per visit',
  active       BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Portfolio (admin uploads)
CREATE TABLE IF NOT EXISTS portfolio (
  id           SERIAL PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT,
  image_path   TEXT NOT NULL,
  category     TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Payment methods — toggleable by admin
CREATE TABLE IF NOT EXISTS payment_methods (
  id           SERIAL PRIMARY KEY,
  code         TEXT UNIQUE NOT NULL,   -- buy_goods | send_money | pochi | paybill
  label        TEXT NOT NULL,
  account      TEXT,                    -- till / phone / paybill number
  instructions TEXT NOT NULL,           -- shown to client
  enabled      BOOLEAN DEFAULT FALSE,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id             SERIAL PRIMARY KEY,
  service_id     INTEGER REFERENCES services(id),
  customer_name  TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  address        TEXT NOT NULL,
  scheduled_at   TIMESTAMPTZ NOT NULL,
  notes          TEXT,
  amount         NUMERIC(10,2) NOT NULL,
  payment_method TEXT,                  -- buy_goods | send_money | pochi | paybill
  payment_ref    TEXT,                  -- M-Pesa transaction code submitted by client
  payment_status TEXT DEFAULT 'pending',-- pending | awaiting_confirmation | confirmed | cancelled
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed services (edit names/prices later in DB or via admin)
INSERT INTO services (slug, name, description, base_price, unit) VALUES
  ('house-clean',     'House Cleaning',        'Full home cleaning: floors, surfaces, bathrooms, kitchen.', 80,  'per visit'),
  ('couch-clean',     'Couch / Sofa Cleaning', 'Deep extraction cleaning for sofas and upholstery.',        60,  'per couch'),
  ('carpet-clean',    'Carpet Cleaning',       'Shampoo and steam clean for carpets and rugs.',             90,  'per room'),
  ('pest-control',    'Pest Control',          'Safe treatment for roaches, ants, rodents, and more.',      100, 'per visit'),
  ('fumigation',      'Fumigation',            'Full-property fumigation with certified chemicals.',        150, 'per visit'),
  ('pet-cleaning',    'Pet Cleaning',          'Pet-safe deep cleaning for homes with animals.',            110, 'per visit'),
  ('general-cleaning','General Cleaning',      'General-purpose cleaning for offices and homes.',           70,  'per visit')
ON CONFLICT (slug) DO NOTHING;

-- Seed payment methods — all disabled by default. Admin turns them on.
INSERT INTO payment_methods (code, label, account, instructions, enabled) VALUES
  ('buy_goods',  'Buy Goods (Till)',    '', 'Pay via M-Pesa → Lipa na M-Pesa → Buy Goods. Enter the till number shown and the exact amount.', FALSE),
  ('send_money', 'Send Money',          '', 'Pay via M-Pesa → Send Money to the number shown. Use your booking reference as the reason.',    FALSE),
  ('pochi',      'Pochi la Biashara',   '', 'Pay via M-Pesa → Send Money → Pochi la Biashara to the number shown.',                          FALSE),
  ('paybill',    'Paybill',             '', 'Pay via M-Pesa → Lipa na M-Pesa → Pay Bill. Enter the business number and your booking ID as account.', FALSE)
ON CONFLICT (code) DO NOTHING;
