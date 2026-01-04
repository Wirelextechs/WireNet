-- Add supplier tracking columns to fastnet_orders for multi-supplier fulfillment
ALTER TABLE fastnet_orders ADD COLUMN IF NOT EXISTS supplier_used VARCHAR(50);
ALTER TABLE fastnet_orders ADD COLUMN IF NOT EXISTS supplier_response TEXT;
