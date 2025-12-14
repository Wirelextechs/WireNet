import { pgTable, serial, varchar, integer, timestamp, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const fastnetOrders = pgTable("fastnet_orders", {
  id: serial("id").primaryKey(),
  shortId: varchar("short_id", { length: 50 }).notNull(),
  customerPhone: varchar("customer_phone", { length: 20 }).notNull(),
  packageDetails: varchar("package_details", { length: 50 }).notNull(),
  packagePrice: integer("package_price").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("PAID"),
  paymentReference: varchar("payment_reference", { length: 100 }),
  supplierUsed: varchar("supplier_used", { length: 50 }),
  supplierResponse: text("supplier_response"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertFastnetOrderSchema = createInsertSchema(fastnetOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type FastnetOrder = typeof fastnetOrders.$inferSelect;
export type InsertFastnetOrder = typeof fastnetOrders.$inferInsert;

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Setting = typeof settings.$inferSelect;

export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AdminUser = typeof adminUsers.$inferSelect;
