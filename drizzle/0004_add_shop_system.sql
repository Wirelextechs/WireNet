-- Shop System Migration
-- Add shop_users, shops, shop_package_config, withdrawals tables
-- Add shopId and shopMarkup columns to order tables

-- Shop Users table (shop owners) - named shop_users to avoid conflict with Supabase auth users
CREATE TABLE IF NOT EXISTS shop_users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,

  
   NOT NULL
);

-- Shops table
CREATE TABLE IF NOT EXISTS shops (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES shop_users(id),
  shop_name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  logo TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  total_earnings REAL NOT NULL DEFAULT 0,
  available_balance REAL NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Shop package configuration (markups and visibility)
CREATE TABLE IF NOT EXISTS shop_package_config (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL REFERENCES shops(id),
  service_type VARCHAR(20) NOT NULL,
  package_id INTEGER NOT NULL,
  markup_amount REAL NOT NULL DEFAULT 0,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_shop_package_config_shop_id ON shop_package_config(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_package_config_service ON shop_package_config(service_type);

-- Withdrawals table
CREATE TABLE IF NOT EXISTS withdrawals (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL REFERENCES shops(id),
  amount REAL NOT NULL,
  fee REAL NOT NULL DEFAULT 0,
  net_amount REAL NOT NULL,
  bank_name VARCHAR(100) NOT NULL,
  account_number VARCHAR(50) NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_shop_id ON withdrawals(shop_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);

-- Add shopId and shopMarkup to existing order tables
ALTER TABLE fastnet_orders ADD COLUMN IF NOT EXISTS shop_id INTEGER;
ALTER TABLE fastnet_orders ADD COLUMN IF NOT EXISTS shop_markup REAL;

ALTER TABLE datagod_orders ADD COLUMN IF NOT EXISTS shop_id INTEGER;
ALTER TABLE datagod_orders ADD COLUMN IF NOT EXISTS shop_markup REAL;

ALTER TABLE at_orders ADD COLUMN IF NOT EXISTS shop_id INTEGER;
ALTER TABLE at_orders ADD COLUMN IF NOT EXISTS shop_markup REAL;

ALTER TABLE telecel_orders ADD COLUMN IF NOT EXISTS shop_id INTEGER;
ALTER TABLE telecel_orders ADD COLUMN IF NOT EXISTS shop_markup REAL;

-- Create indexes for shop order lookups
CREATE INDEX IF NOT EXISTS idx_fastnet_orders_shop_id ON fastnet_orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_datagod_orders_shop_id ON datagod_orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_at_orders_shop_id ON at_orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_telecel_orders_shop_id ON telecel_orders(shop_id);
