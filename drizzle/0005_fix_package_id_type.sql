-- Migration to fix package_id column type to support both UUID and integer IDs

-- First, create the new column with TEXT type
ALTER TABLE shop_package_config ADD COLUMN package_id_text TEXT;

-- Migrate existing data from integer to text
UPDATE shop_package_config SET package_id_text = CAST(package_id AS TEXT);

-- Drop the old integer column and rename the new one
ALTER TABLE shop_package_config DROP COLUMN package_id;
ALTER TABLE shop_package_config RENAME COLUMN package_id_text TO package_id;

-- Add NOT NULL constraint back
ALTER TABLE shop_package_config ALTER COLUMN package_id SET NOT NULL;
