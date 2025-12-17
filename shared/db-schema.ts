import { pgTable, serial, varchar, integer, timestamp, text, boolean, real } from "drizzle-orm/pg-core";
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

// DataGod Tables
export const datagodOrders = pgTable("datagod_orders", {
  id: serial("id").primaryKey(),
  shortId: varchar("short_id", { length: 50 }).notNull(),
  customerPhone: varchar("customer_phone", { length: 20 }).notNull(),
  packageName: varchar("package_name", { length: 100 }).notNull(),
  packagePrice: real("package_price").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("PAID"),
  paymentReference: varchar("payment_reference", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type DatagodOrder = typeof datagodOrders.$inferSelect;
export type InsertDatagodOrder = typeof datagodOrders.$inferInsert;

export const datagodPackages = pgTable("datagod_packages", {
  id: serial("id").primaryKey(),
  packageName: varchar("package_name", { length: 100 }).notNull(),
  dataValueGB: real("data_value_gb").notNull(),
  priceGHS: real("price_ghs").notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type DatagodPackage = typeof datagodPackages.$inferSelect;
export type InsertDatagodPackage = typeof datagodPackages.$inferInsert;
// AT ISHARE Orders
export const atOrders = pgTable("at_orders", {
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

export const insertAtOrderSchema = createInsertSchema(atOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AtOrder = typeof atOrders.$inferSelect;
export type InsertAtOrder = typeof atOrders.$inferInsert;

// TELECEL Orders
export const telecelOrders = pgTable("telecel_orders", {
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

export const insertTelecelOrderSchema = createInsertSchema(telecelOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type TelecelOrder = typeof telecelOrders.$inferSelect;
export type InsertTelecelOrder = typeof telecelOrders.$inferInsert;

// AT ISHARE Packages
export const atPackages = pgTable("at_packages", {
  id: serial("id").primaryKey(),
  dataAmount: varchar("data_amount", { length: 50 }).notNull(),
  price: real("price").notNull(),
  deliveryTime: varchar("delivery_time", { length: 100 }).notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AtPackage = typeof atPackages.$inferSelect;
export type InsertAtPackage = typeof atPackages.$inferInsert;

// TELECEL Packages
export const telecelPackages = pgTable("telecel_packages", {
  id: serial("id").primaryKey(),
  dataAmount: varchar("data_amount", { length: 50 }).notNull(),
  price: real("price").notNull(),
  deliveryTime: varchar("delivery_time", { length: 100 }).notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type TelecelPackage = typeof telecelPackages.$inferSelect;
export type InsertTelecelPackage = typeof telecelPackages.$inferInsert;