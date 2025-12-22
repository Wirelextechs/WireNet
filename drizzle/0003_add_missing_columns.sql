-- Add missing supplier_reference column to at_orders table
-- This column was defined in the schema but not migrated to production

ALTER TABLE "at_orders" ADD COLUMN "supplier_reference" varchar(100);

-- Verify both tables have the column (Telecel should have it from 0002)
-- If telecel_orders is missing it, this will add it too
ALTER TABLE "telecel_orders" ADD COLUMN IF NOT EXISTS "supplier_reference" varchar(100);
