-- Add network column to withdrawals table for mobile money network selection
ALTER TABLE "withdrawals" ADD COLUMN IF NOT EXISTS "network" VARCHAR(50);
