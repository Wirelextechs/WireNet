-- Add supplier tracking columns to datagod_orders for auto-fulfillment
ALTER TABLE datagod_orders ADD COLUMN IF NOT EXISTS supplier_used VARCHAR(50);
ALTER TABLE datagod_orders ADD COLUMN IF NOT EXISTS supplier_reference VARCHAR(100);
ALTER TABLE datagod_orders ADD COLUMN IF NOT EXISTS failure_reason TEXT;
