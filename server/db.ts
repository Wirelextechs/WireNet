import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@shared/db-schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://localhost/wirenet",
});

export const db = drizzle(pool, { schema });
