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

    // Check if withdrawals table exists
    const tableCheck = await pool.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'withdrawals');`
    );
    
    if (!tableCheck.rows[0]?.exists) {
      console.log("ℹ️ Withdrawals table doesn't exist yet, skipping withdrawal migrations");
    } else {
      // Migration 1: Add network column to withdrawals
      try {
        const columnCheck = await pool.query(
          `SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'withdrawals' AND column_name = 'network');`
        );

        if (!columnCheck.rows[0]?.exists) {
          await pool.query(`ALTER TABLE "withdrawals" ADD COLUMN "network" VARCHAR(50);`);
          console.log("✅ Network column added to withdrawals table");
        } else {
          console.log("ℹ️ Network column already exists");
        }
      } catch (err: any) {
        console.error("❌ Network column migration error:", err.message);
      }

      // Migration 2: Add external_shop_id column to withdrawals
      try {
        const extShopIdCheck = await pool.query(
          `SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'withdrawals' AND column_name = 'external_shop_id');`
        );

        if (!extShopIdCheck.rows[0]?.exists) {
          await pool.query(`ALTER TABLE "withdrawals" ADD COLUMN "external_shop_id" VARCHAR(100);`);
          console.log("✅ external_shop_id column added to withdrawals table");
        } else {
          console.log("ℹ️ external_shop_id column already exists");
        }
      } catch (err: any) {
        console.error("❌ external_shop_id column migration error:", err.message);
      }

      // Migration 3: Make shop_id nullable (if it has NOT NULL constraint)
      try {
        await pool.query(`ALTER TABLE "withdrawals" ALTER COLUMN "shop_id" DROP NOT NULL;`);
        console.log("✅ Made shop_id nullable");
      } catch (err: any) {
        // This will fail if already nullable, which is fine
        if (!err.message?.includes("not present")) {
          console.log("ℹ️ shop_id is already nullable or error:", err.message);
        }
      }
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
