-- Add supplier reference columns for Code Craft polling
-- Safe to run multiple times.

ALTER TABLE IF EXISTS "at_orders"
  ADD COLUMN IF NOT EXISTS "supplier_reference" varchar(100);

ALTER TABLE IF EXISTS "telecel_orders"
  ADD COLUMN IF NOT EXISTS "supplier_reference" varchar(100);
