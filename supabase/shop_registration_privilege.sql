-- Add shop registration privilege columns to shops table
-- This allows shop owners to register new independent shops

-- Add can_register_new_shops column (default true - all shops can register by default)
ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "can_register_new_shops" BOOLEAN DEFAULT true;

-- Add registered_by column to track who registered the shop (nullable, references shops.id)
ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "registered_by" INTEGER;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS "idx_shops_registered_by" ON "shops" ("registered_by");

-- Note: No foreign key constraint added to avoid issues if the registering shop is deleted
-- The registered_by field is just for tracking purposes
