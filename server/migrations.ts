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

    // Migration 4: Add shop registration privilege columns to shops table (Supabase)
    try {
      // Check if shops table exists in Supabase (we need to use a separate connection for Supabase)
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
      
      if (supabaseUrl && supabaseKey) {
        // Note: Supabase shops table columns need to be added manually or via Supabase dashboard
        // The following columns should be added to the shops table:
        console.log("ℹ️ Shop registration privilege columns should be added to Supabase shops table:");
        console.log("   - can_register_new_shops BOOLEAN DEFAULT true");
        console.log("   - registered_by INTEGER (nullable, references shops.id)");
        console.log("   Run: supabase/shop_registration_privilege.sql");
      }
    } catch (err: any) {
      console.log("ℹ️ Supabase migration note:", err.message);
    }

    // Migration 5: Add shop owner registration settings
    try {
      // Add default settings for shop owner registration privilege
      const shopOwnerCanRegisterSetting = await pool.query(
        `SELECT value FROM settings WHERE key = 'shopOwnerCanRegister'`
      );
      if (shopOwnerCanRegisterSetting.rows.length === 0) {
        await pool.query(
          `INSERT INTO settings (key, value) VALUES ('shopOwnerCanRegister', 'true') ON CONFLICT (key) DO NOTHING`
        );
        console.log("✅ Added shopOwnerCanRegister setting (default: true)");
      }
      
      const maxRegistrationsSetting = await pool.query(
        `SELECT value FROM settings WHERE key = 'maxRegistrationsPerOwner'`
      );
      if (maxRegistrationsSetting.rows.length === 0) {
        await pool.query(
          `INSERT INTO settings (key, value) VALUES ('maxRegistrationsPerOwner', '10') ON CONFLICT (key) DO NOTHING`
        );
        console.log("✅ Added maxRegistrationsPerOwner setting (default: 10)");
      }
    } catch (err: any) {
      console.log("ℹ️ Settings migration note:", err.message);
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
