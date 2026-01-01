import { Pool } from "pg";

export async function runPendingMigrations() {
  if (!process.env.DATABASE_URL) {
    console.log("⚠️ DATABASE_URL not set, skipping migrations");
    return;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 10000,
  });

  try {
    console.log("🔄 Checking and running pending migrations...");

    // Migration 1: Add network column to withdrawals
    try {
      // First check if the table exists
      const tableCheck = await pool.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'withdrawals');`
      );
      
      if (!tableCheck.rows[0]?.exists) {
        console.log("ℹ️ Withdrawals table doesn't exist yet, skipping network column migration");
      } else {
        // Check if the column already exists
        const columnCheck = await pool.query(
          `SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'withdrawals' AND column_name = 'network');`
        );

        if (columnCheck.rows[0]?.exists) {
          console.log("ℹ️ Network column already exists");
        } else {
          // Add the column
          await pool.query(
            `ALTER TABLE "withdrawals" ADD COLUMN "network" VARCHAR(50);`
          );
          console.log("✅ Network column added to withdrawals table");
        }
      }
    } catch (err: any) {
      console.error("❌ Network column migration error:", {
        message: err.message,
        code: err.code,
        detail: err.detail,
      });
      // Don't throw - let the app continue
    }

    console.log("✅ All migrations completed");
  } catch (error) {
    console.error("❌ Migration error:", error);
    // Don't throw - let the app continue even if migrations fail
  } finally {
    try {
      await pool.end();
    } catch (err) {
      console.log("⚠️ Error closing migration pool:", err);
    }
  }
}
