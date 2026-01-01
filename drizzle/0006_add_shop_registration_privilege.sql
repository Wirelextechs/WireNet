-- Add registration privilege fields to shops table
ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "can_register_new_shops" BOOLEAN DEFAULT true;
ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "registered_by" INTEGER;

-- Update existing shops to have the privilege enabled by default
UPDATE "shops" SET "can_register_new_shops" = true WHERE "can_register_new_shops" IS NULL;
