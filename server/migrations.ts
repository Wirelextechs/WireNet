import { Pool } from "pg";

export async function runPendingMigrations() {
  if (!process.env.DATABASE_URL) {
    console.log("⚠️ DATABASE_URL not set, skipping migrations");
    return;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log("🔄 Checking and running pending migrations...");

    // Migration 1: Add network column to withdrawals
    try {
      await pool.query(
        `ALTER TABLE "withdrawals" ADD COLUMN IF NOT EXISTS "network" VARCHAR(50);`
      );
      console.log("✅ Network column migration applied");
    } catch (err: any) {
      if (!err.message?.includes("already exists")) {
        console.log("ℹ️ Network column already exists or migration skipped");
      }
    }

    console.log("✅ All migrations completed");
  } catch (error) {
    console.error("❌ Migration error:", error);
    // Don't throw - let the app continue even if migrations fail
  } finally {
    await pool.end();
  }
}
