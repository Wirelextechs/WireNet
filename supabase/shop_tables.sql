-- Shop System Tables for Supabase
-- Run this in the Supabase SQL Editor

-- Shop Users Table (for shop owners, separate from admin users)
CREATE TABLE IF NOT EXISTS shop_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shops Table
CREATE TABLE IF NOT EXISTS shops (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES shop_users(id) ON DELETE CASCADE,
  shop_name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  logo TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'suspended', 'rejected')),
  total_earnings DECIMAL(10, 2) DEFAULT 0,
  available_balance DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shop Package Configurations (markups and visibility per package)
CREATE TABLE IF NOT EXISTS shop_package_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,
  package_id TEXT NOT NULL,
  markup_amount DECIMAL(10, 2) DEFAULT 0,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(shop_id, service_type, package_id)
);

-- Withdrawals Table
CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  fee DECIMAL(10, 2) DEFAULT 0,
  net_amount DECIMAL(10, 2) NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  processed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shops_user_id ON shops(user_id);
CREATE INDEX IF NOT EXISTS idx_shops_slug ON shops(slug);
CREATE INDEX IF NOT EXISTS idx_shops_status ON shops(status);
CREATE INDEX IF NOT EXISTS idx_shop_package_config_shop_id ON shop_package_config(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_package_config_service ON shop_package_config(service_type);
CREATE INDEX IF NOT EXISTS idx_withdrawals_shop_id ON withdrawals(shop_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);

-- Enable Row Level Security (RLS)
ALTER TABLE shop_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_package_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shop_users (allow all for now - authentication handled by app)
CREATE POLICY "Allow all access to shop_users" ON shop_users FOR ALL USING (true);

-- RLS Policies for shops
CREATE POLICY "Allow all access to shops" ON shops FOR ALL USING (true);

-- RLS Policies for shop_package_config
CREATE POLICY "Allow all access to shop_package_config" ON shop_package_config FOR ALL USING (true);

-- RLS Policies for withdrawals
CREATE POLICY "Allow all access to withdrawals" ON withdrawals FOR ALL USING (true);

-- Add shop_id column to orders table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'shop_id') THEN
    ALTER TABLE orders ADD COLUMN shop_id UUID REFERENCES shops(id);
    ALTER TABLE orders ADD COLUMN shop_markup DECIMAL(10, 2) DEFAULT 0;
  END IF;
END $$;

-- Create index for shop orders
CREATE INDEX IF NOT EXISTS idx_orders_shop_id ON orders(shop_id);
